# AGENTS.md — Руководство для ИИ-агентов

Этот файл содержит критические правила, архитектуру, инварианты и подводные камни проекта **КардиоАтлас ЭКГ** (`c:\_proekty\python\ECG_education`), чтобы любой ИИ-агент мог безопасно и быстро дорабатывать проект.

---

## 1. Общие правила работы в репозитории

1. **Язык:** весь пользовательский интерфейс, клинические тексты, комментарии в коде и документация ведутся **на русском языке**. Медицинские сокращения артерий дублируются в привычном врачам виде: `ПМЖВ (LAD)`, `ОВ (LCx)`, `ПКА (RCA)`, `Ствол ЛКА (LMCA)`, `ВТК (OM1)`, `ЗМЖВ (PDA)`.
2. **Папка `ref/` неприкосновенна:** внутри `ref/` лежат исходные видеореференсы и оригинальный архив 3D-модели. **Не удаляйте, не перемещайте и не изменяйте файлы в `ref/`**. Рабочие копии 3D-ассетов лежат в `public/models/heart/`.
   - **Медицинская основа по выбору пользователя:** российские клинические рекомендации 2024 года по ИМпST и ОКСбпST из `ref/gudelines/` (публикации 2025 года). ACC/AHA пока служат сравнительным материалом в аудите. Не смешивать временные интервалы и критерии из разных документов. Ссылки, условия и критерии РФ для интерфейса находятся в `src/core/content/clinicalGuidelines.ts`.
3. **Команды Windows / PowerShell:** используйте неинтерактивные флаги и проверяйте изменения перед ответом:
   - **Текущий режим по решению пользователя от 23.11.2026: собираем только веб-версию.** Проверка типов, веб-сборка, профильные тесты и проверка интерфейса сохраняются. Android (включая `android:sync` и APK) и Windows Portable (`dist:win`) отложены до финального этапа или отдельного запроса пользователя; после обычных веб-правок их не запускать. Electron как инструмент проверки интерфейса допустим.
   - Проверка типов: `npx tsc --noEmit`
   - Сборка веба: `npm run build`
   - Dev-сервер: `npm run dev -- --port 5173`
   - Локальный запуск Electron: `npm run electron:start`
   - Сборка Windows Portable `.exe`: `npm run dist:win`
4. **Дополнительная документация:**
   - [docs/TRAINING.md](docs/TRAINING.md) — первый клинический случай, состояния попытки, хранение и проверки.
   - [docs/CORE.md](docs/CORE.md) — независимое ядро, публичные экспорты, структура сценариев и проверки границ.
   - [README.md](README.md) — обзор, возможности (ИМпST + ИМбпST) и структура.
   - [docs/CLINICAL_ENGINE.md](docs/CLINICAL_ENGINE.md) — математика ЭКГ, стадии, ИМбпST/Велленс/де Винтер, ЧКВ и локализатор.
   - [docs/3D_MODEL.md](docs/3D_MODEL.md) — анатомия `heart_segmented.glb`, координаты, ПКМ-панорамирование, подписи `ArteryLabel` и гайд для Houdini FX.
   - [docs/DESKTOP_BUILD.md](docs/DESKTOP_BUILD.md) — упаковка в автономный Windows Portable `.exe` на базе Electron.
   - [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md) — Android-оболочка Capacitor 8, сборка APK и проверка на устройстве.
   - [docs/IOS_PWA.md](docs/IOS_PWA.md) — офлайн-PWA для iPhone (Service Worker `sw.js`, иконки, GitHub Pages).
   - [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) — направление развития: общее ядро TypeScript, десктоп на Electron, мобильный интерфейс, Android Capacitor и офлайн-PWA для iOS.

---

## 2. Архитектура и поток данных

Вся синхронизация сосредоточена в едином источнике истины: верхнеуровневая маршрутизация режимов (`Атлас` / `Тренировка`, синхронизация с `window.history` и ленивый `React.lazy`) находится в `src/App.tsx`, а состояние атласа сосредоточено в `src/components/AtlasView.tsx`.

Целевые границы модулей описаны в `docs/ARCHITECTURE_ROADMAP.md`: медицинские данные, генератор и учебная логика отделены от React и платформенных адаптеров (`src/core/` и `src/platform/`). Новые расчёты не должны зависеть от DOM/Electron/Capacitor; медицинские условия случая отделяются от координат 3D-маркеров. Прототипы для Android (Capacitor 8) и iPhone (офлайн-PWA) уже подготовлены и ожидают проверки на физических устройствах.

