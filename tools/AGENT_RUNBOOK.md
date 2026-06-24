# Agent Runbook

Every command should be copy-pasteable from the project root.

## Install

```powershell
npm ci --prefix .\standalone
```

## Run

```powershell
$env:API_ENV_FILE = ".\.env.local"
node .\standalone\node_modules\tsx\dist\cli.mjs .\standalone\apps\api\src\main.ts
```

## Test

```powershell
npm run test --prefix .\standalone
```

## Build

```powershell
npm run build --prefix .\standalone
```

## Smoke Check

```powershell
npm run smoke:api --prefix .\standalone
```

Expected result:

```text
The API smoke script injects GET /health and exits successfully when it returns
HTTP 200.
```

## Logs

```powershell
docker compose --project-directory .\standalone logs --tail 100 guide-bot
```

## Environment Notes

- Local private config is `.env.local` at the bot profile root.
- Safe templates are `.env.example`, `env.bothost.example`,
  `standalone\.env.example`, and `standalone\env.docker.example`.
- Do not print or commit real Telegram tokens, admin passwords, API keys,
  SQLite data, uploads, logs, or generated caches.
- Docker Compose uses `standalone\docker-compose.yml` and maps
  `standalone\data` to `/app/data`.
