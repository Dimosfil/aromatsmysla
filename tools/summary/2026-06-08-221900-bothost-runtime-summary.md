# BotHost Runtime Troubleshooting Summary

Date: 2026-06-08

## Context

The bot runs locally, but BotHost Docker deployment initially did not respond
correctly in Telegram. The BotHost web terminal is restricted and should be
treated as an allowlisted shell inside the running container, not a full Docker
host shell.

## Findings

- BotHost terminal blocks Docker control commands such as `docker ps`.
- BotHost terminal can reject complex shell/JS snippets with
  `Использование разделителей команд запрещено`.
- Allowed diagnostics observed:
  - `ps`
  - `env`
  - simple `node -e` calls without shell separators
- `ps` showed the Node API process running:
  `node node_modules/tsx/dist/cli.mjs apps/api/dist/main.js`
- Local API smoke check inside BotHost succeeded:
  `GET http://127.0.0.1:3000/health`
- BotHost exposes token-like system variables such as `BOT_TOKEN`,
  `BOT_API_TOKEN`, and `API_TOKEN`, while the app originally required
  `TELEGRAM_BOT_TOKEN`.
- Telegram replies with the default template text mean the app is running but
  the guide bot profile is not active. The required guide-mode env includes
  `GUIDE_BOT_REQUIRED_CHANNEL_ID=@aromatsmysla` and content seed paths.
- BotHost UI may set or show a `WEBHOOK_URL`, but this project currently uses
  Telegram polling, not webhook handling.
- BotHost logs panel showed a platform-side issue:
  `WARNING: Реальные логи недоступны` and `INFO: Обратитесь к администратору`.

## Changes Made

- Updated `standalone/apps/api/src/config.ts` so Telegram token lookup accepts
  BotHost-provided fallbacks:
  - `TELEGRAM_BOT_TOKEN`
  - `BOT_TOKEN`
  - `BOT_API_TOKEN`
  - `API_TOKEN`
- Added a focused test for the `BOT_TOKEN` fallback in
  `standalone/apps/api/src/tests/telegramGateway.test.ts`.
- Updated `env.bothost.example` and `standalone/env.bothost.example` with the
  safe BotHost deployment variables:
  - `API_HOST=0.0.0.0`
  - `API_PORT=3000`
  - `PORT=3000`
  - `TELEGRAM_POLLING_ENABLED=true`
  - `GUIDE_BOT_REQUIRED_CHANNEL_ID=@aromatsmysla`
  - `GUIDE_BOT_REQUIRED_CHANNEL_URL=https://t.me/aromatsmysla`
  - `/app/data` SQLite/content/upload paths
  - `GUIDE_BOT_CONTENT_SEED_PATH=/app/bot/content.seed.json`
- Documented BotHost terminal constraints in
  `tools/project-memory/pending-tasks.md`.

## Verification

Passed locally:

```powershell
npm run build -w @telegram-bot-template/api
npm run test -w @telegram-bot-template/api
```

## Current Dirty Files

- `env.bothost.example`
- `standalone/apps/api/src/config.ts`
- `standalone/apps/api/src/tests/telegramGateway.test.ts`
- `standalone/env.bothost.example`
- `tools/project-memory/pending-tasks.md`
- this summary file

## Next Steps

1. Commit and push the scoped BotHost compatibility/env changes.
2. Redeploy BotHost from the updated repository.
3. In BotHost, import or set safe env values from `env.bothost.example`.
4. Keep the real token only in BotHost's Bot Token/system variable fields; do
   not commit it.
5. Ensure no other machine is polling the same Telegram bot token.
6. After BotHost replies with the guide-profile text, configure or migrate
   runtime admin content and uploads under `/app/data`.
7. Contact BotHost support if the platform status remains `creating` or real
   logs remain unavailable despite `/health` returning ok.