```text
  [Вкладки ИМпST / ИМбпST или выбор кейса / Клик на 3D-сосуде] ──┐
                                                                  ├──▶ activeCaseId / manualStates
  [Клик по карточкам отведений ST↑ / ST↓ / T↓] ──────────────────┘          │
                                                                             ▼
                                                        localizeFromManualLeads() (если manualMode=true)
                                                                             │
                                                                             ▼
                                                               effectiveCaseId + dominance
                                                                             │
                                                        resolveCaseForDominance(effectiveCaseId, dominance)
                                                       (передаёт leads, category, lesionType, AHA-сегменты)
                                                                             │
        ┌──────────────────────┬─────────────────────────┬───────────────────┴─────┐
        ▼                      ▼                         ▼                         ▼
   Heart3D.tsx          AhaBullseye.tsx           LeadCardsPanel.tsx         EcgPaper.tsx
  (тромб/бляшка/стент, (17 сегм. ЛЖ + ПЖ,         (12+5 мини-ЭКГ,          LiveMonitor.tsx
   окраска TIMI 0..3    трансмур./субэндокард.)    ST↑/ST↓/T↓/dW T↑/T+/-)  (реал-тайм + лента)
   сосудов, КАГ)
```

Вторым сквозным параметром является динамика во времени:
- `timeline` (`0..1`) + `reperfused` (`boolean`) → `computeStageModifiers(timeline, reperfused)` → передаётся во все визуализаторы ЭКГ, в `TimelineBar.tsx` (с учётом `category` и `lesionType`) и в `Heart3D.tsx`.

---

## 3. Где что менять (быстрая карта задач)

| Задача | Какие файлы менять |
| :--- | :--- |
| Добавить новый сценарий ИМпST / ИМбпST / мимик | `src/core/types.ts` (`CaseId`), `src/core/content/coronaryCases.ts` (`CORONARY_CASES`, `CASE_ORDER`, привязки в `src/presentation/heartLandmarks.ts` и при необходимости `replacesBaseMarker`), `src/data/angiographyProjections.ts` (`CASE_OPTIMAL_PROJECTION`, `getOptimalProjectionForCase`), `src/presentation/segmentedHeart.ts` и `src/presentation/arteryLabels.ts`, `src/components/AtlasView.tsx` (`STEMI_CASES`/`NSTEMI_CASES`/`CHIP_LABELS`), при необходимости `src/core/ecg/localizer.ts` |
| Настроить морфологию волн (de Winter, Wellens, Sgarbossa, Brugada) | `src/core/types.ts` (`StShape`, `LeadShiftProfile`), `src/core/ecg/ecgEngine.ts` (`sampleBeatMv`, `getLeadBadge`) |
| Изменить стадии времени или эффект ЧКВ (TIMI 3) | `src/core/ecg/ecgEngine.ts` (`STAGE_PRESETS`, `NSTEMI_STAGE_SUMMARIES`, `DE_WINTER_STAGE_SUMMARIES`, `NATURAL_KEYFRAMES`, `REPERFUSED_KEYFRAMES`, `computeStageModifiers`), `src/components/TimelineBar.tsx` |
| Добавить отведения / поменять сетку бумаги или калипер | `src/components/EcgPaper.tsx`, `src/core/ecg/ecgEngine.ts` (`NORMAL_LEAD_BASE`) |
| Изменить 3D-проекции КАГ, ПКМ-панорамирование или подписи артерий | `src/data/angiographyProjections.ts`, `src/utils/cArmMath.ts`, `src/components/CArmDiagram.tsx`, `src/components/Heart3D.tsx` (`ArteryLabel`, `CameraRig`, `LabelMode`), `src/presentation/segmentedHeart.ts`, `src/presentation/arteryLabels.ts` |
| Заменить 3D-модель сердца (напр., `.glb` из Houdini) | `public/models/heart/`, `src/components/Heart3D.tsx` (см. `docs/3D_MODEL.md`) |
| Обновить сборку Windows `.exe` (Electron) | `electron/main.cjs`, `package.json` (`build`, `scripts`), `build/icon.ico` (см. `docs/DESKTOP_BUILD.md`) |

---

## 4. Критические инварианты и известные грабли (обязательно к прочтению!)

