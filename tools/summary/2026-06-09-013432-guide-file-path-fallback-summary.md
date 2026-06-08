# Guide File Path Fallback Handoff

Date: 2026-06-09

## Current State

- Latest pushed commit on `main`:
  - `f794213 Load guide content seed across BotHost layouts`
- That commit fixed BotHost seed loading across:
  - `/app/bot/content.seed.json`
  - `/app/content.seed.json`
- The admin panel now shows Russian seed content and guide rows.
- Telegram bot now sends the seeded welcome/subscription messages and guide
  selection buttons.

## Remaining Local Work

The next issue found was seeded guide PDF delivery:

- Admin content correctly contains paths like:
  - `guides/aroma-vanna-guide.pdf`
  - `guides/7-essential-oils-women-state.pdf`
- The bot attempted to read those paths literally from the runtime working
  directory.
- On BotHost, the real files may live under a different layout, such as:
  - `/app/guides/...`
  - `/app/bot/guides/...`
  - sibling paths when the process starts inside `standalone/`

Local changes were made but are not committed or pushed yet:

- `standalone/apps/api/src/telegramPollingGateway.ts`
  - Adds `resolveTelegramFilePath`.
  - Resolves document/photo paths across Docker and flattened BotHost layouts.
  - Keeps admin-uploaded absolute paths working first.
- `standalone/apps/api/src/tests/telegramGateway.test.ts`
  - Adds `testTelegramFilePathFallback`.
- `tools/project-memory/pending-tasks.md`
  - Adds and completes `BotHost Guide File Path Fallback`.

## Verification Already Run

Both passed after the local guide-file fallback changes:

```powershell
npm run test -w @telegram-bot-template/api
npm run build -w @telegram-bot-template/api
```

## Git Status Notes

Expected local modified files:

- `standalone/apps/api/src/telegramPollingGateway.ts`
- `standalone/apps/api/src/tests/telegramGateway.test.ts`
- `tools/project-memory/pending-tasks.md`

Existing untracked file from the previous handoff remains:

- `tools/summary/2026-06-08-232559-bothost-content-seed-handoff.md`

Do not include that old untracked file unless the user explicitly wants it.

## Recommended Next Step

If the user says `ги пуш`, commit and push only the guide-file fallback changes:

```text
Resolve guide files across BotHost layouts
```

Then redeploy/restart BotHost from `main` and test clicking both guide buttons
in Telegram.
