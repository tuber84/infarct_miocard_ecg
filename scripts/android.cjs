// Запускаем локальные CLI через текущий Node.js, без вложенного поиска npm в PATH.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(file, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const mode = process.argv[2];
if (!['sync', 'apk'].includes(mode)) throw new Error('Ожидается sync или apk');
run('node_modules/typescript/bin/tsc', ['--noEmit']);
run('node_modules/vite/bin/vite.js', ['build']);
run('node_modules/@capacitor/cli/bin/capacitor', ['sync', 'android']);
run('scripts/check-android.cjs');
if (mode === 'apk') run('scripts/build-android.cjs');
