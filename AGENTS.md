# AGENTS.md — Руководство для ИИ-агентов

Этот файл содержит критические правила, архитектуру, инварианты и подводные камни проекта **КардиоАтлас ЭКГ** (`c:\_proekty\python\ECG_education`), чтобы любой ИИ-агент мог безопасно и быстро дорабатывать проект.

---

## 1. Общие правила работы в репозитории

1. **Язык:** весь пользовательский интерфейс, клинические тексты, комментарии в коде и документация ведутся **на русском языке**. Медицинские сокращения артерий дублируются в привычном врачам виде: `ПМЖВ (LAD)`, `ОВ (LCx)`, `ПКА (RCA)`, `Ствол ЛКА (LMCA)`, `ВТК (OM1)`, `ЗМЖВ (PDA)`.
2. **Папка `ref/` неприкосновенна:** внутри `ref/` лежат исходные видеореференсы и оригинальный архив 3D-модели. **Не удаляйте, не перемещайте и не изменяйте файлы в `ref/`**. Рабочие копии 3D-ассетов лежат в `public/models/heart/`.
   - **Медицинская основа по выбору пользователя:** российские клинические рекомендации 2024 года по ИМпST и ОКСбпST из `ref/gudelines/` (публикации 2025 года). ACC/AHA пока служат сравнительным материалом в аудите. Не смешивать временные интервалы и критерии из разных документов. Ссылки, условия и критерии РФ для интерфейса находятся в `src/core/content/clinicalGuidelines.ts`.
3. **Команды Windows / PowerShell:** используйте неинтерактивные флаги и проверяйте изменения перед ответом:
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
   - [docs/3D_MODEL.md](docs/3D_MODEL.md) — анатомия `heart_optimized.glb`, координаты, ПКМ-панорамирование, подписи `ArteryLabel` и гайд для Houdini FX.
   - [docs/DESKTOP_BUILD.md](docs/DESKTOP_BUILD.md) — упаковка в автономный Windows Portable `.exe` на базе Electron.
   - [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) — направление развития: общее ядро TypeScript, десктоп на Electron, отдельный мобильный интерфейс; Capacitor пока кандидат для прототипа.

---

## 2. Архитектура и поток данных

Вся синхронизация сосредоточена в едином источнике истины — состоянии в `src/App.tsx`:

Это текущая реализация. Целевые границы модулей описаны в `docs/ARCHITECTURE_ROADMAP.md`: постепенно отделяем медицинские данные, генератор и учебную логику от React и платформенных адаптеров. Новые расчёты не должны зависеть от DOM/Electron; медицинские условия случая отделяем от координат 3D-маркеров. Мобильная версия ещё не реализована; технологию её упаковки подтвердит прототип на устройстве.

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
   и миокарда, КАГ)
