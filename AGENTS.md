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

## MCP Servers

Настроены в `~/.kimi-code/mcp.json`:

- **playwright** — E2E тестирование, автоматизация браузера (`@playwright/mcp`)
- **context7** — документация библиотек (`@upstash/context7-mcp`)
- **github** — работа с репозиториями (`@modelcontextprotocol/server-github`)
- **postgres** — прямая работа с PostgreSQL (`@ahmetkca/mcp-server-postgres`)
- **docker** — управление Docker контейнерами (`mcp-server-docker`)

После изменения `mcp.json` перезапустите Kimi Code (`/reload` или новая сессия), чтобы MCP сервера подключились.
