"""Экспорт анатомических 3D-моделей сердца и артерий в формат FBX для ZBrush.

Создаёт:
- export_zbrush/heart_left_type.fbx   (миокард + 13 артерий леводоминантного типа)
- export_zbrush/heart_right_type.fbx  (миокард + 13 артерий праводоминантного типа)

Особенности для ZBrush:
- Каждый сегмент сохраняется как отдельная именованная нода (при импорте в ZBrush
  через Zplugin -> FBX ExportImport каждый станет отдельным SubTool'ом).
- Сохраняются вершинные цвета (Cd / Polypaint) и мировые координаты.
"""

import os
import sys
import hou

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "export_zbrush")
os.makedirs(OUT_DIR, exist_ok=True)

GLB_RIGHT = os.path.join(ROOT, "public", "models", "heart", "heart_segmented.glb")
GLB_LEFT = os.path.join(ROOT, ".tools", "heart_left_auto", "heart_segmented_left_type_auto.glb")


def export_glb_to_fbx(glb_path, out_fbx_path, subnet_name):
    print(f"\n--- Экспорт {os.path.basename(glb_path)} -> {os.path.basename(out_fbx_path)} ---")
    hip = hou.hipFile
    hip.clear()

    # 1. Загрузка GLB
    src_geo = hou.node("/obj").createNode("geo", "src_loader")
    g = src_geo.createNode("gltf")
    g.parm("gltffile").set(glb_path.replace("\\", "/"))
    g.parm("importmeshnames").set(1)
    g.parm("meshnameattrib").set("name")

    u = src_geo.createNode("unpack")
    u.setInput(0, g)
    u.parm("transfer_attributes").set("name gltf_node_name path Cd")

    w = src_geo.createNode("attribwrangle", "name_from_node")
    w.setInput(0, u)
    w.parm("class").set(1)  # Primitives
    w.parm("snippet").set('if (s@gltf_node_name != "") s@name = s@gltf_node_name;')

    geo = w.geometry()
    names = set()
    for p in geo.prims():
        n = p.attribValue("name")
        if n:
            names.add(n)

    sorted_names = sorted(list(names))
    print(f"Обнаружено мешей/сабтулов: {len(sorted_names)}")
    for n in sorted_names:
        print(f"  - {n}")

    # 2. Создание контейнера с отдельными geo для каждого сабтула
    export_subnet = hou.node("/obj").createNode("subnet", subnet_name)
    for name in sorted_names:
        subgeo = export_subnet.createNode("geo", name)
        om = subgeo.createNode("object_merge")
        om.parm("objpath1").set(w.path())
        om.parm("xformtype").set(1)

        blast = subgeo.createNode("blast")
        blast.setInput(0, om)
        blast.parm("group").set(f"@name={name}")
        blast.parm("negate").set(1)

        blast.setDisplayFlag(True)
        blast.setRenderFlag(True)

    src_geo.setDisplayFlag(False)

    # 3. Экспорт в FBX
    out = hou.node("/out")
    fbx = out.createNode("filmboxfbx")
    fbx.parm("sopoutput").set(out_fbx_path.replace("\\", "/"))
    fbx.parm("startnode").set(export_subnet.path())
    fbx.parm("vcformat").set(0)  # Vertex Color (Polypaint)
    fbx.parm("convertsurfaces").set(0)
    fbx.parm("execute").pressButton()

    size_mb = os.path.getsize(out_fbx_path) / (1024 * 1024)
    print(f"Успешно выгружен FBX: {out_fbx_path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    out_right = os.path.join(OUT_DIR, "heart_right_type.fbx")
    out_left = os.path.join(OUT_DIR, "heart_left_type.fbx")

    export_glb_to_fbx(GLB_RIGHT, out_right, "heart_right_type")
    export_glb_to_fbx(GLB_LEFT, out_left, "heart_left_type")
    print("\n[OK] Экспорт для ZBrush завершён.")
