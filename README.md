# InvoltCAD Web

Веб-платформа для проектирования электроснабжения помещений. Редактор планировки + облачные проекты + маркетплейс.

## Стек

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Editor Core:** собственный Canvas 2D движок (перенесён из InvoltCAD)
- **Backend:** Next.js API routes, PostgreSQL, Prisma 7
- **Auth:** NextAuth 5 (Google, Email)
- **Payments:** YooKassa
- **State:** Zustand

## Быстрый старт

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Настройка окружения
cp .env.example .env
# Заполните DATABASE_URL, NEXTAUTH_SECRET и другие переменные

# Генерация Prisma client
npx prisma generate

# Миграции БД
npx prisma migrate dev

# Запуск dev-сервера
npm run dev
```

Откройте http://localhost:3000

### Docker

```bash
# Запуск всего стека (app + PostgreSQL)
docker-compose up -d

# Логи
docker-compose logs -f app
```

## Скрипты

```bash
npm run dev          # Dev-сервер
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm test             # Юнит-тесты (Vitest)
npm run test:watch   # Тесты в watch-режиме
npm run test:coverage # Тесты с покрытием
```

## Структура

```
involtcad-web/
├── packages/core/          # Editor core (перенесён из InvoltCAD)
│   ├── geometry/           # Vector2, Polygon, RoomDetector
│   ├── model/              # Plan, Wall, Opening, Device, Cable, Dimension
│   ├── render/             # Canvas-рендереры
│   ├── snap/               # Snap engine
│   ├── rules/              # Валидация
│   ├── catalogs/           # Каталоги устройств/кабелей
│   ├── engine/             # CanvasEngine, Camera, InputManager
│   ├── editor/             # CommandManager, EditorState, ThemeManager
│   └── tools/              # WallTool, DoorTool, SelectTool и т.д.
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── editor/         # Страница редактора
│   │   ├── login/          # Авторизация
│   │   ├── marketplace/    # Маркетплейс
│   │   ├── pricing/        # Тарифы
│   │   └── billing/        # Биллинг
│   ├── components/         # React-компоненты
│   │   └── editor/         # UI редактора
│   ├── stores/             # Zustand stores
│   ├── lib/                # Бизнес-логика
│   │   ├── auth.ts         # NextAuth
│   │   ├── prisma.ts       # Prisma client
│   │   ├── projects/       # Проекты (sync, serializer, access)
│   │   ├── billing/        # Платежи (limits, fulfillment, yookassa)
│   │   └── marketplace/    # Маркетплейс
│   └── types/              # TypeScript типы
├── prisma/
│   └── schema.prisma       # Схема БД
├── .github/workflows/      # CI/CD
├── Dockerfile
├── docker-compose.yml
└── vitest.config.ts        # Конфигурация тестов
```

## Документация

- [HYBRID_MIGRATION_PLAN.md](../3.%20Project%20InvoltCAD/docs/HYBRID_MIGRATION_PLAN.md) — план миграции
- [AGENTS.md](AGENTS.md) — заметки для агентов
- [DEPLOY.md](DEPLOY.md) — инструкция по деплою

## Связанные проекты

- [InvoltCAD](https://github.com/InvoltAM/InvoltCAD) — стабильная клиентская версия редактора (Vite + TypeScript)
- [ACAD-v.1](https://github.com/InvoltAM/ACAD-v.1) — старый проект (источник backend-модулей)
