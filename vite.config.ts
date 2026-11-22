import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function collectDistFiles(rootDir: string, dir = rootDir): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectDistFiles(rootDir, fullPath));
      continue;
    }
    const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (rel === 'sw.js' || entry.name === '.DS_Store' || entry.name === 'Thumbs.db') {
      continue;
    }
    result.push(rel);
  }
  return result.sort();
}

function cardioAtlasPwaPlugin(): Plugin {
  let outDir = '';
  let isBuild = false;

  return {
    name: 'cardioatlas-pwa-sw',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    closeBundle() {
      if (!isBuild || !fs.existsSync(outDir)) return;

      const files = collectDistFiles(outDir);
      const hash = crypto.createHash('sha256');
      for (const rel of files) {
        hash.update(rel);
        hash.update(fs.readFileSync(path.join(outDir, rel)));
      }
      const version = hash.digest('hex').slice(0, 10);
      const cacheName = `cardioatlas-pwa-${version}`;
      const precacheUrls = ['./', ...files.map((file) => `./${file}`)];

      const swSource = `// Автосгенерированный Service Worker для офлайн-работы PWA (включая iPhone).
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cardioatlas-pwa-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./index.html')
        .then((cached) => cached || caches.match('./') || fetch(req))
        .catch(() => fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});
`;
      fs.writeFileSync(path.join(outDir, 'sw.js'), swSource, 'utf8');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), cardioAtlasPwaPlugin()],
  server: {
    port: 5173,
  },
});
