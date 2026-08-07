# Сессия разработки — 2026-08-07

## Текущий контекст

Работа ведётся в репозитории **InvoltCAD-web**, ветка `main`.
Последний коммит: будет обновлён после сохранения шага 16.

## Что сделано в этой сессии

### Панель листов: отдельная кнопка «Штамп»
- `src/components/editor/SheetsBar.ts`:
  - Слева от вкладок листов добавлена кнопка **«Штамп»**.
  - По клику открывается отдельное меню с полями основной надписи активного листа.
  - Выпадающее меню каждого листа теперь содержит только **Формат**, **Ориентация**, **Масштаб**.
- `src/components/editor/icons.ts`: добавлена иконка `stamp`.
- `src/app/globals.css`: добавлены стили `.sheet-stamp-btn` и `.stamp-menu`.

### Заполняемые поля штампа (столбец 2)
- `packages/core/model/Sheet.ts`:
  - В `SheetTitleBlock` добавлены поля **ГИП** (`gip`) и **Согласовал** (`reviewer`).
  - Добавлен объект `TitleBlockVisibility` с флагами видимости для каждой графы.
  - `createEmptyTitleBlock()` инициализирует `show` со всеми флагами `true`.
- `packages/core/model/Plan.ts`:
  - `fromJSON` корректно мерджит `titleBlock.show` с дефолтными значениями.
- `packages/core/render/SheetFrameRenderer.ts`:
  - В объединённых столбцах **3–4** (столбец 2) строк 1–6 отрисовываются значения:
    - Утвердил, Н. контр., ГИП, Проверил, Согласовал, Разработал.
  - Добавлена базовая отрисовка граф 1–5, 9 и правой части (Стадия/Лист/Листов, Масса/Масштаб) с учётом флагов видимости.
  - Жёсткие подписи в столбцах 1–2 (Н.контр., ГИП, Разраб.) тоже учитывают флаги видимости.
  - Добавлены остальные жёсткие подписи в столбцах 1–2:
    - строка 1 — **Утвердил**
    - строка 4 — **Проверил**
    - строка 5 — **Согласовал**
  - В столбце 6 (Дата) строк 1–6 отрисовывается поле **Дата** в формате **мм.гг** (например, 08.26).
  - Добавлены поля подписей (`signature*`) и флаги видимости строк (`row1..row6`).
  - Checkbox в меню «Штамп» рядом с каждой ролью управляет видимостью всей строки: роль / фамилия / подпись / дата.
  - Добавлены поля основного поля:
    - **Наименование** — левая часть основного поля, строки 1–3 (70×15 мм), по центру.
    - **Раздел** — левая часть основного поля, строки 4–6 (70×15 мм), по центру.
    - **Адрес** — столбец 7, строки 7–9 (20×15 мм), по центру.
    - **№ проекта / Шифр** — столбец 7, строки 10–11 (верхнее поле 20×10 мм), по центру.
- `src/components/editor/SheetsBar.ts`:
  - Меню «Штамп» содержит поля: № проекта / Шифр, Адрес, Раздел, Наименование, Стадия, Дата, Утвердил, Н. контр., ГИП, Проверил, Согласовал, Разработал.
  - Поле **Стадия** отрисовывается в левом подстолбце правой части (15×10 мм), в объединённых строках 4–5, по центру.
  - Убрана отрисовка **Лист** / **Листов** (числа 1 и 1 в строке 6 правой части).
  - Рядом с каждым полем добавлен **checkbox** для включения/выключения отображения в штампе.
  - Checkbox у ролей включает/выключает строку целиком (столбцы 1–4 левой группы).

### Проверки
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Сессия сохранена в коммите `37c65b3` (`fix(sheet-frame): Стадия смещена в левый подстолбец правой части, по центру`).

## Следующие шаги

1. Доработать позиционирование и размер шрифта для длинных значений в ячейках штампа.
2. Ручное тестирование в браузере (скриншоты Playwright временно не сохраняются из-за прерывания потока провайдера).

## Предыдущие сессии

# Сессия разработки — 2026-08-06 (продолжение)

## Текущий контекст

Работа ведётся в репозитории **InvoltCAD-web**, ветка `main`.
Последний коммит: будет обновлён после сохранения шага 14.

## Что сделано в этой сессии

### Поэтапная сборка штампа ГОСТ Р 21.101-2020, форма 3
- `packages/core/render/SheetFrameRenderer.ts` переписан пошагово с нуля:
  - **Шаг 1**: общий каркас штампа **185×55 мм**.
  - **Шаг 2**: 11 строк по 5 мм, левая группа столбцов **10+10+10+10+15+10 = 65 мм**, основное поле **120 мм**.
  - **Шаг 3–4**: в левой группе столбцы **1–2** и **3–4** объединены в строках 1–6 (снизу вверх).
  - **Шаг 5**: в основном поле строки **10–11** (верхние) объединены в одну ячейку шириной 120 мм.
  - **Шаг 6**: в основном поле строки **7–9** объединены в одну ячейку шириной 120 мм.
  - **Шаг 7–8**: в левой части основного поля (**70 мм**) строки **4–6** и строки **1–3** объединены в отдельные ячейки.
  - **Шаг 9**: в правой части основного поля (**50 мм**) строки **1–3** объединены в одну ячейку.
  - **Шаг 10**: в строках 4–6 правой части добавлены вертикальные границы **15+15+20 мм**.
  - **Шаг 11**: в правой части строки **4–5** объединены во всех трёх подстолбцах.
  - **Шаг 12**: строки **10–11** и **7–9** объединены по всей ширине 120 мм основного поля.
  - **Шаг 13**: добавлены некорректируемые заголовки левой группы: **Изм.**, **Кол.уч.**, **Лист**, **№док.**, **Подп.**, **Дата** в строке 7 (снизу), столбцы 1–6. Шрифт **2,5 мм**, sans-serif, по центру.
  - **Шаг 14**: добавлены неизменяемые заголовки правой части: **Стадия**, **Лист**, **Листов** в строке 6 (снизу), подстолбцы 15+15+20 мм. Шрифт **2,5 мм**, sans-serif, по центру.
  - **Шаг 15**: добавлены некорректируемые подписи в объединённых столбцах **1–2** левой группы:
    - строка 2 — **Н.контр.**
    - строка 3 — **ГИП**
    - строка 6 — **Разраб.**
    Шрифт **2,5 мм**, sans-serif, по центру.