```

Вторым сквозным параметром является динамика во времени:
- `timeline` (`0..1`) + `reperfused` (`boolean`) → `computeStageModifiers(timeline, reperfused)` → передаётся во все визуализаторы ЭКГ, в `TimelineBar.tsx` (с учётом `category` и `lesionType`) и в `Heart3D.tsx`.

---

## 3. Где что менять (быстрая карта задач)

| Задача | Какие файлы менять |
| :--- | :--- |
| Добавить новый сценарий ИМпST / ИМбпST / мимик | `src/core/types.ts` (`CaseId`), `src/core/content/coronaryCases.ts` (`CORONARY_CASES`, `CASE_ORDER`, привязки в `src/presentation/heartLandmarks.ts` и при необходимости `replacesBaseMarker`), `src/data/angiographyProjections.ts` (`CASE_OPTIMAL_PROJECTION`), `src/components/Heart3D.tsx` (`LCA_CASE_SET`, `isVertexDistalToOcclusion`), `src/App.tsx` (`STEMI_CASES`/`NSTEMI_CASES`/`CHIP_LABELS`), при необходимости `src/core/ecg/localizer.ts` |
| Настроить морфологию волн (de Winter, Wellens, Sgarbossa, Brugada) | `src/core/types.ts` (`StShape`, `LeadShiftProfile`), `src/core/ecg/ecgEngine.ts` (`sampleBeatMv`, `getLeadBadge`) |
| Изменить стадии времени или эффект ЧКВ (TIMI 3) | `src/core/ecg/ecgEngine.ts` (`STAGE_PRESETS`, `NSTEMI_STAGE_SUMMARIES`, `NATURAL_KEYFRAMES`, `REPERFUSED_KEYFRAMES`, `computeStageModifiers`), `src/components/TimelineBar.tsx` |
| Добавить отведения / поменять сетку бумаги или калипер | `src/components/EcgPaper.tsx`, `src/core/ecg/ecgEngine.ts` (`NORMAL_LEAD_BASE`) |
| Изменить 3D-проекции КАГ, ПКМ-панорамирование или подписи артерий | `src/data/angiographyProjections.ts`, `src/utils/cArmMath.ts`, `src/components/CArmDiagram.tsx`, `src/components/Heart3D.tsx` (`ArteryLabel`, `CameraRig`, `LabelMode`, `isVertexDistalToOcclusion`, `classifyMyocardiumVertex`) |
| Заменить 3D-модель сердца (напр., `.glb` из Houdini) | `public/models/heart/`, `src/components/Heart3D.tsx` (см. `docs/3D_MODEL.md`) |
| Обновить сборку Windows `.exe` (Electron) | `electron/main.cjs`, `package.json` (`build`, `scripts`), `build/icon.ico` (см. `docs/DESKTOP_BUILD.md`) |

---

## 4. Критические инварианты и известные грабли (обязательно к прочтению!)

### A. Rules of Hooks в `LeadCardsPanel.tsx`
- **Никогда** не вызывайте `useMemo` / `useEffect` / `useState` внутри функций-рендереров (например, `renderCard`), которые вызываются разное количество раз при раскрытии/сворачивании секции `Доп. отведения (V3R–V4R, V7–V9)`.
- Каждая карточка отведения **должна** оставаться отдельным компонентом (`<LeadCard />`). Нарушение этого правила уже вызывало падение React (`Rendered more hooks than during the previous render`) при переключении с `lad_prox` на `rca_prox`.

### B. Загрузка `heart_optimized.glb` и текстуры `heart_diffuse.webp` (`Heart3D.tsx`)
- Модель в `public/models/heart/heart_optimized.glb` сконвертирована из оптимизированной сцены Houdini скриптом `scripts/convert_geo_to_glb.py` и загружается через `GLTFLoader` ровно один раз (`useEffect(..., [])` с полным `dispose()` в cleanup).
- В качестве диффузной карты используется `/models/heart/heart_diffuse.webp` (`1024×1024` WebP, `colorSpace = THREE.SRGBColorSpace`). Поскольку UV-координаты в `.glb` записаны по стандарту glTF 2.0 (`v=0` вверху), **обязательно сохранять `diffuseTex.flipY = false`**.
- **Никогда не прокидывайте изменяемые при вращении камеры пропсы/состояние (например, `liveAngles`) в `<HeartCanvasViewport>`** и сохраняйте стабильный `onLoaded` через `ref`, чтобы поворот С-дуги не перезапускал загрузку или ререндер Canvas.

### C. Локальные координаты `heart_optimized.glb` и `Box3`
- Лёгочные сосудистые деревья удалены на уровне оптимизированной геометрии (пропущено 7 остаточных полигонов `LPV_MiCorazon_0`), но исходные сырые координаты вершин (`[-5000..+5000]`) в `.glb` сохранены 1-в-1 относительно оригинальной модели.
- Поэтому:
  1. Функции `isVertexDistalToOcclusion()` и предрасчёт `classifyMyocardiumVertex()` (выполняется 1 раз при загрузке в `myoCacheRef` `Uint8Array`) работают с **исходными локальными координатами геометрии `.glb`**.
  2. Мировые позиции для кликабельных 3D-маркеров (`landmarks`) **обязаны** вычисляться через `targetMesh.localToWorld(...)` **только после** центрирования, масштабирования корневой группы и вызова `wrapper.updateMatrixWorld(true)`.

### D. Вертексная раскраска (`vertexColors`) и производительность WebGL
- Артерии (`LCA_MiCorazon_0`, `CA_MiCorazon_0`) используют **4-компонентный буфер RGBA** (`itemSize = 4`) и хранят пару заранее созданных материалов (`mesh.userData.anatMat` для режима Анатомия 3D и `mesh.userData.angioMat` для режима КАГ).
- В режиме `Анатомия 3D` материал артерий непрозрачный (`transparent: false`), а в режиме `КАГ (С-дуга)` используется `MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })` — это позволяет чисто отсекать чужой бассейн и дистальное русло при `TIMI 0` («культя» обрыва контраста) через альфа-канал.
- Миокард (`HS_1_MiCorazon_0`, `HS_2_Difumina_0`) в режиме Анатомия использует `map: diffuseTex` + `vertexColors: true` (3-компонентный буфер), а в режиме КАГ переключается на полупрозрачную рентгеновскую тень (`depthWrite: false`).
- **Пересчёт вертексных цветов делается в `useEffect`** при смене параметров, а в `useFrame` допускается только во время короткой (~1.7 с) анимации болюса контраста (`bolusAnimatingRef.current === true`).

### E. Разделение логики ручного и пресетного режимов
- `localizeFromManualLeads()` возвращает `primaryCaseId: null` при недостаточной разметке; это **не** заключение о норме. В таком случае показываются ручные изменения ЭКГ, а анатомия и диагноз пресета скрыты. Числовой «уверенности» нет. Велленс A и де Винтер доступны как пресеты, но не распознаются автоматически по одному ST↑/ST↓/T↓ без ввода необходимой морфологии.
- Рекомендованные доп. отведения в ручном режиме берутся из результата локализатора, в том числе при отсутствии гипотезы. Неотмеченные отведения — «не оценено». После изменений локализатора запускать `npm run test:clinical`.
- Когда `manualMode === true`, в `App.tsx` итоговый профиль отведений строится как `{ ...resolvedCase.leads, ...buildManualFallbackLeads(manualStates) }`. Это гарантирует, что:
  1. 12-канальная ЭКГ мгновенно отражает каждый клик пользователя (`ST↑` / `ST↓` / `T↓`), даже если он отметил нестандартную комбинацию.
  2. Одновременно остальные отведения заполняются контекстом наиболее вероятной ИСА из локализатора.

### F. 3D-подписи (`ArteryLabel`), панорамирование ПКМ (`CameraRig`) и дедупликация маркеров
- **Никогда не используйте `distanceFactor` на `<Html>` из `@react-three/drei`** — при текущей геометрии сцены он раздувает плашки в `2–5×` и залипает при зуме к центру. Для подписей используется [`ArteryLabel`](src/components/Heart3D.tsx), обновляющий `node.style.transform = scale(...)` в `useFrame` (диапазон `0.7×–1.25×`). **Не прописывайте свойство `transform` в `BADGE_SCALE_STYLE`**, иначе React-ререндеры при смене `className`/`text` сбросят вычисленный масштаб.
- В [`CameraRig`](src/components/Heart3D.tsx) углы С-дуги и текущий радиус обязаны вычисляться по относительному вектору `camera.position - controls.target` (а не от `(0,0,0)`), иначе панорамирование ПКМ искажает углы `LAO/RAO` и `CRA/CAU`. При ограничении сдвига `MAX_PAN_RADIUS = 2.1` нужно смещать и `controls.target`, и `camera.position` на одинаковую дельту.
- При добавлении сценариев ИМбпST на уже занятый участок сосуда (`wellens_a`, `wellens_b`, `de_winter`, `nstemi_antlat`, `nstemi_tinv`, `nstemi_inf`) обязательно задавайте `replacesBaseMarker` в `src/presentation/heartLandmarks.ts` (`OcclusionLandmark`), чтобы на 3D-сцене не рисовались две наложенные сферы.

### G. Сборка десктопного Windows `.exe` (`electron/main.cjs`)
- `Heart3D.tsx` загружает ассеты по абсолютным путям (`/models/heart/...`), что не работает через `file://`. Поэтому главный процесс [`electron/main.cjs`](electron/main.cjs) регистрирует привилегированную схему `app://localhost/...` (`protocol.registerSchemesAsPrivileged` строго до `app.whenReady()`) и отдаёт файлы из `dist/` с явными MIME-типами и проверкой path traversal.
- После изменений в веб-части пересборка портативного `.exe` выполняется командой `npm run dist:win` (результат — `release/CardioAtlas-ECG-1.0.0-Portable.exe`). Подробнее см. [docs/DESKTOP_BUILD.md](docs/DESKTOP_BUILD.md).

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
- После изменений веб-части `npm run android:sync` обновляет ресурсы и сравнивает их с `dist`. Не редактировать копии `android/app/src/main/assets/public` вручную.
- Определение платформы находится в `src/platform/runtime.ts`; мобильная оболочка начинает с тренировки. В ядро Capacitor не импортировать.
- Проверка ресурсов и Chromium не подтверждают работу APK. Сборка требует JDK 21 и SDK Platform 36; проверка телефона описана в инструкции.

