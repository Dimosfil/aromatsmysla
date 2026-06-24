# Technology Stack

Last reviewed: 2026-06-24

Canonical source: this file
Linked from: `README.md`

This is project documentation. Keep business rules, feature algorithms, workflow
contracts, state machines, and verification guarantees in project memory; keep
stack facts, commands, runtime assumptions, and operational notes here.

## Summary

- Primary stack: Node.js 20, TypeScript, Fastify API, React/Vite admin panel.
- Runtime model: one deployable Telegram bot profile with a standalone npm
  workspace and Docker/BotHost deployment assets.
- Current confidence: verified from manifests, Dockerfiles, source entry
  points, and existing README/runbook evidence.

## Components

| Layer | Technology | Evidence | Notes |
| --- | --- | --- | --- |
| Language/runtime | TypeScript on Node.js >=20, ESM modules | `standalone/package.json`, `Dockerfile`, `standalone/Dockerfile` | Runtime images use `node:20-alpine`. |
| Backend/API | Fastify 5 API | `standalone/apps/api/package.json`, `standalone/apps/api/src/server.ts` | Serves `/health`, Telegram/admin APIs, and built admin web files. |
| Telegram integration | Telegram Bot API polling and membership checks | `standalone/apps/api/src/telegramPollingGateway.ts`, `standalone/apps/api/src/TelegramSubscriptionChecker.ts` | Uses `fetch` against `https://api.telegram.org/bot...`; secrets come from env. |
| Frontend | React 18, React DOM, TanStack Query, Vite 6 | `standalone/apps/web/package.json`, `standalone/apps/web/src/App.tsx`, `standalone/apps/web/vite.config.ts` | Admin panel builds to static files served by the API. |
| Shared packages | npm workspaces `apps/*` and `packages/*` | `standalone/package.json`, `standalone/packages/core/package.json`, `standalone/packages/shared/package.json` | `core` holds bot/domain logic; `shared` holds contracts. |
| Data/storage | SQLite through `sql.js`; JSON content overlay; filesystem uploads | `standalone/apps/api/package.json`, `standalone/apps/api/src/storage/SqliteDatabase.ts`, `standalone/apps/api/src/config.ts` | Runtime paths are configured with `SQLITE_*`, `GUIDE_BOT_CONTENT_PATH`, and `GUIDE_BOT_UPLOAD_DIR`. |
| Build/package | npm workspaces, TypeScript compiler, Vite | `standalone/package.json`, workspace package manifests | Root deployment Dockerfile builds the `standalone/` workspace. |
| Test/quality | TypeScript typecheck, API test script, API smoke script | `standalone/package.json`, `standalone/apps/api/package.json`, `standalone/apps/api/src/tests/telegramGateway.test.ts`, `standalone/apps/api/src/smoke.ts` | No separate lint config was verified beyond the workspace `lint --if-present` script. |
| Deployment/runtime | Docker, Docker Compose, BotHost custom Dockerfile flow | `Dockerfile`, `standalone/Dockerfile`, `standalone/docker-compose.yml`, `README.md`, `standalone/README.md` | Root `Dockerfile` supports deployment from this profile root; `standalone/` can also deploy as its own package. |

## Commands

Run from the project root unless noted.

| Purpose | Command | Evidence |
| --- | --- | --- |
| Install | `npm ci --prefix .\standalone` | `standalone/package-lock.json`, `standalone/package.json` |
| Local API run | `$env:API_ENV_FILE = ".\.env.local"; node .\standalone\node_modules\tsx\dist\cli.mjs .\standalone\apps\api\src\main.ts` | `README.md`, `standalone/apps/api/package.json`, `standalone/apps/api/src/main.ts` |
| Standalone API dev | `npm run dev:api --prefix .\standalone` | `standalone/package.json` |
| Standalone web dev | `npm run dev:web --prefix .\standalone` | `standalone/package.json`, `standalone/apps/web/vite.config.ts` |
| Test | `npm run test --prefix .\standalone` | `standalone/package.json` |
| Typecheck | `npm run typecheck --prefix .\standalone` | `standalone/package.json` |
| Build | `npm run build --prefix .\standalone` | `standalone/package.json` |
| API smoke | `npm run smoke:api --prefix .\standalone` | `standalone/package.json`, `standalone/apps/api/src/smoke.ts` |
| Full workspace check | `npm run check --prefix .\standalone` | `standalone/package.json` |
| Docker Compose start | `docker compose --project-directory .\standalone up -d --build` | `standalone/README.md`, `standalone/docker-compose.yml` |
| Health check | `Invoke-RestMethod -Uri http://localhost:3000/health` | `standalone/README.md`, `standalone/apps/api/src/server.ts` |

## External Services

| Service | Role | Evidence | Boundary |
| --- | --- | --- | --- |
| Telegram Bot API | Bot polling, message delivery, channel membership checks | `standalone/apps/api/src/telegramPollingGateway.ts`, `standalone/apps/api/src/TelegramSubscriptionChecker.ts` | Requires `TELEGRAM_BOT_TOKEN`; never commit or print real tokens. |
| BotHost-style hosting | Production-style container hosting target | `README.md`, `env.bothost.example`, `Dockerfile` | Uses custom Dockerfile and environment variables; secrets stay in hosting config. |

## Gaps

- No non-placeholder project-specific lint command was verified; workspace
  `lint` is `npm run lint --workspaces --if-present`.
- No live service health check was run for this inventory; facts are verified
  from repository files only.
