"""
Конвертер оптимизированной модели сердца из формата Houdini Classic ASCII (.geo / PGEOMETRY V5)
в бинарный glTF 2.0 (.glb) с переупаковкой мешей по атрибуту `name`, исправлением winding-order,
переворотом V-координаты UV под стандарт glTF 2.0 и конвертацией диффузной текстуры в WebP.
"""

from __future__ import annotations

import json
import os
import re
import struct
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_GEO = os.path.join(
    REPO_ROOT,
    "ref",
    "heart_model",
    "01- Corazn",
    "heart_optimazatotion.fbx",
)
INPUT_TEX = os.path.join(
    REPO_ROOT,
    "ref",
    "heart_model",
    "01- Corazn",
    "0d020903becb4791bdee80149e9a2cc6_RGB_CorazonCorazon.png",
)
OUT_DIR = os.path.join(REPO_ROOT, "public", "models", "heart")
OUT_GLB = os.path.join(OUT_DIR, "heart_optimized.glb")
OUT_WEBP = os.path.join(OUT_DIR, "heart_diffuse.webp")

# Меши, которые пропускаем как незначимые остатки удалённых структур
SKIP_MESHES = {"LPV_MiCorazon_0"}


def pad4(buf: bytearray, pad_byte: bytes = b"\x00") -> None:
    rem = len(buf) % 4
    if rem:
        buf.extend(pad_byte * (4 - rem))


def parse_houdini_geo(
    path: str,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, List[Tuple[int, int, int]]]]:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    header = "".join(lines[:15])
    m = re.search(r"NPoints\s+(\d+)\s+NPrims\s+(\d+)", header)
    if not m:
        raise RuntimeError("Не удалось прочитать заголовок PGEOMETRY V5 (NPoints/NPrims).")
    npts, nprims = int(m.group(1)), int(m.group(2))

    pt_start = next(i for i, l in enumerate(lines) if l.startswith("fbx_rotation")) + 1

    positions = np.empty((npts, 3), dtype=np.float32)
    uvs = np.empty((npts, 2), dtype=np.float32)
    normals = np.empty((npts, 3), dtype=np.float32)

    for idx in range(npts):
        line = lines[pt_start + idx]
        lp = line.find("(")
        rp = line.rfind(")")
        coords = line[:lp].split()
        positions[idx, 0] = float(coords[0])
        positions[idx, 1] = float(coords[1])
        positions[idx, 2] = float(coords[2])

        attrs = line[lp + 1 : rp].split("\t")
        # attrs[0]=fbx_scale, attrs[1]=uv, attrs[2]=N
        uv_parts = attrs[1].split()
        n_parts = attrs[2].split()
        uvs[idx, 0] = float(uv_parts[0])
        # Стандарт glTF 2.0: v=0 вверху (flipY=false при загрузке текстуры)
        uvs[idx, 1] = 1.0 - float(uv_parts[1])

        nx, ny, nz = float(n_parts[0]), float(n_parts[1]), float(n_parts[2])
        nlen = float(np.sqrt(nx * nx + ny * ny + nz * nz)) or 1.0
        normals[idx, 0] = nx / nlen
        normals[idx, 1] = ny / nlen
        normals[idx, 2] = nz / nlen

    prim_idx = next(i for i, l in enumerate(lines) if l.startswith("PrimitiveAttrib"))
    name_line = ""
    for j in range(prim_idx + 1, prim_idx + 10):
        if lines[j].startswith("name "):
            name_line = lines[j].strip()
            break
    if not name_line:
        raise RuntimeError("Не найден PrimitiveAttrib 'name' в .geo файле.")

    # Формат: name 1 index 23 Name0 Name1 ...
    mesh_names = name_line.split()[4:]
    run_idx = next(i for i in range(prim_idx, prim_idx + 15) if lines[i].startswith("Run "))

    tris_by_mesh: Dict[str, List[Tuple[int, int, int]]] = {}
    for i in range(run_idx + 1, run_idx + 1 + nprims):
        line = lines[i].strip()
        lb = line.find("[")
        rb = line.find("]")
        att = line[lb + 1 : rb].split()
        name_idx = int(att[1])
        mesh_name = mesh_names[name_idx]
        if mesh_name in SKIP_MESHES:
            continue

        body = line[:lb].strip().split()
        k = int(body[0])
        if k != 3:
            continue
        v0, v1, v2 = int(body[2]), int(body[3]), int(body[4])
        # Разворот winding-порядка CW (Houdini) -> CCW (glTF 2.0)
        tris_by_mesh.setdefault(mesh_name, []).append((v0, v2, v1))

    return positions, uvs, normals, tris_by_mesh


def verify_winding(
    positions: np.ndarray,
    normals: np.ndarray,
    tris_by_mesh: Dict[str, List[Tuple[int, int, int]]],
) -> None:
    dot_pos = 0
    dot_neg = 0
    for tris in tris_by_mesh.values():
        for v0, v1, v2 in tris:
            p0, p1, p2 = positions[v0], positions[v1], positions[v2]
            fn = np.cross(p1 - p0, p2 - p0)
            vn = normals[v0] + normals[v1] + normals[v2]
            d = float(np.dot(fn, vn))
            if d > 0:
                dot_pos += 1
            elif d < 0:
                dot_neg += 1
    total = dot_pos + dot_neg
    ratio = dot_pos / total if total else 0.0
    print(f"Winding verification: CCW(dot>0)={dot_pos}, CW(dot<0)={dot_neg} ({ratio*100:.2f}% CCW)")
    assert ratio > 0.99, f"Ожидалось >99% CCW треугольников, получено {ratio*100:.2f}%"


