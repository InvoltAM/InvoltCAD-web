# InvoltCAD Web — Agent Notes

## Stack & Commands

- Next.js 16.2.10 + React 19.2.4 + TypeScript + Tailwind CSS 4
- State: Zustand 5
- ORM/DB: Prisma 7 + PostgreSQL (adapter `PrismaPg`)
- Auth: NextAuth 5 (Google + Email)
- Tests: Vitest 4 + jsdom + Testing Library

```bash
npm run dev          # start dev server
npm run build        # production build
npm test             # run unit tests
npm run test:watch   # run tests in watch mode
```

## Database

- Schema: `prisma/schema.prisma`
- After schema changes run: `npx prisma migrate dev` and regenerate the client.
- Prisma Client uses `@prisma/adapter-pg` with `pg.Pool`.

## Editor Core

- Source: `packages/core/` (ported from InvoltCAD)
- **Do not modify** `packages/core/` without updating the original InvoltCAD repo first.
- Core is framework-agnostic: no React, no Next.js, no DOM dependencies.
- React wrappers live in `src/components/editor/`.

## Key Files

- `src/components/editor/PlanEditor.tsx` — main editor component (CanvasEngine + React)
- `src/components/editor/EditorContext.tsx` — React context for engine/theme refs
- `src/stores/cadStore.ts` — Zustand store (adapted from EditorState)
- `src/lib/projects/serializer.ts` — Plan serialization/deserialization
- `src/lib/projects/sync.ts` — Cloud sync with IndexedDB cache
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/prisma.ts` — Prisma client singleton

## UI и команды (перенесено из experiment/t-junction-rooms)

- `packages/core/snap/SnapEngine.ts` — объектная привязка (endpoint, midpoint, center, intersection, extension, wall-line, tracking, grid), липкая привязка (до двух точек), направляющие лучи, привязка к центру комнаты.
- `packages/core/tools/SelectTool.ts` — базовый инструмент «Выбор», перемещение устройства drag'ом вдоль стены, перетаскивание подписей устройств, редактирование вершин комнат.
- `packages/core/tools/DeviceTool.ts` — свободное размещение светильников (потолок, центр комнаты), примагничивание к стене, определение стороны.
- `src/components/editor/PanelManager.ts` — плавающие панели (drag за заголовок, сворачивание, закрытие, магнитное прилипание).
- `src/components/editor/SheetsBar.ts` — панель листов проекта (переключение, добавление, переименование, перетаскивание, удаление).
- `src/components/editor/icons.ts` — иконки для панелей и инструментов.

## Code Style

- Prefer minimal, typed changes.
- Add/update tests for new engine and API logic.
- Keep editor core (`packages/core/`) free of framework dependencies.

## Environment Variables

See `.env.example` for all required variables.

## CI/CD

- GitHub Actions: `.github/workflows/ci.yml`
- Jobs: test (with PostgreSQL service), build, docker (on main push)
- Docker image: `involtam/involtcad-web:latest`

## AI Assistant / Analysis

AI-функционал реализован через OpenAI-compatible HTTP API. Для работы на финальной стадии разработки необходимо настроить провайдера в `.env`:

```bash
AI_API_URL=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=...
AI_MODEL=llama3-8b-8192
AI_COST_CREDITS=1
AI_ANALYZE_COST=2
```

Бесплатные варианты: **Groq**, **OpenRouter** (модели `:free`), **Together AI** (стартовые кредиты), **Ollama** (локально, бесплатно, требует ресурсов). Пока провайдер не настроен, `/api/ai/chat` и `/api/ai/analyze` возвращают «AI-провайдер не настроен».

## MCP Servers

Настроены в `~/.kimi-code/mcp.json`:

- **playwright** — E2E тестирование, автоматизация браузера (`@playwright/mcp`)
- **context7** — документация библиотек (`@upstash/context7-mcp`)
- **github** — работа с репозиториями (`@modelcontextprotocol/server-github`)
- **postgres** — прямая работа с PostgreSQL (`@ahmetkca/mcp-server-postgres`)
- **docker** — управление Docker контейнерами (`mcp-server-docker`)
- **eslint** — проверка кода на правильность (`@eslint/mcp`)
- **semgrep** — статический анализ безопасности (`mcp-server-semgrep`)

После изменения `mcp.json` перезапустите Kimi Code (`/reload` или новая сессия), чтобы MCP сервера подключились.