### Проверки
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Скриншот текущего состояния: `tmp/editor-sheet-a3.png`.
  - Горизонтальные разделители основного поля: y+10, y+25, y+35, y+50.
  - Правая верхняя зона (Стадия/Лист/Листов): подписи в зоне 2, значения в зоне 3, разделители 15+15+20 мм.
  - Зона 4 — подписи (Разраб./Пров./Н. контр./Утв.).
  - Зона 9 — масштаб.
  - Нижняя строка «Формат» на всю ширину штампа.
- `packages/core/render/SheetFrameRenderer.ts`:
  - Верхняя зона основного поля (зона 1) теперь единая на всю ширину 120 мм — убрана лишняя вертикальная перегородка.
  - Левая группа колонок больше не разбита на 11 мелких строк: оставлены только горизонтальные линии, совпадающие с зонами основного поля (10+15+10+15+5 мм).
  - Заголовки левой группы центрированы в верхней строке высотой 10 мм.
  - Правая верхняя зона (Стадия / Лист / Листов) объединена в единый блок 50×25 мм: заголовки вверху, значения по центру блока; убрана промежуточная горизонтальная линия между заголовками и значениями.
  - Левая зона 3 (70×10 мм) теперь отдельно от правой верхней зоны.
  - Правая граница левой группы и граница левой/правой части основного поля проведены ровно по заданным размерам.

### Проверки
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Скриншот A3 landscape сохранён в `tmp/editor-sheet-a3.png`.

## Предыдущие сессии

# Сессия разработки — 2026-08-06 (продолжение)

## Текущий контекст

Работа ведётся в репозитории **InvoltCAD-web**, ветка `main`.
Последний коммит: `refactor(sheet-frame): штамп по ГОСТ Р 21.101-2020, приложение Ж, форма 3`.

## Что сделано в этой сессии

### Переделан штамп по ГОСТ Р 21.101-2020, приложение Ж, форма 3
- `packages/core/render/SheetFrameRenderer.ts`:
  - Штамп теперь 185×55 мм.
  - Левая группа учёта изменений: 10+10+10+10+15+10 = 65 мм, заголовки: Изм., Кол.уч., Лист, № док., Подп., Дата.
  - Основное поле: 120 мм (70 мм левая часть + 50 мм правая часть).
  - Высотные зоны основного поля: 10+15+10+15+5 = 55 мм.
  - Правая верхняя зона: Стадия / Лист / Листов (15+15+20 мм).
  - Правая нижняя зона: Масштаб (50×15 мм).
  - Нижняя строка «Формат» на всю ширину штампа.
  - Линии штампа утолщены (0.35–0.5 мм), чтобы хорошо было видно на canvas.
  - Текст центрирован в ячейках.

### Проверки
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Скриншот A3 landscape сохранён в `tmp/editor-sheet-a3.png`.

## Предыдущие сессии

# Сессия разработки — 2026-08-06 (продолжение)

## Текущий контекст

Работа ведётся в репозитории **InvoltCAD-web**, ветка `main`.
Последний коммит: будет обновлён после правок зума рамки листа.

## Что сделано в этой сессии

### Исправлен zoom колесиком при активной рамке листа
- `packages/core/engine/Camera.ts`:
  - Добавлены `setScaleLimits(min, max)`, `getMinScale()`, `getMaxScale()`.
  - При обновлении лимитов текущий `scale` подтягивается к новому диапазону.
- `packages/core/engine/CanvasEngine.ts`:
  - Добавлен `updateCameraScaleLimits()` — динамический `minScale` по размеру активного листа.
  - Рамка листа теперь не ограничивает зум: минимальный масштаб выбирается так, чтобы вся рамка (например, A3) помещалась на экране с запасом.
  - Метод вызывается при `resize()` и `notifyChanged()`.
- `packages/core/render/SheetFrameRenderer.ts`:
  - Убран лишний пробел в подписи рамки (`' landscape'` → `'landscape'`).
- `src/components/editor/SheetsBar.ts`:
  - Исправлен невалидный HTML: кнопка меню внутри кнопки заменена на `<span role="button" tabindex="0">`.
  - Добавлена обработка `keydown` (Enter/Space) для доступности.

### Проверки
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Через Playwright проверен зум: при формате A3 масштаб камеры уменьшается с `0.038` до динамического `minScale ~0.010`, колесико мыши работает.

## Предыдущие сессии

# Сессия разработки — 2026-08-05 (продолжение)

Работа ведётся в репозитории **InvoltCAD-web**, ветка `main`.
Последний коммит: `chore: use port 3002 for dev and playwright due to port 3000 reserved`.

## Что сделано в этой сессии

### Исправлено перетаскивание и автоповорот устройств
- `packages/core/tools/SelectTool.ts`:
  - При drag устройство движется вдоль текущей стены (`projectPointToSegment`).
  - Добавлен поиск ближайшей стены в радиусе 60 px (`findNearestWallWithin`) — устройство перепрыгивает на другую стену.
  - Автоматический пересчёт `wallId`, `t`, `side` в зависимости от положения курсора.