def build_glb(
    positions: np.ndarray,
    uvs: np.ndarray,
    normals: np.ndarray,
    tris_by_mesh: Dict[str, List[Tuple[int, int, int]]],
    out_glb_path: str,
) -> None:
    bin_buf = bytearray()
    buffer_views: List[dict] = []
    accessors: List[dict] = []
    meshes: List[dict] = []
    nodes: List[dict] = []

    def add_buffer_view(data_bytes: bytes, target: int) -> int:
        pad4(bin_buf, b"\x00")
        offset = len(bin_buf)
        bin_buf.extend(data_bytes)
        bv_idx = len(buffer_views)
        buffer_views.append(
            {
                "buffer": 0,
                "byteOffset": offset,
                "byteLength": len(data_bytes),
                "target": target,
            }
        )
        return bv_idx

    for mesh_name in sorted(tris_by_mesh.keys()):
        tris = tris_by_mesh[mesh_name]
        if not tris:
            continue

        tri_arr = np.array(tris, dtype=np.int32)
        unique_verts, inverse = np.unique(tri_arr.reshape(-1), return_inverse=True)

        local_pos = positions[unique_verts].astype("<f4", copy=False)
        local_norm = normals[unique_verts].astype("<f4", copy=False)
        local_uv = uvs[unique_verts].astype("<f4", copy=False)

        use_u32 = len(unique_verts) > 65535
        idx_dtype = "<u4" if use_u32 else "<u2"
        idx_comp_type = 5125 if use_u32 else 5123
        local_indices = inverse.astype(idx_dtype)

        pos_bv = add_buffer_view(local_pos.tobytes(), 34962)
        norm_bv = add_buffer_view(local_norm.tobytes(), 34962)
        uv_bv = add_buffer_view(local_uv.tobytes(), 34962)
        idx_bv = add_buffer_view(local_indices.tobytes(), 34963)

        pos_min = [float(x) for x in local_pos.min(axis=0)]
        pos_max = [float(x) for x in local_pos.max(axis=0)]

        pos_acc = len(accessors)
        accessors.append(
            {
                "bufferView": pos_bv,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(unique_verts)),
                "type": "VEC3",
                "min": pos_min,
                "max": pos_max,
            }
        )

        norm_acc = len(accessors)
        accessors.append(
            {
                "bufferView": norm_bv,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(unique_verts)),
                "type": "VEC3",
            }
        )

        uv_acc = len(accessors)
        accessors.append(
            {
                "bufferView": uv_bv,
                "byteOffset": 0,
                "componentType": 5126,
                "count": int(len(unique_verts)),
                "type": "VEC2",
            }
        )

        idx_acc = len(accessors)
        accessors.append(
            {
                "bufferView": idx_bv,
                "byteOffset": 0,
                "componentType": idx_comp_type,
                "count": int(len(local_indices)),
                "type": "SCALAR",
            }
        )

        mesh_idx = len(meshes)
        meshes.append(
            {
                "name": mesh_name,
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": pos_acc,
                            "NORMAL": norm_acc,
                            "TEXCOORD_0": uv_acc,
                        },
                        "indices": idx_acc,
                        "mode": 4,
                    }
                ],
            }
        )

        nodes.append({"name": mesh_name, "mesh": mesh_idx})

    pad4(bin_buf, b"\x00")

    gltf = {
        "asset": {"version": "2.0", "generator": "ECG_education convert_geo_to_glb.py"},
        "scene": 0,
        "scenes": [{"name": "HeartScene", "nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_buf)}],
    }

    json_bytes = bytearray(json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    pad4(json_bytes, b" ")

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_buf)

    with open(out_glb_path, "wb") as wf:
        # GLB Header: magic ('glTF'), version=2, length
        wf.write(struct.pack("<III", 0x46546C67, 2, total_length))
        # Chunk 0: JSON (0x4E4F534A)
        wf.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        wf.write(json_bytes)
        # Chunk 1: BIN (0x004E4942)
        wf.write(struct.pack("<II", len(bin_buf), 0x004E4942))
        wf.write(bin_buf)

    print(f"GLB saved: {out_glb_path} ({os.path.getsize(out_glb_path):,} bytes), meshes={len(meshes)}")


def convert_texture_to_webp(src_png: str, dst_webp: str) -> None:
    img = Image.open(src_png).convert("RGBA")
    resized = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    resized.save(dst_webp, format="WEBP", quality=88, method=6)
    print(f"WebP texture saved: {dst_webp} ({os.path.getsize(dst_webp):,} bytes)")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    positions, uvs, normals, tris_by_mesh = parse_houdini_geo(INPUT_GEO)
    verify_winding(positions, normals, tris_by_mesh)
    build_glb(positions, uvs, normals, tris_by_mesh, OUT_GLB)
    convert_texture_to_webp(INPUT_TEX, OUT_WEBP)


if __name__ == "__main__":
    main()
