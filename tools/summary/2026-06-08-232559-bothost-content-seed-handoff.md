# BotHost Content Seed Handoff

Date: 2026-06-08

## Current State

- Branch `main` is clean and synced with `origin/main`.
- Latest pushed commit:
  - `de67be7 Support BotHost runtime deployment`
- Verified before push:
  - `npm run build -w @telegram-bot-template/api`
  - `npm run test -w @telegram-bot-template/api`

## What Was Fixed

- App now accepts BotHost token fallback variables:
  - `TELEGRAM_BOT_TOKEN`
  - `BOT_TOKEN`
  - `BOT_API_TOKEN`
  - `API_TOKEN`
- BotHost env examples include guide-mode runtime variables.
- Local absolute path references were removed from deploy docs/env examples.

## Current BotHost Issue

The admin panel is showing English defaults, which means the guide bot profile
is active but the content seed is not being loaded.

Observed BotHost env had:

```text
GUIDE_BOT_CONTENT_PATH=/app/data/guide-bot-content.json
GUIDE_BOT_CONTENT_SEED_PATH=/app/bot/content.seed.json
GUIDE_BOT_UPLOAD_DIR=/app/data/uploads
```

Observed BotHost file manager showed root-level content files under `/app`,
including:

```text
/app/content.seed.json
/app/guides
/app/data
/app/standalone
```

It did not clearly show `/app/bot`, so `/app/bot/content.seed.json` may be the
wrong seed path for this BotHost runtime layout.

## Recommended Next Steps

1. In BotHost env, keep:

```text
GUIDE_BOT_CONTENT_PATH=/app/data/guide-bot-content.json
GUIDE_BOT_UPLOAD_DIR=/app/data/uploads
```

2. Change seed path to:

```text
GUIDE_BOT_CONTENT_SEED_PATH=/app/content.seed.json
```

3. In BotHost file manager, open `/app/data`.
4. If `/app/data/guide-bot-content.json` exists, delete it or replace its
   contents with `/app/content.seed.json`.
5. Restart/redeploy the bot.
6. Reopen the admin panel.
7. Do not click `Save` until the admin panel shows the Russian seed content.

## Why Deleting Runtime Content Matters

`GUIDE_BOT_CONTENT_PATH` is the runtime admin content file. If it exists, the
app uses it first and ignores the seed. The seed is only a first-run fallback.

Load order:

1. `/app/data/guide-bot-content.json`
2. `GUIDE_BOT_CONTENT_SEED_PATH`
3. built-in English defaults

Therefore, changing `GUIDE_BOT_CONTENT_SEED_PATH` alone will not change the
admin panel if `/app/data/guide-bot-content.json` already exists.