- Автоповорот обеспечивает `DeviceRenderer` через `Math.atan2(wallDirection)`.
- `packages/core/editor/CommandManager.ts`:
  - Команда `MoveDeviceCommand` теперь хранит `oldWallId/oldT/oldSide/oldPosition → newWallId/newT/newSide/newPosition`, undo/redo работает корректно.

### Исправлен UI-overlap
- `src/components/editor/ProjectsPanel.tsx`: кнопка «Проекты» больше не перекрывает Toolbar (`md:left-3` → `md:left-20`, `z-40` → `z-20`).

### Обновлена авторизация NextAuth до v5
- `package.json`: `next-auth@5.0.0-beta.32` (установлено с `--legacy-peer-deps`).
- `src/lib/auth.ts`: переписан под v5 API (`handlers`, `auth`, `signIn`, `signOut`).
- `src/app/api/auth/[...nextauth]/route.ts`: использует `handlers` из `auth.ts`.

### Добавлен E2E-тест drag & drop устройств
- `e2e/editor.spec.ts`: тест рисует две стены, размещает устройство, перетаскивает его вдоль стены, затем переносит на другую стену и проверяет `wallId`.

### Убрано дублирование панелей
- `src/components/editor/PropertyPanel.tsx`, `LayersPanel.tsx`, `SpecPanel.tsx`:
  - Убраны фиксированные обёртки `absolute right-3 top-3...` и дублирующие заголовки.
  - Панели теперь рендерятся только как содержимое плавающих окон `PanelManager` (через `createPortal` в `PlanEditor.tsx`).
  - Оставлена единая плавающая система из версии со старого ПК.

### Панель листов защищена от перекрытия
- `ValidationPanel` превращена в плавающую панель `validation` в `PanelManager`.
- `PanelManager` теперь принимает `avoidElement` (элемент `SheetsBar`) и не даёт панелям пересекать её область:
  - default-раскладка начинается ниже панели листов;
  - при drag панель автоматически сдвигается вниз, если курсор зайдёт в область листов;
  - при resize viewport все панели clamp'ятся с учётом `SheetsBar`.
- `PlanEditor`: `SheetsBar` создаётся перед `PanelManager`, чтобы тот сразу знал область для избегания.
- В `Toolbar` добавлена кнопка для показа/скрытия панели «Проверка»; добавлена иконка `validation`.

### Порт разработки
- Порт 3000 оказался зарезервирован системой (Windows/Hyper-V) — Next.js не мог на нём запуститься и писал `Port 3000 is in use by an unknown process`.
- Перевёл dev-сервер и Playwright на порт **3002**:
  - `package.json`: `dev` и `start` теперь используют `-p 3002`.
  - `playwright.config.ts`: `baseURL` и `webServer` на `http://localhost:3002`, добавлен `timeout: 120000` и `navigationTimeout: 60000`.
- `src/components/editor/PanelManager.ts`:
  - Добавлен `reflowColumn()` — раскладывает видимые панели в компактный вертикальный столбик у правого края с учётом реальных размеров.
  - Добавлен `sanitizeLayout()` — при загрузке проверяет перекрытия в сохранённой раскладке и автоматически перестраивает столбик.
  - При первом запуске (нет сохранённой раскладки) панели сразу выстраиваются компактно, без огромных зазоров.
  - Добавлен публичный `resetLayout()`.
- `src/components/editor/Toolbar.tsx`:
  - В меню «Панели» добавлен пункт «Упорядочить панели» для ручного сброса раскладки.
- `src/components/editor/icons.ts`:
  - Добавлена иконка `reset`.
- Проверена старая версия (`experiment/t-junction-rooms` в `3. Project InvoltCAD`):
  - В свойствах устройства редактировались: имя, смещение от стены, расстояние от начала стены, тип, сторона, масштаб иконки.
- Внесены правки в `InvoltCAD-web`:
  - В `DeviceProperties` редактируются: имя, смещение подписи (X/Y), смещение от стены, расстояние от начала стены, тип, сторона и **масштаб иконки**.
  - Масштаб иконки — комбинация: глобальный `deviceIconScale` (слайдер в настройках инструмента) × персональный `device.iconScale` (слайдер в свойствах устройства). Это сохраняет работу общего масштаба и даёт индивидуальную подстройку каждого устройства.
  - `DeviceRenderer`, хит-тест и drag в `SelectTool`, `Plan.addDevice` и `addFreeDevice` учитывают итоговый масштаб при отрисовке, выделении и отступах от проёмов/концов стены.
  - В `Device` добавлены/сохраняются: `nameOffset`, `position`, `iconScale`.
  - `Plan.toJSON/fromJSON`, сериализатор проектов (`src/lib/projects/serializer.ts`) и API `/api/projects/[id]` теперь сохраняют и восстанавливают `nameOffset`, `position`, `iconScale` в JSON-поле `properties` устройства БД.
  - Добавлена полная синхронизация `cadStore → EditorState` в `PlanEditor.tsx` для всех tool-related полей:
    `orthoMode`, `deviceIconScale`, `selectedDeviceType`, `wallThickness`, `doorWidth`, `windowWidth`, `defaultCableType`, `defaultCableSection`.
  - Добавлена двусторонняя синхронизация выделения (`selectedWallId/opening/device/cable/dimension/room`) между `EditorState` и `cadStore`. Теперь клик по объекту в canvas сразу обновляет панель «Свойства».
  - Теперь изменения в панелях свойств/настроек инструментов сразу видны инструментам и рендеру.