### A. Rules of Hooks в `LeadCardsPanel.tsx`
- **Никогда** не вызывайте `useMemo` / `useEffect` / `useState` внутри функций-рендереров (например, `renderCard`), которые вызываются разное количество раз при раскрытии/сворачивании секции `Доп. отведения (V3R–V4R, V7–V9)`.
- Каждая карточка отведения **должна** оставаться отдельным компонентом (`<LeadCard />`). Нарушение этого правила уже вызывало падение React (`Rendered more hooks than during the previous render`) при переключении с `lad_prox` на `rca_prox`.

### B. Загрузка `heart_segmented.glb` (`Heart3D.tsx`)
- Текущая модель — `public/models/heart/heart_segmented.glb` (14 мешей, 90 234 треугольника). `GLTFLoader` загружает её один раз через `${import.meta.env.BASE_URL}models/heart/heart_segmented.glb`; цвета сохранены в `COLOR_0`. Старые `heart_optimized.glb` и `heart_diffuse.webp` — архивные ассеты.
- **Не передавать изменяемые при вращении камеры значения, например `liveAngles`, в `<HeartCanvasViewport>`**; стабилизировать `onLoaded` через ref, чтобы поворот С-дуги не перезапускал загрузку или ререндер Canvas.

### C. Координаты модели и маркеры
- Именованные артериальные сегменты и исходные локальные координаты хранятся в GLB. Ориентиры — `src/presentation/heartSegmentGeometry.ts`, маркеры случаев — `src/presentation/heartLandmarks.ts`. После экспорта обновить ориентиры `node scripts/prepare-segmented-heart.mjs` и проверить `npm run test:heart`.
- Мировые позиции маркеров вычисляются через `targetMesh.localToWorld(...)` **после** центрирования и масштабирования корневой группы и `wrapper.updateMatrixWorld(true)`.
- Границы сегментов и анатомическую корректность авторской разметки необходимо проверять отдельно: совпадение маркера с вершиной не доказывает анатомическую точность.

### D. Раскраска (`vertexColors`) и производительность WebGL
- `src/presentation/segmentedHeart.ts` сопоставляет случаи с именованными артериальными сегментами; подписи сосудов находятся в `src/presentation/arteryLabels.ts`. Артерии используют 4-компонентный RGBA и заранее созданные материалы анатомии и КАГ. Исходный цвет `Cd` сохраняется и восстанавливается при нормальном кровотоке; при окклюзии дистальный сегмент серый.
- В КАГ полупрозрачный материал с `depthWrite: false` позволяет скрыть другой бассейн и дистальное русло при TIMI 0. Вершинные цвета пересчитываются в `useEffect`, а в `useFrame` — только при короткой анимации болюса.
- Модель имеет объединённый `heart_body` без разметки AHA и отдельного слоя вен. Поверхность 3D не окрашивается по зонам миокарда; поражение миокарда показывается на AHA-схеме. Геометрия праводоминантная, переключение левого типа условное.

### E. Разделение логики ручного и пресетного режимов
- `localizeFromManualLeads()` возвращает `primaryCaseId: null` при недостаточной разметке; это **не** заключение о норме. В таком случае показываются ручные изменения ЭКГ, а анатомия и диагноз пресета скрыты. Числовой «уверенности» нет. Велленс A и де Винтер доступны как пресеты, но не распознаются автоматически по одному ST↑/ST↓/T↓ без ввода необходимой морфологии.
- Рекомендованные доп. отведения в ручном режиме берутся из результата локализатора, в том числе при отсутствии гипотезы. Неотмеченные отведения — «не оценено». После изменений локализатора запускать `npm run test:clinical`.
- Когда `manualMode === true`, в `AtlasView.tsx` итоговый профиль отведений строится как `{ ...resolvedCase.leads, ...buildManualFallbackLeads(manualStates) }`. Это гарантирует, что:
  1. 12-канальная ЭКГ мгновенно отражает каждый клик пользователя (`ST↑` / `ST↓` / `T↓`), даже если он отметил нестандартную комбинацию.
  2. Одновременно остальные отведения заполняются контекстом наиболее вероятной ИСА из локализатора.

