# Сборка автономного приложения Windows (Electron Portable `.exe`)

Руководство по десктопной обёртке приложения **КардиоАтлас ЭКГ** (`electron/main.cjs`), иконкам (`build/`) и упаковке автономного Portable `.exe` без установки (`electron-builder`).

Electron сохраняется как текущая оболочка Windows. Общее медицинское ядро и мобильные интерфейсы развиваем по [плану архитектуры](ARCHITECTURE_ROADMAP.md); для Android подготовлен проект на Capacitor 8 ([ANDROID_BUILD.md](ANDROID_BUILD.md)), для iPhone — офлайн-PWA ([IOS_PWA.md](IOS_PWA.md)). Смена десктопной оболочки на Tauri требует подтверждённой необходимости и проверки графики.

---

## 1. Архитектура десктопного запуска (`electron/main.cjs`)

3D-модель сердца (`models/heart/heart_segmented.glb`) и бандлы Vite собираются с относительной базой (`base: './'`, `import.meta.env.BASE_URL`). При обычном открытии `dist/index.html` по протоколу `file://` запросы `fetch('./models/heart/...')` и ES-модули могут блокироваться политикой CORS браузера/Electron.

Для полностью автономной оффлайн-работы в [`electron/main.cjs`](../electron/main.cjs) используется собственный локальный протокол **`app://localhost/...`**:

1. **Регистрация схемы до готовности Electron:**
   Вызов `protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])` выполняется **строго до `app.whenReady()`**. Это разрешает Vite ES-модулям, `fetch()` (для `.glb`) и WebGL-текстурам работать идентично локальному HTTP-серверу.
2. **Обработчик `protocol.handle('app', ...)` и `MIME_TYPES`:**
   - Функция `resolveDistFile(requestUrl)` преобразует `app://localhost/...` в путь внутри `dist/` и проверяет защиту от выхода за пределы каталога (`path traversal`: `!fullPath.startsWith(DIST_DIR)` → `403 Forbidden`).
   - Файл считывается из `dist/` (включая ресурсы внутри `app.asar`) и отдаётся с явным заголовком `Content-Type` из таблицы `MIME_TYPES` (`.html`, `.js`/`.mjs`, `.css`, `.json`, `.webmanifest`, `.glb` → `model/gltf-binary`, `.gltf`, `.webp`, `.png`, `.jpg`/`.jpeg`, `.svg`, `.ico`, `.woff`/`.woff2`).
3. **Окно и безопасность (`BrowserWindow`):**
   - Стартовый размер `1440×920`, минимальный `1024×700`, фоновый цвет `#f8fafc`.
   - `Menu.setApplicationMenu(null)` и `autoHideMenuBar: true` убирают стандартную панель меню Chromium.
   - В `webPreferences` включены `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
   - Сторонние ссылки (`setWindowOpenHandler`) перенаправляются во внешний системный браузер (`shell.openExternal`).
   - Поддерживается отладочный запуск против Vite dev-сервера через переменную окружения `ELECTRON_DEV_URL` (без неё открывается `app://localhost/index.html`).

---

## 2. Команды запуска и сборки

Перед сборкой `.exe` веб-часть автоматически проверяется компилятором TypeScript (`tsc --noEmit`) и собирается в `dist/` (`vite build`):

```powershell
# Локальный запуск десктопного окна Electron из текущей сборки dist/
npm run electron:start

# Полная пересборка dist/ и упаковка Portable .exe для Windows x64
npm run dist:win
```

### Выходные файлы в `release/`
- `release/CardioAtlas-ECG-1.0.0-Portable.exe` — единый автономный исполняемый файл (`~116 МБ`), который можно перенести на любой ПК с Windows 10/11 (x64) без установки Node.js или браузера.
- `release/win-unpacked/` — распакованный образ приложения (`CardioAtlas ECG.exe` и ресурсы Chromium/Electron), удобный для быстрой локальной проверки без ожидания упаковки в self-extracting архив.

---

## 3. Конфигурация `electron-builder` в `package.json`

Секция `"build"` в [`package.json`](../package.json) задаёт параметры упаковки:
- `appId`: `ru.cardioatlas.ecg`, `productName`: `CardioAtlas ECG` (латинские имена во избежание проблем `electron-builder` с кириллическими временными путями на Windows; заголовок окна внутри приложения остаётся русским).
- `files`: включаются **только** `dist/**/*`, `electron/**/*` и `package.json` — исходные референсы (`ref/`), Python-скрипты (`scripts/`) и `src/` в `.exe` не попадают.
- `win.target`: `portable` (`arch: ["x64"]`), выходное имя задаётся через `portable.artifactName` (`CardioAtlas-ECG-${version}-Portable.exe`).
- Если потребуется классический **NSIS-установщик** (с созданием ярлыков в меню «Пуск» и на рабочем столе), замените или дополните `win.target` элементом `{ "target": "nsis", "arch": ["x64"] }`.

---

## 4. Иконка приложения и особенности Windows

- Иконка хранится в [`build/icon.ico`](../build/icon.ico) (мультиразмерный набор `256 / 128 / 64 / 48 / 32 / 16`) и [`build/icon.png`](../build/icon.png) (`256×256`). Она используется и для ресурса `.exe`, и для заголовка/панели задач в `createMainWindow()`.
- **Подпись кода:** локальная сборка выполняется без сертификата цифровой подписи (`signing is skipped`). На другом ПК Windows SmartScreen может показать предупреждение при первом запуске («Подробнее → Выполнить в любом случае»).
- **`EPERM` при пересборке:** перед запуском `npm run dist:win` закрывайте работающее окно `CardioAtlas ECG.exe`, иначе Windows заблокирует перезапись каталога `release/win-unpacked/`.