### Авто-перестройка плавающих панелей при развёртывании/сворачивании
- `src/components/editor/PanelManager.ts`:
  - `reflowColumn()` теперь сортирует видимые панели по текущему вертикальному положению и выстраивает их столбиком без перекрытий, используя реальные высоты (в том числе развёрнутых тел панелей).
  - Добавлен `ResizeObserver` — панели автоматически перестраиваются после рендера React-порталов, сворачивания/разворачивания и изменения контента.
  - Добавлен `layoutReady` guard и защита от нулевого/слишком маленького viewport (`MIN_VIEWPORT_WIDTH = 400`), чтобы случайные события resize при свёрнутом окне не сбрасывали панели в `left: 0`.
  - Добавлен `destroy()` для корректного отключения ResizeObserver и слушателя resize.
- `src/components/editor/PlanEditor.tsx`:
  - При размонтировании вызывается `panelManagerRef.current?.destroy()`.

### Панели сохраняют горизонтальное положение при сворачивании/разворачивании
- `src/components/editor/PanelManager.ts`:
  - Новый метод `reflowColumns()` группирует видимые панели по вертикальным колонкам (панели с близким X — в одной колонке) и выстраивает их по Y без перекрытий.
  - При развёртывании/сворачивании, закрытии/открытии и изменении размеров контента панели остаются на своём X, а нижестоящие в той же колонке прилипают к нижней границе вышестоящей.
  - `reflowColumn()` (сброс в правый столбик) теперь используется только при первом запуске, ручном сбросе раскладки и санитизации сохранённой раскладки.
  - Панели в разных колонках не влияют друг на друга — можно свободно размещать панели по ширине экрана.
- Проверено вручную: развёртывание панели «Свойства» сдвигает нижние панели правой колонки вниз, а панель, перенесённую влево, остаётся на месте.

### Переработка панели инструментов
- `src/components/editor/Toolbar.tsx`:
  - Добавлен macOS-style dock снизу по центру с инструментами черчения: стена, дверь, окно, устройство, кабель, размер, выбор, рука + панели, проверка, тема.
  - Реализован эффект увеличения иконок при наведении (scale 1.55×/1.25×/1.08×) и всплывающие подписи.
  - Левая вертикальная панель теперь содержит вкладки проекта: Проекты, Кабельный журнал, Однолинейная схема, Визуализация щита.
  - Внизу левой панели размещены вспомогательные кнопки: undo/redo, zoom, save, export (PNG/XLSX/SVG), print, import, clear, ortho, масштаб UI, компактные панели.
- `src/components/editor/ProjectsPanel.tsx`:
  - Убрана собственная абсолютная кнопка «Проекты».
  - Открытие панели теперь управляется из `cadStore` (`projectsOpen` / `setProjectsOpen`).
- `src/stores/cadStore.ts`:
  - Добавлено состояние `projectsOpen` и сеттер `setProjectsOpen`.
- `src/components/editor/icons.ts`:
  - Добавлена иконка `projects`.
- `src/app/globals.css`:
  - Добавлены стили `.project-sidebar`, `.editor-dock`, `.editor-dock-item`, `.editor-dock-tooltip` и `.panels-menu-dock`.
  - Панель листов (`sheets-bar`) сдвинута вправо, чтобы не перекрывать левую боковую панель (`left: 76px`).
- `e2e/editor.spec.ts`:
  - Исправлен локатор теста «панель проверки отображается» на `.float-panel-title`, чтобы избежать конфликта с tooltip dock.

### Этап 4 — Комнаты и потребители
- Создан `packages/core/electrical/RoomConsumerEngine.ts`:
  - `RoomData`, `ConsumerData`, `CircuitData` — типы для комнат/потребителей/линий.
  - `pointInPolygon` — определение принадлежности точки полигону.
  - `buildRoomData` — построение списка комнат из `plan.getRooms()`, распределение устройств по комнатам, привязка существующих потребителей.
  - `stableRoomId` — стабильный ID комнаты по хешу полигона, чтобы не терять привязки при пересчёте стен.
  - `deviceToConsumer` — преобразование устройства на плане в потребителя.
  - `guessCategoryFromDeviceType`, `defaultPowerW` — определение категории и мощности по типу устройства.
  - `groupConsumersToCircuits` — автогруппировка потребителей в линии щита (розетки ≤6 на линию, освещение по комнатам, техника отдельно, слаботочка отдельно).
  - `estimateCircuitLength` — оценка длины кабеля от щита до потребителей.
- `src/components/editor/RoomsPanel.tsx`:
  - Полноценная панель с двумя колонками: список комнат / детали комнаты.
  - Отображение площади, устройств на плане, потребителей.
  - Добавление/редактирование/удаление свободных потребителей (название, категория, мощность, количество, коэффициент спроса).
  - Кнопка «Импорт устройств» — превращает все устройства на плане в потребителей с автоматическим определением категории и мощности.
  - Кнопка «Автогруппировать линии» — создаёт `Circuit` из потребителей.
  - Отображение сгруппированных линий с номиналами автоматов, сечением кабеля и длиной.
  - Изменения сохраняются в `plan.electrical` и вызывают `notifyChanged()` / `requestRender()`.

### Этап 5 — Автосборка щита и SVG-однолинейная схема
- Создан `packages/core/electrical/BoardEngine.ts`:
  - `BoardComponent`, `DistributionBoardData`, `BoardOptions` — типы компонентов щита и щита целиком.
  - `buildDistributionBoard(circuits, options)` — автосборка:
    - вводной автомат по суммарному току с запасом 1,25×;
    - вводное УЗО (опционально) с подбором номинала и типа AC;
    - групповые автоматы по мощности линии с характеристикой C;
    - автоматический подбор корпуса (12/18/24/36/54 модуля) по суммарной ширине;
    - балансировка фаз для 3-фазных щитов.
