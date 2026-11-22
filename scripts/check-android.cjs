// Проверка автономного комплекта после cap sync; не заменяет запуск APK.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'android/app/src/main/assets');
const config = JSON.parse(fs.readFileSync(path.join(assets, 'capacitor.config.json'), 'utf8'));
assert.equal(config.appId, 'ru.cardioatlas.ecg');
assert.equal(config.server?.url, undefined, 'Мобильная сборка не должна зависеть от dev-сервера');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let count = 0;
function verify(dir, relative = '') {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(relative, item.name);
    if (item.isDirectory()) verify(path.join(dir, item.name), next);
    else {
      assert.equal(hash(path.join(dir, item.name)), hash(path.join(assets, 'public', next)), `Ресурс отличается: ${next}`);
      count++;
    }
  }
}
verify(path.join(root, 'dist'));
for (const file of ['models/heart/heart_optimized.glb', 'models/heart/heart_diffuse.webp']) {
  assert.ok(fs.existsSync(path.join(assets, 'public', file)), `Отсутствует ${file}`);
}
assert.ok(fs.readFileSync(path.join(root, 'android/capacitor.settings.gradle'), 'utf8').includes(':capacitor-android'), 'Не подключена библиотека Capacitor');
console.log(`Android: ${count} ресурсов совпадают с dist; модель и текстура включены, библиотека Capacitor подключена. Проверка APK на устройстве остаётся отдельным этапом.`);