## 5. Чек-лист перед завершением любой правки

1. `npx tsc --noEmit` — 0 ошибок.
2. `npm run build` — успешная сборка `dist/`, наличие `dist/models/heart/heart_optimized.glb` и `heart_diffuse.webp`.
3. Визуальная проверка в браузере (`http://localhost:5173/`):
   - 0 ошибок в консоли и 0 404-запросов в Network.
   - Переключение между кейсами с пустым `recommendedExtraLeads` (например, `lad_prox`) и с непустым (`rca_prox`, `lcx`, `posterior`, `nstemi_inf`) не вызывает ошибок хуков.
   - Переключение вкладок `ИМпST (STEMI)` ↔ `ИМбпST (NSTEMI)`, 3-й клик `T↓` в ручном локализаторе и кнопка `Сброс` работают корректно.
   - Панорамирование ПКМ смещает 3D-сердце без появления контекстного меню и без изменения углов С-дуги, кнопка `Центр` возвращает сердце в центр; кнопка подписей переключается по кругу `Подпись` → `Подписи выкл.` → `Все подписи`.
   - Слайдер времени, тумблер `ЧКВ / Реперфузия` и переключатель `Правый / Левый` тип корректно синхронизируют 3D-сердце, Bullseye и ЭКГ-бумагу.