- Создан `packages/core/electrical/BoardSvgScheme.ts`:
  - `generateBoardSvg(board, options)` — генерация SVG-однолинейной схемы: шины L1/L2/L3/N/PE, автоматы, RCD, линии к нагрузкам, легенда.
  - `generateOlsFromCircuits(circuits, options)` — упрощённая однолинейная схема по линиям, когда щит ещё не собран.
- Обновлён `src/components/editor/OlsPanel.tsx`:
  - Кнопки «Автособрать щит» и «Экспорт SVG».
  - Рендер SVG через `dangerouslySetInnerHTML` с адаптацией под тёмную/светлую тему.
- Обновлён `src/components/editor/PanelEditor.tsx`:
  - Визуальная компоновка устройств на DIN-рейках (цвета по типам: вводной — красный, автомат — оранжевый, УЗО — синий, шина — серый).
  - Унифицирован рендер для устройств, полученных из `layoutPanel()` и из `buildPanelFromBoard()`, исправлена типизация.
- Проверка: `npx tsc --noEmit`, `npm test`, `npm run build`, `npx playwright test e2e/editor.spec.ts` — всё чисто.

### Этап 6 — Кабельный журнал v2 с геометрическими длинами
- Создан `packages/core/electrical/CableRunEngine.ts`:
  - `CableRunData`, `CableRunSegment` — runtime-модель кабельной трассы.
  - `buildCableRuns(cables, circuits)` — привязка кабелей к цепям щита по `deviceId` потребителей, расчёт маршрута, запаса (10% или минимум 0,5 м) и итоговой длины.
  - `buildCableSpecification(runs)` — сводная спецификация: кабели по типам/сечениям, гофротруба, клеммные колодки.
- Обновлена модель кабеля (`packages/core/model/Cable.ts`):
  - Добавлены `spareLength`, `totalLength`, `circuitId`.
- Обновлен `packages/core/model/Plan.ts`:
  - `PlanElectrical.cableRuns` теперь типизирован как `CableRunData[]`.
  - `recalcCableRoutes()` автоматически пересчитывает `spareLength` и `totalLength`.
  - `toJSON`/`fromJSON` сохраняют и восстанавливают `spareLength`, `totalLength`, `circuitId`.
- Переписан `src/components/editor/CableJournalPanel.tsx`:
  - Три вкладки: «Кабели», «Нагрузки», «Спецификация».
  - Кабели отображаются с геометрической длиной, запасом, итогом и привязкой к линии щита.
  - Кнопка «Обновить» пересчитывает маршруты и перестраивает cableRuns.
  - Итоговая сумма кабеля по всем трассам.
- Добавлены unit-тесты `packages/core/electrical/CableRunEngine.test.ts`.
- Проверка: `npx tsc --noEmit`, `npm test` (15/15), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Этап 7 — Прайс-листы и каталоги материалов/работ
- Создан `packages/core/catalogs/PriceCatalog.ts`:
  - `PriceItemData`, `PriceWorkItemData`, `PriceLevel` — runtime-типы позиций каталога.
  - Встроенный базовый каталог материалов (кабели, автоматы, УЗО, DIN-рейки, коробки, гофра, кабель-каналы, крепёж, монтажные материалы, устройства).
  - Встроенный базовый каталог работ (прокладка кабеля, установка устройств, сборка щита, электромонтаж, проектирование).
  - `priceForLevel`, `formatPriceRubKopecks`, `parsePriceRubKopecks` — работа с ценами в копейках.
  - `mergeCatalog()` — объединение встроенных и пользовательских позиций с сортировкой по категориям.
- Добавлены API endpoints:
  - `GET /api/catalog/items` и `GET /api/catalog/work-items` — встроенные + пользовательские позиции.
  - `POST /api/catalog/items` и `POST /api/catalog/work-items` — создание пользовательской позиции.
  - `PUT /api/catalog/items/[id]` и `PUT /api/catalog/work-items/[id]` — редактирование только своих позиций.
  - `DELETE /api/catalog/items/[id]` и `DELETE /api/catalog/work-items/[id]` — удаление только своих позиций.
- Переписан `src/components/editor/CatalogPanel.tsx`:
  - Вкладки «Материалы» / «Работы».
  - Переключатель уровня цен: бюджет / стандарт / премиум.
  - Поиск по каталогу.
  - Группировка по категориям.
  - Добавление/редактирование/удаление пользовательских позиций (встроенные только для просмотра).
  - Импорт позиций из CSV (категория;название;ед;цена бюджет;стандарт;премиум;описание).
- Добавлены unit-тесты `packages/core/catalogs/PriceCatalog.test.ts`.
- Проверка: `npx tsc --noEmit`, `npm test` (20/20), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Этап 8 — Сметы, счета, договоры и акты
- Создан `packages/core/estimates/EstimateEngine.ts`:
  - `EstimateData`, `EstimateItemData`, `InvoiceData`, `DocumentData` — runtime-модели.
  - `buildEstimateFromSpecification(spec, catalogItems, workItems, priceLevel)` — автозаполнение сметы из спецификации кабельного журнала + типовые работы.
  - `recalcEstimate()` — пересчёт материалов, работ, скидки, НДС, итога.
  - `buildInvoiceFromEstimate()` — создание счёта на сумму сметы.
  - `generateEstimateDocument`, `generateContractDocument`, `generateActDocument`, `generateSpecDocument` — текстовые шаблоны документов.
