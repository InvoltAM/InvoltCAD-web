# Сессия разработки — 2026-08-05 (продолжение)

## Текущий контекст

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

## Проверки

- `npm run build` — чисто.
- `npx tsc --noEmit` — чисто.
- `npm test` — 20/20.
- `npx playwright test e2e/editor.spec.ts` — 17/17.
- Dev-сервер запущен на `http://localhost:3002/editor`.
- Этап 5 завершён: автосборка щита и SVG-однолинейная схема работают.
- Этап 6 завершён: кабельный журнал v2 с геометрическими длинами и спецификацией работает.
- Этап 7 завершён: прайс-листы и каталоги материалов/работ работают.

## Что осталось / следующие шаги

1. ✅ Этап 5 — автосборка щита + SVG-однолинейная схема (завершён).
2. ✅ Этап 6 — кабельный журнал v2 с геометрическими длинами и спецификацией расходников (завершён).
3. ✅ Этап 7 — прайс-листы материалов и работ (завершён).
4. Этап 8 — сметы, счета, договоры, акты.
5. Этап 9 — публичные ссылки на КП + оплата.
6. Этап 10 — маркировка IEC и печать этикеток.
7. Этап 11 — генераторы Wirenboard / Home Assistant.
8. Этап 12 — шаблоны объектов и импорт CSV каталогов.
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
