# Состояние проекта InvoltCAD-web

> **Обновлено:** 2026-07-18  
> **Статус:** базовая платформа готова к развитию, MCP сервера подключены

## Что реализовано

### Инфраструктура
- Next.js 16.2.10 + React 19.2.4 + TypeScript + Tailwind CSS 4
- PostgreSQL + Prisma 7 (адаптер `PrismaPg`)
- NextAuth 5 (Google + Email, database sessions)
- Zustand для state management
- Docker + GitHub Actions CI/CD
- Vitest + Testing Library (12 тестов)

### Редактор
- Полностью перенесён из InvoltCAD в `packages/core/`
- React-обёртка: `PlanEditor`, `Toolbar`, `PropertyPanel`, `LayersPanel`, `SpecPanel`, `ValidationPanel`, `MobileMenu`, `ProjectsPanel`
- Zustand store `cadStore` (адаптация EditorState)
- Тема (light/dark) через `next-themes` + `ThemeManager`

### Облачные проекты
- API: CRUD, дублирование, сериализация Plan
- Синхронизация с IndexedDB (офлайн-кэш)
- Автосохранение (debounce 2 сек)
- `ProjectsPanel` с поиском, созданием, удалением, дублированием

### Совместный доступ
- API: приглашение, изменение роли, удаление участников
- `ShareDialog` с выбором роли (просмотр/редактирование)
- Права доступа: owner / editor / viewer

### Платежи
- YooKassa интеграция (checkout, webhook, fulfillment)
- Тарифы Free/Pro/Business с лимитами
- Кредиты и транзакции
- Страницы `/pricing`, `/billing`, `/billing/success`

### Маркетплейс
- Каталог устройств и шаблонов (`/marketplace`)
- Покупка за кредиты (комиссия 20%)
- Кабинет продавца (`/seller/dashboard`)

### MCP сервера
- **playwright** — E2E тестирование, автоматизация браузера (`@playwright/mcp`)
- **context7** — документация библиотек (`@upstash/context7-mcp`)
- **github** — работа с репозиториями (`@modelcontextprotocol/server-github`)
- **postgres** — прямая работа с PostgreSQL (`@ahmetkca/mcp-server-postgres`)
- **docker** — управление Docker контейнерами (`mcp-server-docker`)
- **eslint** — проверка кода на правильность (`@eslint/mcp`)
- **semgrep** — статический анализ безопасности (`mcp-server-semgrep`)

## Что дальше

### Приоритет 1 — Доводка платформы
1. Детальные свойства в `PropertyPanel` (стены, проёмы, устройства, кабели, размеры)
2. Экспорт PNG/PDF из редактора
3. Импорт JSON
4. Real-time синхронизация совместного доступа (WebSocket/polling)
5. Sentry мониторинг
6. E2E-тесты (Playwright)

### Приоритет 2 — Перенос фич из InvoltCAD
1. Кабельный журнал + расчёт нагрузок + автоподбор ПУЭ
2. Автотрассировка кабелей (A* + NavGrid)
3. Однолинейная схема (ОЛС)
4. Визуализация щита (DIN-рейки)
5. DXF импорт, XLSX/SVG/PDF экспорт, компоновка листов ГОСТ
6. Расчёт заземления, молниезащиты, селективности
7. Шаблоны проектов (расширенные)
8. AI-автопроектирование (rule-based)

### Приоритет 3 — Деплой
1. Создать production БД (Supabase/Neon/Railway)
2. Настроить Vercel деплой
3. Настроить домен и SSL
4. Настроить мониторинг (Sentry, Uptime Robot)

## Ключевые файлы

- `src/components/editor/PlanEditor.tsx` — главный компонент редактора
- `src/stores/cadStore.ts` — Zustand store
- `src/lib/projects/serializer.ts` — сериализация Plan
- `src/lib/projects/sync.ts` — синхронизация с IndexedDB
- `src/lib/auth.ts` — NextAuth
- `src/lib/prisma.ts` — Prisma client
- `prisma/schema.prisma` — схема БД
- `.github/workflows/ci.yml` — CI/CD

## Связанные проекты

- [InvoltCAD](https://github.com/InvoltAM/InvoltCAD) — стабильная клиентская версия
- [ACAD-v.1](https://github.com/InvoltAM/ACAD-v.1) — источник backend-модулей
