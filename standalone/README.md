# Aroma Smysla Guide Bot

Standalone Docker package for the Telegram guide bot and its web admin panel.

## What Is Included

- `apps/api`: Fastify API, Telegram polling gateway, admin API, SQLite storage.
- `apps/web`: React admin panel, built into static files during Docker build.
- `packages/core` and `packages/shared`: business logic and shared contracts.
- `design`: shared admin UI design tokens used by the web build.
- `bot/assets` and `bot/guides`: media and PDF files delivered by the bot.
- `Dockerfile` and `docker-compose.yml`: one-container deployment.

## First Run

```powershell
Copy-Item env.docker.example .env
```

Edit `.env`:

- set `TELEGRAM_BOT_TOKEN`;
- set a strong `ADMIN_PASSWORD` for the first owner account;
- verify `GUIDE_BOT_REQUIRED_CHANNEL_ID`;
- keep first-run guide titles, messages, photos, and guide files in
  `bot/content.seed.json`, then edit them from the admin panel after the first
  start.

Start:

```powershell
docker compose up -d --build
```

Open the admin panel:

```text
http://localhost:3000
```

Health check:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/health
```

## BotHost-Style Deployment

Use these form choices:

- Platform: `Telegram`.
- Development language: `Node.js`. Do not choose Python for this package.
- Deployment location: `Netherlands`.
- Additional settings: enable `Use domain` for the web admin.
- Additional settings: enable `Use custom Dockerfile`.
- Main file: leave empty when custom Dockerfile is enabled.
- Repository: point to a repository whose root is this `standalone` folder.

Upload or paste variables from `env.bothost.example`.

The hosting form's `Bot Token` should provide `TELEGRAM_BOT_TOKEN`. If the
platform does not map that field to the container environment, add
`TELEGRAM_BOT_TOKEN` manually as an environment variable.

## Runtime Data

`docker-compose.yml` mounts `./data` to `/app/data`. This folder stores:

- SQLite files;
- admin users, roles, password hashes, and login sessions;
- edited bot content from the admin panel;
- uploaded guide/media files.

Back up `./data` before moving hosts or replacing the container.

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are bootstrap values only. On the first
startup with an empty SQLite database, the API creates an active `owner` user
from them. After that, manage users, roles, and password resets from the admin
panel.

## Content Ownership

Deployment environment variables are for infrastructure: token, channel,
bootstrap admin login, SQLite paths, and data paths. Bot copy, channel URL, guide titles,
button prefixes, selection photos, and delivered files are runtime content.
First-run defaults live in `bot/content.seed.json`; admin edits are stored in
`GUIDE_BOT_CONTENT_PATH`.

## Telegram Requirements

- The bot must have a real BotFather token.
- The bot must be able to check channel membership for
  `GUIDE_BOT_REQUIRED_CHANNEL_ID`.
- For a channel, add the bot to the channel. Admin rights are the most reliable
  setup for `getChatMember`.
