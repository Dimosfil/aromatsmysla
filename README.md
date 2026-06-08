# Aroma Smysla Guide Bot

Standalone Docker package for the Telegram guide bot and its web admin panel.

## What Is Included

- `apps/api`: Fastify API, Telegram polling gateway, admin API, SQLite storage.
- `apps/web`: React admin panel, built into static files during Docker build.
- `packages/core` and `packages/shared`: business logic and shared contracts.
- `design`: shared admin UI design tokens used by the web build.
- `bot/assets` and `bot/guides`: media and PDF files delivered by the bot.
- `Dockerfile` and `docker-compose.yml`: one-container deployment.

## Configuration

Environment variables are loaded outside this repository by bothost. Do not
commit real `.env` files or tokens.

Use `env.docker.example` only as a reference for the required variables:

- set `TELEGRAM_BOT_TOKEN`;
- set a strong `ADMIN_PASSWORD`;
- verify `GUIDE_BOT_REQUIRED_CHANNEL_ID` and `GUIDE_BOT_REQUIRED_CHANNEL_URL`;
- keep container paths such as `/app/bot/guides/...` unchanged unless you also
  change the Docker layout.

For a plain local Docker Compose run, you may create a private local `.env`
from `env.docker.example`. Git ignores it.

## First Run

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

## Runtime Data

`docker-compose.yml` mounts `./data` to `/app/data`. This folder stores:

- SQLite files;
- edited bot content from the admin panel;
- uploaded guide/media files.

Back up `./data` before moving hosts or replacing the container.

## Telegram Requirements

- The bot must have a real BotFather token.
- The bot must be able to check channel membership for
  `GUIDE_BOT_REQUIRED_CHANNEL_ID`.
- For a channel, add the bot to the channel. Admin rights are the most reliable
  setup for `getChatMember`.
