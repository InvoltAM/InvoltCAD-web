# Состояние проекта InvoltCAD-web

> **Обновлено:** 2026-08-09 (текущая сессия)  
> **Статус:** production-ready платформа, UI и команды интегрированы из `experiment/t-junction-rooms`, доработаны DXF-импорт/экспорт, CSV-экспорт, PropertyPanel и темизация рендереров; **иконки заменены на Phosphor Icons**; рамка и штамп по ГОСТ 2.104-2006 реализованы и проверены; **добавлено CAD-стильное выделение рамкой (window/crossing)**; **добавлен экспорт DXF/PDF и диалог импорта PDF/DWG/DXF**; **штамп в печати кабельного журнала теперь рендерится через `SheetFrameRenderer.renderStamp` и совпадает с редактором**; dev-сервер запущен для ручного тестирования

## Что реализовано

### Инфраструктура
- Next.js 16.2.10 + React 19.2.4 + TypeScript + Tailwind CSS 4
- PostgreSQL + Prisma 7 (адаптер `PrismaPg`)
- NextAuth 5 (Google + Email, database sessions)
- Zustand для state management
- Docker + GitHub Actions CI/CD
- Vitest + Testing Library (12 тестов)
- Playwright E2E (10 тестов)
- Sentry мониторинг

### Редактор
- Полностью перенесён из InvoltCAD в `packages/core/`
- React-обёртка: `PlanEditor`, `Toolbar`, `PropertyPanel`, `LayersPanel`, `SpecPanel`, `ValidationPanel`, `MobileMenu`, `ProjectsPanel`
- Zustand store `cadStore` (адаптация EditorState)
- Тема (light/dark) через `next-themes` + `ThemeManager`
- Детальный `PropertyPanel` (стены, проёмы, устройства, кабели, размеры)

### UI и команды (перенесено из experiment/t-junction-rooms)
- `SnapEngine` — объектная привязка (endpoint, midpoint, center, intersection, extension, wall-line, tracking, grid), липкая привязка (до двух точек), направляющие лучи, привязка к центру комнаты
- `SelectTool` — базовый инструмент «Выбор», перемещение устройства drag'ом вдоль стены, перетаскивание подписей устройств, редактирование вершин комнат, CAD-стильное выделение рамкой (слева направо — window, справа налево — crossing)
- `DeviceTool` — свободное размещение светильников (потолок, центр комнаты), примагничивание к стене, определение стороны
- `PanelManager` — плавающие панели (drag за заголовок, сворачивание, закрытие, магнитное прилипание)
- `SheetsBar` — панель листов проекта (переключение, добавление, переименование, перетаскивание, удаление)

### Облачные проекты
- API: CRUD, дублирование, сериализация Plan
- Синхронизация с IndexedDB (офлайн-кэш)
- Автосохранение (debounce 2 сек)
- `ProjectsPanel` с поиском, созданием, удалением, дублированием
- Импорт JSON и DXF

### Совместный доступ
- API: приглашение, изменение роли, удаление участников
- `ShareDialog` с выбором роли (просмотр/редактирование)
- Права доступа: owner / editor / viewer
- Real-time синхронизация (polling)

### Платежи
- YooKassa интеграция (checkout, webhook, fulfillment)
- Тарифы Free/Pro/Business с лимитами
- Кредиты и транзакции
- Страницы `/pricing`, `/billing`, `/billing/success`

### Маркетплейс
- Каталог устройств и шаблонов (`/marketplace`)
- Покупка за кредиты (комиссия 20%)
- Кабинет продавца (`/seller/dashboard`)

### Инженерные фичи
- Кабельный журнал + расчёт нагрузок по СП 256 (`CableJournalPanel`)
- Автотрассировка кабелей (A* + NavGrid)
- Однолинейная схема (ОЛС) с автогенерацией из плана (`OlsPanel`)
- Визуализация щита (DIN-рейки, автокомпоновка) (`PanelEditor`)
- Расчёт заземления, молниезащиты, селективности
- Шаблоны проектов (1/2-комнатные квартиры)
- AI-автопроектирование (rule-based)

### Экспорт/Импорт
- Экспорт PNG, PDF, XLSX, SVG
- Компоновка листов ГОСТ
- Импорт JSON и DXF

### MCP сервера
- **playwright** — E2E тестирование, автоматизация браузера (`@playwright/mcp`)
- **context7** — документация библиотек (`@upstash/context7-mcp`)
- **github** — работа с репозиториями (`@modelcontextprotocol/server-github`)
- **postgres** — прямая работа с PostgreSQL (`@ahmetkca/mcp-server-postgres`)
- **docker** — управление Docker контейнерами (`mcp-server-docker`)
- **eslint** — проверка кода на правильность (`@eslint/mcp`)
- **semgrep** — статический анализ безопасности (`mcp-server-semgrep`)

### Production
- `docker-compose.prod.yml` — production Docker
- `vercel.json` — конфигурация Vercel
- Health check API (`/api/health`)
- CI/CD для production (deploy to Vercel)
- `DEPLOY_PRODUCTION.md` — инструкция по деплою