### F. 3D-подписи (`ArteryLabel`), панорамирование ПКМ (`CameraRig`) и дедупликация маркеров
- **Никогда не используйте `distanceFactor` на `<Html>` из `@react-three/drei`** — при текущей геометрии сцены он раздувает плашки в `2–5×` и залипает при зуме к центру. Для подписей используется [`ArteryLabel`](src/components/Heart3D.tsx), обновляющий `node.style.transform = scale(...)` в `useFrame` (диапазон `0.7×–1.25×`). **Не прописывайте свойство `transform` в `BADGE_SCALE_STYLE`**, иначе React-ререндеры при смене `className`/`text` сбросят вычисленный масштаб.
- В [`CameraRig`](src/components/Heart3D.tsx) углы С-дуги и текущий радиус обязаны вычисляться по относительному вектору `camera.position - controls.target` (а не от `(0,0,0)`), иначе панорамирование ПКМ искажает углы `LAO/RAO` и `CRA/CAU`. При ограничении сдвига `MAX_PAN_RADIUS = 2.1` нужно смещать и `controls.target`, и `camera.position` на одинаковую дельту.
- При добавлении сценариев ИМбпST на уже занятый участок сосуда (`wellens_a`, `wellens_b`, `de_winter`, `nstemi_antlat`, `nstemi_tinv`, `nstemi_inf`) обязательно задавайте `replacesBaseMarker` в `src/presentation/heartLandmarks.ts` (`OcclusionLandmark`), чтобы на 3D-сцене не рисовались две наложенные сферы.

### G. Сборка десктопного Windows `.exe` (`electron/main.cjs`)
- `Heart3D.tsx` и сборка Vite используют относительную базу `base: './'` (`import.meta.env.BASE_URL`), что работает при открытии `app://localhost/index.html` в Electron, а не через `file://`. Поэтому главный процесс [`electron/main.cjs`](electron/main.cjs) регистрирует привилегированную схему `app://localhost/...` (`protocol.registerSchemesAsPrivileged` строго до `app.whenReady()`) и отдаёт файлы из `dist/` с явными MIME-типами и проверкой path traversal.
- На финальном этапе или по отдельному запросу пользователя пересборка портативного `.exe` выполняется командой `npm run dist:win` (результат — `release/CardioAtlas-ECG-1.0.0-Portable.exe`). При текущей работе только над веб-версией эту сборку не запускать. Подробнее см. [docs/DESKTOP_BUILD.md](docs/DESKTOP_BUILD.md).

---

### H. Реперы и интервалы генератора ЭКГ
- `getBeatTiming()` — единый источник границ P/QRS/J/T и подписей PR/QRS/QT. Не подставлять интервалы или ЭОС по названию сценария независимо от сигнала.
- `getJShiftMm()` используется и в кривой, и в бейджах; в J без артефактов итоговый потенциал обязан равняться этой величине / 10.
- После изменения генератора выполнять `npm run test:ecg`. Проверять направление ST на суммарной кривой и перенос T через RR при высокой ЧСС.

### I. Независимое ядро и сценарии
- `src/core/index.ts` — публичный интерфейс ядра; внутри `src/core/` разрешены только относительные импорты других файлов ядра. React, DOM, Electron, Three.js и платформенное хранение в ядро не входят.
- Клинические профили — `src/core/content/coronaryCases.ts`; координаты и замена 3D-маркеров — `src/presentation/heartLandmarks.ts`. Поле `landmark` из `CoronaryCase` удалено.
- `src/core/scenarios/` содержит типы, каталог 16 примеров атласа и проверку связности. Полный клинический случай имеет отдельный тип `clinical-case`; не добавляйте пациентские данные существующим примерам без авторского описания.
- Изменения ядра проверять `npm run test:core`, `npm run test:ecg`, `npm run test:clinical`. `tsconfig.core.json` исключает DOM и глобальные типы Node.js.
- Старые пути `src/ecg/`, `src/types/ecg.ts`, `src/data/coronaryCases.ts` и `src/data/clinicalGuidelines.ts` оставлены как реэкспорты совместимости. Новые импорты должны ссылаться на ядро.

### J. Режим обучения и попытки
- `firstCase.ts` содержит авторский случай; переходы и оценка находятся в `src/core/scenarios/training.ts`, доступ к localStorage — только в `src/platform/trainingStorage.ts`.
- Экран получает `getTrainingView()`: будущие этапы и итоговый разбор до завершения не выводятся. Вопрос нельзя пропустить или исправить после фиксации. Ошибочный ответ допускает продолжение с разбором.
- При восстановлении проверять идентификатор, редакцию, версию схемы, допустимые ответы и последовательность этапов. Не доверять сохранённой числовой оценке; она пересчитывается.
- В учебной ЭКГ `lockedClinicalSettings` фиксирует ЧСС и доступность дополнительных отведений; скорость, усиление, масштаб и калипер остаются доступными.
- После изменения обучения выполнять `npm run test:training`; `scripts/verify-ui.cjs` проверяет прохождение с ошибкой, восстановление ответа/результата, новую попытку и переход в атлас.

