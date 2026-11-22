// Сборка локального отладочного APK без открытия Android Studio.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const env = { ...process.env };
const localJava = path.join(root, '.tools', 'jdk21');
const studioJava = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
if (!env.JAVA_HOME && fs.existsSync(localJava)) env.JAVA_HOME = localJava;
if (!env.JAVA_HOME && fs.existsSync(studioJava)) env.JAVA_HOME = studioJava;
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && env.LOCALAPPDATA) {
  const sdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  if (fs.existsSync(sdk)) env.ANDROID_HOME = sdk;
}
const java = env.JAVA_HOME ? path.join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const probe = spawnSync(java, ['-version'], { env, encoding: 'utf8', windowsHide: true });
const sdkConfigured = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || fs.existsSync(path.join(root, 'android', 'local.properties'));
if (probe.error || probe.status !== 0 || !sdkConfigured) {
  console.error('Для APK нужны JDK 21 и Android SDK Platform 36. Установите Android Studio и SDK; настройка описана в docs/ANDROID_BUILD.md.');
  process.exit(1);
}
const version = (probe.stderr + probe.stdout).match(/version "(\d+)/)?.[1];
if (!version || Number(version) < 21 || Number(version) > 24) {
  console.error(`Обнаружена Java ${version || 'неизвестной версии'}. Для Gradle этого проекта задайте JAVA_HOME на JDK 21; см. docs/ANDROID_BUILD.md.`);
  process.exit(1);
}
if (process.platform === 'win32') {
  // Команда фиксирована; пути пользователя не подставляются в текст shell.
  const result = spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat assembleDebug'], { cwd: path.join(root, 'android'), env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
}
const result = spawnSync('./gradlew', ['assembleDebug'], { cwd: path.join(root, 'android'), env, stdio: 'inherit' });
process.exit(result.status ?? 1);