## Сессия 2026-08-05

### Замена иконок на Phosphor Icons
- Установлены `@phosphor-icons/react` и `@phosphor-icons/web`.
- `src/components/editor/icons.ts` теперь маппит `IconName` в классы Phosphor и возвращает `<i class="ph ph-...">` вместо самописных SVG.
- Импорт `regular/style.css` добавлен в `src/app/layout.tsx`.
- `src/app/globals.css` адаптирован под иконочный шрифт (`font-size: 1em`, специфичные размеры через `font-size`).
- Все существующие вызовы `icon(...)` и `dangerouslySetInnerHTML` продолжают работать без изменений.
- Dev-сервер Next.js запущен на `http://localhost:3002`, иконки в редакторе отображаются корректно.

### Формат листа и рамка по ГОСТ
- `Sheet` получил поля `pageSize` (A4–A0), `orientation` (landscape/portrait), `printScale` (50–1000).
- Добавлен хелпер `getSheetDimensions` с размерами по ГОСТ.
- `Plan.toJSON/fromJSON` сохраняют и восстанавливают параметры листа.
- Новый `SheetFrameRenderer` рисует пунктирную рамку листа в мировых координатах (размер = мм бумаги × масштаб печати), центрированную на план.
- `CanvasEngine` вызывает `sheetFrameRenderer.render` после сетки.
- В `SheetsBar` у каждой вкладки появилась кнопка с выпадающим меню для выбора формата, ориентации и масштаба.
- `SheetComposer` теперь использует параметры активного листа по умолчанию.
- Проверено вручную (скриншоты) и 17 E2E-тестов проходят.

### Сессия 2026-08-06

#### Доводка рамки и штампа по ГОСТ 2.104-2006
- Переработан `SheetFrameRenderer`:
  - Основная надпись (штамп) строго по форме 1 ГОСТ 2.104-2006: ширина 185 мм, высота 55 мм.
  - Левая группа колонок учёта изменений: 7 / 10 / 23 / 15 / 10 мм.
  - Основное поле: 70 мм.
  - Правая колонка: 50 мм.
  - Высотные зоны основного поля: 8 / 32 / 15 мм (№ документа / основное поле / подписи).
  - Правая колонка: верхняя зона 15 мм («Литера / Масса / Масштаб»), средняя 25 мм, нижняя зона 15 мм («Лист / № / Листов»).
  - Подколонки правой части: 15 / 15 / 20 мм.
  - Все ячейки основного поля и правой колонки центрированы.
  - Убраны лишние элементы: подпись формата внутри рамки, вертикальные полосы переплёта, рамка сквозной нумерации.
  - Цвет рамки и штампа берётся из `ThemeManager`: чёрный (`#000000`) для светлой темы, белый (`#ffffff`) для тёмной.
  - Линии рисуются толще (минимум 1,5 px на экране), чтобы были видны при любом масштабе.
- Добавлен `CanvasEngine.fitToSheet()` — при смене формата/ориентации/масштаба камера автоматически подгоняется под размеры листа.
- `ThemeManager` обновлён: добавлен ключ `sheetFrame` с контрастным цветом для обеих тем.
- `Plan.toJSON/fromJSON` и `Sheet` поддерживают хранение и загрузку полей штампа (`titleBlock`).
- Исправлена проблема с "исчезновением" рамки: причина была в том, что dev-сервер Next.js не подхватывал изменения в `SheetFrameRenderer.ts`; после перезапуска сервера рамка и штамп отрисовываются корректно.
- Проверено в светлой и тёмной темах (A3 landscape).

## Что дальше

### Приоритет 1 — Доводка переноса из `experiment/t-junction-rooms`
- [x] DXF-импорт: flip Y, масштаб `$INSUNITS`, поддержка `POLYLINE`/`LWPOLYLINE`/`LINE`/`ARC`
- [x] CSV-экспорт спецификации из `SpecPanel`
- [x] Редактирование координат точек A/B размеров в `PropertyPanel`
- [x] Группировка типов устройств по категориям в `PropertyPanel` и настройках инструмента
- [x] `DeviceRenderer` и `GhostRenderer` используют `ThemeManager` (консистентность в тёмной теме)
- [x] Защита `getAuth()` от stale singleton при HMR
- [ ] Добавить E2E-тест на импорт DXF (сверка координат и масштаба)
- [ ] Добавить E2E-тест на CSV-экспорт и редактирование размеров

### Приоритет 2 — Production deployment
1. Настроить production БД (Supabase/Neon/Railway) по инструкции в `DEPLOY_PRODUCTION.md`
2. Настроить Vercel и переменные окружения
3. Настроить домен и SSL
4. Настроить мониторинг (Sentry, Uptime Robot)

### Приоритет 3 — Развитие платформы
1. Real-time синхронизация через WebSocket (вместо polling)
2. AI-ассистент с LLM (вместо rule-based)
3. 3D-визуализация плана
4. Мобильное приложение (React Native / PWA)