### K. Калипер и узкий экран
- Рамка калипера хранится в миллиметрах бумаги. При зуме измерение сохраняется, при смене скорости/усиления/раскладки/сигнала сбрасывается.
- Используются Pointer Events и захват активного указателя. Двухпальцевый жест масштабирует ленту с сохранением точки под пальцами и измерения; `touchAction: none` включается для активного калипера, в обычном режиме разрешена прокрутка по обеим осям.
- `scripts/verify-ui.cjs` проверяет экран 390 px и касание через Chromium: увеличение и уменьшение двумя пальцами, в том числе с калипером, и сохранение 1000 мс / 1 мВ. Это не заменяет проверку жеста на телефоне.

### L. Android-оболочка
- Конфигурация — `capacitor.config.json`, проект — `android/`, инструкция — `docs/ANDROID_BUILD.md`. `server.url` в локальной сборке запрещён: интерфейс и модель должны попадать в APK.
- На финальном этапе Android или по отдельному запросу пользователя `npm run android:sync` обновляет ресурсы и сравнивает их с `dist`. При текущей работе только над веб-версией синхронизацию не запускать. Не редактировать копии `android/app/src/main/assets/public` вручную.
- Определение платформы находится в `src/platform/runtime.ts`; мобильная оболочка (и установленная PWA) начинает с тренировки (`preferTrainingHome`). В ядро Capacitor не импортировать.
- `MainActivity.java` обрабатывает системную кнопку/жест «Назад» через `OnBackPressedCallback` в связке с `window.history` в `App.tsx` и `TrainingPanel.tsx`.
- Проверка ресурсов и Chromium не подтверждают работу APK. Сборка требует JDK 21 и SDK Platform 36; проверка телефона описана в инструкции.

### M. Офлайн-PWA для iPhone и GitHub Pages
- В `vite.config.ts` задана относительная база `base: './'` и плагин `cardioAtlasPwaPlugin()`, генерирующий `dist/sw.js` с хэшем контента и полным precache `dist/`. Не используйте абсолютные пути вида `/models/...` или `/icons/...` — только `./...` или `import.meta.env.BASE_URL`, иначе деплой на подпуть `/infarct_miocard_ecg/` сломается.
- `registerPwaServiceWorker()` в `src/platform/pwa.ts` регистрирует `./sw.js` только в production при `https:` / `localhost` (пропуская Vite dev, Electron `app:` и `isNativeMobile`).
- `viewport-fit=cover` в `index.html` требует сохранения `.safe-top`, `.safe-bottom` и `.safe-x` в `src/index.css` (это также затрагивает `SystemBars` на Android WebView >= 140). Подробнее см. [docs/IOS_PWA.md](docs/IOS_PWA.md).

## 5. Чек-лист перед завершением любой правки

1. `npx tsc --noEmit` — 0 ошибок.
2. `npm run build` — успешная сборка `dist/`, наличие `dist/models/heart/heart_segmented.glb`.
3. Визуальная проверка в браузере (`http://localhost:5173/`):
   - 0 ошибок в консоли и 0 404-запросов в Network.
   - Переключение между кейсами с пустым `recommendedExtraLeads` (например, `lad_prox`) и с непустым (`rca_prox`, `lcx`, `posterior`, `nstemi_inf`) не вызывает ошибок хуков.
   - Переключение вкладок `ИМпST (STEMI)` ↔ `ИМбпST (NSTEMI)`, 3-й клик `T↓` в ручном локализаторе и кнопка `Сброс` работают корректно.
   - Панорамирование ПКМ смещает 3D-сердце без появления контекстного меню и без изменения углов С-дуги, кнопка `Центр` возвращает сердце в центр; кнопка подписей переключается по кругу `Подпись` → `Подписи выкл.` → `Все подписи`.
   - Слайдер времени, тумблер `ЧКВ / Реперфузия` и переключатель `Правый / Левый` тип корректно синхронизируют 3D-сердце, Bullseye и ЭКГ-бумагу.