- Добавлены API endpoints:
  - `/api/projects/[id]/estimates` — GET/POST.
  - `/api/projects/[id]/estimates/[estimateId]` — PUT/DELETE.
  - `/api/projects/[id]/invoices` — GET/POST.
  - `/api/projects/[id]/invoices/[invoiceId]` — PUT/DELETE.
  - `/api/projects/[id]/documents` — GET/POST.
  - `/api/projects/[id]/documents/[documentId]` — PUT/DELETE.
- Переписаны панели:
  - `src/components/editor/EstimatesPanel.tsx` — список смет, создание из плана, редактирование позиций, уровень цен/скидка/НДС, генерация счёта, КП, договора, акта, спецификации.
  - `src/components/editor/InvoicesPanel.tsx` — список счетов, создание/редактирование/удаление, статусы, срок оплаты.
  - `src/components/editor/DocumentsPanel.tsx` — список документов, редактор текста, типы (договор, акт, КП, спецификация, счёт).
- Добавлены unit-тесты `packages/core/estimates/EstimateEngine.test.ts`.
- Проверка: `npx tsc --noEmit`, `npm test` (24/24), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Интеграция щитового/сметного функционала (Electrosmeta / Разряд)
- Изучены материалы `C:\Работа\Kими\Kimi_Agent_Electros`:
  - `electrosmeta-code-analysis.md` — архитектура и модули Electrosmeta.
  - `razryad-analog-plan.md` / `razryad-code-analysis.md` — workflow и алгоритмы сервиса Разряд.
- Принят подход: воспроизводить функциональность и алгоритмы, не копируя чужой код, UI, бренды и базы товаров.
- `prisma/schema.prisma`:
  - Расширена модель `Room` (добавлено `heightMm`, обратное отношение `consumers`).
  - Добавлены модели: `Consumer`, `Circuit`, `DistributionBoard`, `CableRun`, `PriceItem`, `PriceWorkItem`, `Estimate`, `EstimateItem`, `Invoice`, `Document`, `AutomationConfig`.
  - Отношения добавлены в `Project`.
- Применена миграция `20260805082856_add_electrical_entities`.
- `packages/core/model/Plan.ts`:
  - Добавлен `PlanElectrical` и поле `electrical` для хранения новых сущностей в runtime-модели.
  - `toJSON`/`fromJSON` сохраняют и восстанавливают `electrical`.
- `src/lib/projects/serializer.ts`:
  - `SerializedPlan` расширен полем `electrical`.
  - `serializePlan`/`deserializePlan` работают с electrical-данными.
- `src/app/api/projects/[id]/route.ts`:
  - GET загружает новые сущности через `include` и возвращает в `plan.electrical`.
  - PUT удаляет и пересоздаёт новые сущности в транзакции.
- `src/stores/cadStore.ts`:
  - Добавлены флаги открытия модальных панелей: `roomsOpen`, `estimatesOpen`, `invoicesOpen`, `documentsOpen`, `catalogOpen`, `markingOpen`, `automationOpen`, `templatesOpen`.
- `src/components/editor/icons.ts`:
  - Добавлены иконки: `rooms`, `estimates`, `invoices`, `documents`, `catalog`, `marking`, `automation`, `templates`.
- `src/components/editor/Toolbar.tsx`:
  - В левую панель добавлены кнопки: Комнаты, Каталог, Сметы, Счета, Документы, Маркировка, Автоматика, Шаблоны.
- `src/components/editor/ModalPanel.tsx`:
  - Создан универсальный компонент модальной панели (заголовок + overlay + контент).
- Добавлены заглушки новых модальных панелей:
  - `RoomsPanel`, `CatalogPanel`, `EstimatesPanel`, `InvoicesPanel`, `DocumentsPanel`, `MarkingPanel`, `AutomationPanel`, `TemplatesPanel`.
- `src/components/editor/PlanEditor.tsx`:
  - Подключены все новые модальные панели.
- `src/app/globals.css`:
  - `.project-sidebar-top` получил `flex: 1 1 auto` и `overflow-y: auto`, чтобы длинный список вкладок скроллился.

### Ресайз, анимации и mobile bottom-sheet
- `src/components/editor/PanelManager.ts`:
  - Добавлена ручка ресайза в правом нижнем углу каждой панели: можно менять ширину (240–600 px) и высоту.
  - Размеры панелей сохраняются в `localStorage` и восстанавливаются после перезагрузки.
  - Сворачивание/разворачивание теперь плавно анимируется через `max-height`/`opacity`/`padding`.
  - Добавлена мобильная раскладка (`reflowMobile()`): при `window.innerWidth < 768` развёрнутая панель занимает bottom sheet над табами, а свёрнутые панели превращаются в табы внизу экрана.
  - Drag за заголовок и ресайз отключены на мобильных устройствах.
- `src/app/globals.css`:
  - Стили для ручки ресайза `.float-panel-resize`.
  - CSS-переходы для `.float-panel-body`.
  - Медиа-запрос `@media (max-width: 767px)` для bottom-sheet.
- `e2e/editor.spec.ts`:
  - Добавлены тесты: ресайз панели, анимация сворачивания/разворачивания, mobile bottom-sheet.

### Этап 9 — Публичные ссылки на КП и оплата
- Добавлена публикация смет (КП) по публичной ссылке:
  - `POST /api/projects/[id]/estimates/[estimateId]/publish` — генерация `publicSlug` и срока 30 дней.
  - `DELETE /api/projects/[id]/estimates/[estimateId]/publish` — снятие с публикации.
  - Обновлены API смет: возвращают `publicSlug` и `publicExpiresAt`.