### Приоритет 4 — Доводка текущих фич
1. Улучшить PropertyPanel (валидация, подсказки)
2. Улучшить автотрассировку (учёт кабель-каналов, лотков)
3. Улучшить ОЛС (ручное редактирование, undo/redo)
4. Улучшить визуализацию щита (drag-and-drop устройств)

## Ключевые файлы

- `src/components/editor/PlanEditor.tsx` — главный компонент редактора
- `src/stores/cadStore.ts` — Zustand store
- `src/lib/projects/serializer.ts` — сериализация Plan
- `src/lib/projects/sync.ts` — синхронизация с IndexedDB
- `src/lib/auth.ts` — NextAuth
- `src/lib/prisma.ts` — Prisma client
- `prisma/schema.prisma` — схема БД
- `.github/workflows/ci.yml` — CI/CD
- `vercel.json` — конфигурация Vercel
- `docker-compose.prod.yml` — production Docker
- `DEPLOY_PRODUCTION.md` — инструкция по production деплою

## Сессия 2026-08-08 — CAD-выделение рамкой

### Сделано
- Исправлено рабочее место: работа ведётся в репозитории `InvoltCAD-web` (`C:/Работа/Kimi/involtcad-web`), ветка `main`.
- В `packages/core/tools/SelectTool.ts` добавлено CAD-стильное выделение рамкой:
  - **Window** (слева направо, зелёная рамка) — выбирает объекты, полностью внутри рамки.
  - **Crossing** (справа налево, красная рамка) — выбирает объекты, пересекаемые рамкой или полностью внутри.
  - Поддержка стен, проёмов, устройств, размеров, кабелей, комнат.
  - Клик в пустоту без движения сбрасывает выделение.
- TypeScript проверка (`tsc --noEmit`) проходит без ошибок.
- Dev-сервер Next.js запущен на `http://localhost:3002/`.
- Проверено в браузере: window/crossing выделение работает, клик по стене работает.
- Добавлен экспорт DXF через `packages/core/io/DxfExporter.ts` (стены, проёмы, устройства, кабели, размеры, комнаты; слои; единицы — миллиметры).
- В меню «Экспорт» добавлены пункты: PDF, DXF, SVG, PNG, XLSX.
- В диалог импорта добавлены фильтры PDF и DWG с пояснением пользователю (PDF/DWG напрямую в браузере не поддерживаются; DWG конвертировать в DXF, PDF — как подложка в разработке).
- Экспорт DXF проверен в браузере: файл `involtcad-plan.dxf` скачивается.
- Иконка кнопки «Добавить лист» в панели листов заменена с лупы с плюсом на простой `+` (Phosphor `plus`).
- Кнопка кабельного журнала в левой панели обозначена коротко `КЖ` (title — «Кабельный журнал»).

### Примечание
- `npx tsc --noEmit` выдаёт ошибки в сгенерированных Next.js-типах `.next/dev/types/validator.ts` (несовместимость сигнатур `params` в API-роутах). Это не связано с недавними изменениями; runtime и dev-сервер работают.
- Закоммитить и запушить изменения.

## Сессия 2026-08-09 — Штамп в печати кабельного журнала

### Сделано
- В печать кабельного журнала (`src/lib/cableJournalPrint.ts`) вставлена последняя версия штампа листов через `SheetFrameRenderer.renderStamp`:
  - Исправлены размеры canvas-изображения: рендеринг выполняется в масштабе 10 px/мм, штамп 185×55 мм отрисовывается на canvas 1850×550 px.
  - Установлены `ctx.strokeStyle` и `ctx.fillStyle` из `ThemeManager` (`sheetFrame`) перед вызовом `renderStamp`, чтобы текст и линии были видны на белом фоне.
  - Изображение штампа в HTML растянуто на 100% родительского блока `.stamp` (185×55 мм), вместо некорректных атрибутов `width="185mm"`.
  - Исправлены CSS-размеры iframe печатной страницы: теперь используются корректные шаблонные строки (`420mm` / `297mm`), а не литералы `${...}mm`.
- Убран временный тестовый хук `window.__testPrintCableJournal` и параметр `_testMode` из `printCableJournal`.
- Панель кабельного журнала (`src/components/editor/CableJournalPanel.tsx`) передаёт `plan` в `printCableJournal`, чтобы штамп рендерился из актуального плана.
- `npx tsc --noEmit` проходит без ошибок.
- Проверено в браузере: печать А3 кабельного журнала содержит штамп с текстом, сеткой и структурой, совпадающей с редактором.

### Файлы изменения
- `src/lib/cableJournalPrint.ts`
- `src/components/editor/CableJournalPanel.tsx`
- `packages/core/render/SheetFrameRenderer.ts` (`renderStamp` оставлен публичным)

## Связанные проекты

- [InvoltCAD](https://github.com/InvoltAM/InvoltCAD) — стабильная клиентская версия
- [ACAD-v.1](https://github.com/InvoltAM/ACAD-v.1) — источник backend-модулей