- Добавлена публичная страница `src/app/public/estimates/[slug]/page.tsx` + `PublicEstimateView`:
  - Отображение КП без авторизации (пока ссылка не истекла).
  - Кнопка «Оплатить» через YooKassa.
- Добавлен API `POST /api/public/estimates/[slug]/pay` — создание платежа для публичного КП (purpose=`estimate`).
- Добавлена страница успеха `src/app/public/estimates/[slug]/success/page.tsx`.
- Обновлён `src/app/api/billing/webhook/route.ts`:
  - При успешной оплате purpose=`estimate` автоматически меняет статус сметы на `accepted`.
- Обновлён `src/components/editor/EstimatesPanel.tsx`:
  - Кнопки «Опубликовать», «Снять с публикации», «Копировать ссылку».
- Проверка: `npx tsc --noEmit`, `npm test` (24/24), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Этап 10 — Маркировка IEC и печать этикеток
- Создан `packages/core/marking/IecMarkingEngine.ts`:
  - `IecPrefix`, `DeviceLabel`, `LabelSheet` — runtime-модели этикеток.
  - `detectPrefix(type)` — автоматический префикс IEC по типу объекта (R — розетки, S — выключатели, E — освещение, W — кабели, QF — автоматы, Q — УЗО, L — линии).
  - `buildIecLabels({ devices, cables, circuits, breakers })` — генерация обозначений с последовательной нумерацией по префиксам.
  - `layoutLabelsOnA4(labels)` — раскладка этикеток на лист A4 с отступами и зазорами.
  - `generateLabelsSvg(sheet)` — генерация SVG для печати (шрифты, рамки, текст).
  - `exportLabelsToCsv(labels)` — экспорт списка этикеток в CSV.
- Переписан `src/components/editor/MarkingPanel.tsx`:
  - Загрузка устройств, кабелей, линий, автоматов щита из текущего плана.
  - Фильтры по типам объектов (устройства, кабели, автоматы, УЗО, линии).
  - Таблица с обозначениями, описаниями, количеством, размерами.
  - Редактирование префикса и стартового номера для каждой группы.
  - Предпросмотр SVG, экспорт SVG/CSV, печать через `window.print()`.
- Добавлены unit-тесты `packages/core/marking/IecMarkingEngine.test.ts`.
- Проверка: `npx tsc --noEmit`, `npm test` (29/29), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Этап 11 — Генераторы Wirenboard / Home Assistant
- Создан `packages/core/automation/AutomationEngine.ts`:
  - `AutomationDeviceMapping`, `AutomationConfigData`, `AutomationPlatform` — runtime-типы маппинга устройств и конфигурации автоматизации.
  - `buildAutomationMappingsFromPlan(devices, circuits)` — маппинг устройств плана и линий щита на типы автоматизации (`switch`, `light`, `dimmer`, `sensor`, `thermostat`, `relay`).
  - `generateWirenboardConfig(mappings)` — генерация JS-конфигурации для Wirenboard: `defineVirtualDevice`, ячейки `switch`/`range`/`temperature`, шаблоны устройств (`WB-MR6C`, `WB-MRGBW-D`, `WB-MSW`).
  - `generateHomeAssistantConfig(mappings)` — генерация YAML для Home Assistant: `switch`/`light`/`sensor` через MQTT с `command_topic`/`state_topic`.
  - `generateAutomationConfig(platform, mappings)` — диспетчер выбора платформы.
- Добавлены API endpoints:
  - `GET /api/projects/[id]/automation` — список конфигов автоматизации.
  - `POST /api/projects/[id]/automation` — создание конфига.
  - `PUT /api/projects/[id]/automation/[automationId]` — обновление конфига.
  - `DELETE /api/projects/[id]/automation/[automationId]` — удаление конфига.
- Переписан `src/components/editor/AutomationPanel.tsx`:
  - Список конфигов автоматизации.
  - Редактор имени и выбор платформы (Wirenboard / Home Assistant).
  - Автозаполнение маппинга из текущего плана (`buildAutomationMappingsFromPlan`).
  - Редактор маппинга: устройство → тип автоматизации, канал, адрес.
  - Предпросмотр сгенерированного скрипта.
  - Скачивание файла `.js` (Wirenboard) или `.yaml` (Home Assistant).
- Добавлены unit-тесты `packages/core/automation/AutomationEngine.test.ts`.
- Исправлена типизация JSON-поля `devices` в API (`Prisma.InputJsonValue`).
- Проверка: `npx tsc --noEmit`, `npm test` (33/33), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### Этап 12 — Шаблоны объектов и импорт CSV каталогов
- Обновлена `prisma/schema.prisma`:
  - Добавлено поле `templateType` в `ProjectTemplate` (`project` | `room` | `device`).
  - Сгенерирована и применена миграция `20260805122537_add_template_type`.
- Создан `packages/core/templates/TemplateEngine.ts`:
  - `ProjectTemplateData`, `TemplatePayload`, `ApplyTemplateOptions` — runtime-типы.
  - `createTemplateFromPlan(plan, type, name, ...)` — сериализация плана через `serializePlan`.
  - `applyTemplateToPlan(plan, template, { mode, offsetMm })` — загрузка шаблона с заменой или добавлением (merge) и смещением.
  - `exportTemplateToJson` / `importTemplateFromJson` — экспорт/импорт JSON-файлов.
  - `builtinTemplates()` — встроенные шаблоны: комната 5×4 м, 2-комнатная квартира 6×6 м, офисная ячейка 4×3 м.
- Добавлены API endpoints:
  - `GET /api/templates` — встроенные + пользовательские шаблоны текущего пользователя.
  - `POST /api/templates` — сохранить текущий план как шаблон.
  - `PUT /api/templates/[id]` — обновить метаданные шаблона.
  - `DELETE /api/templates/[id]` — удалить свой шаблон.
  - `POST /api/catalog/devices/import` — пакетный импорт устройств из CSV (`category;deviceType;name;nameRu;width;height;price;svg;properties`).
- Переписан `src/components/editor/TemplatesPanel.tsx`:
  - Вкладки «Шаблоны» и «Импорт устройств».
  - Сохранение текущего плана как шаблон (название, категория, тип).
  - Загрузка шаблона в план (режимы «Заменить» / «Добавить»).
  - Экспорт/импорт JSON шаблонов.
  - Импорт CSV каталога устройств с отчётом об ошибках.
- Обновлён `src/components/editor/PlanEditor.tsx`:
  - `onChange` теперь обновляет `SheetsBar` (чтобы листы пересчитывались после загрузки шаблона).
- Добавлены unit-тесты `packages/core/templates/TemplateEngine.test.ts`.
- Проверка: `npx tsc --noEmit`, `npm test` (39/39), `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

### UI: уменьшена нижняя панель инструментов (macOS-style dock)
- `src/app/globals.css`:
  - Dock: `padding` 5×10 px, `gap` 6 px, `border-radius` 14 px, `bottom` 10 px.
  - Dock item: 34×34 px (было 42×42), `border-radius` 10 px.
  - Иконки: 18×18 px (было 22×22).
  - Divider: 22 px (было 28 px).
  - Tooltip: 10 px шрифт, 4×8 px padding, 6 px radius.
- UI: адаптированы цвета выбранных кнопок-пресетов в панели «Свойства» для тёмной темы (`src/components/editor/PropertyPanel.tsx`).
- UI: адаптированы плавающие панели при изменении размера окна (`src/components/editor/PanelManager.ts`):
  - При `resize` десктоп теперь вызывает `reflowColumns()` вместо простого `clampAllToViewport`.
  - Колонки панелей привязываются к правому краю, если вылезают за viewport.
  - Учитывается панель листов (`avoidRect`) и нижняя граница окна.
- UI: позиция плавающих панелей сохраняется в процентах от viewport (`src/components/editor/PanelManager.ts`):
  - При увеличении окна панели, которые были справа в уменьшенном окне, остаются справа.
  - `getState` теперь сохраняет `xPercent` / `yPercent`, а `applyState` восстанавливает позицию относительно текущего размера окна.
- UI: улучшена видимость текста во вкладке «Слои» (`src/components/editor/LayersPanel.tsx`):
  - Текст меток теперь использует `var(--text)` — единый стандарт для светлой и тёмной тем.
  - Checkbox адаптирован под темы: `border-[var(--border)]`, `bg-[var(--panel-bg)]`, `text-[var(--accent)]`.
- Проверка: `npx tsc --noEmit`, `npm run build`, `npx playwright test e2e/editor.spec.ts` (17/17) — всё чисто.

## Проверки

- `npm run build` — чисто.
- `npx tsc --noEmit` — чисто.
- `npm test` — 39/39.
- `npx playwright test e2e/editor.spec.ts` — 17/17.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Этап 5 завершён: автосборка щита и SVG-однолинейная схема работают.
- Этап 6 завершён: кабельный журнал v2 с геометрическими длинами и спецификацией работает.
- Этап 7 завершён: прайс-листы и каталоги материалов/работ работают.
- Этап 8 завершён: сметы, счета, договоры и акты работают.
- Этап 9 завершён: публичные ссылки на КП и оплата работают.
- Этап 10 завершён: маркировка IEC и печать этикеток работают.

## Что осталось / следующие шаги

1. ✅ Этап 5 — автосборка щита + SVG-однолинейная схема (завершён).
2. ✅ Этап 6 — кабельный журнал v2 с геометрическими длинами и спецификацией расходников (завершён).
3. ✅ Этап 7 — прайс-листы материалов и работ (завершён).
4. ✅ Этап 8 — сметы, счета, договоры и акты (завершён).
5. ✅ Этап 9 — публичные ссылки на КП + оплата (завершён).
6. ✅ Этап 10 — маркировка IEC и печать этикеток (завершён).
7. ✅ Этап 11 — генераторы Wirenboard / Home Assistant (завершён).
8. ✅ Этап 12 — шаблоны объектов и импорт CSV каталогов (завершён).
9. Ручное тестирование новых панелей и интеграции в браузере.

## Как продолжить разработку на другом ПК

```bash
# 1. Клонировать репозиторий
git clone https://github.com/InvoltAM/InvoltCAD-web.git
cd InvoltCAD-web

# 2. Установить зависимости
npm install

# 3. Настроить окружение
cp .env.example .env
# Заполнить: DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# SMTP_* (для входа по email), YOOKASSA_* (для платежей)

# 4. Prisma
npx prisma generate
npx prisma migrate dev

# 5. Запуск
npm run dev
# http://localhost:3002/editor
```

### Проверки перед правками

```bash
npx tsc --noEmit   # TypeScript
npm test           # unit-тесты
npx playwright test e2e/editor.spec.ts  # E2E
```

### Важные моменты
- Dev-сервер работает на **3002**, потому что Windows/Hyper-V занимает порт 3000.
- Раскладка плавающих панелей хранится в `localStorage` (`involtcad-panels-layout`). При проблемах с позициями можно нажать в редакторе: **Панели → Упорядочить панели** или удалить ключ из `localStorage`.
- Последнее состояние сессии и следующие шаги описаны в этом файле (`docs/SESSION_STATE.md`).
