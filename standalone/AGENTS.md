# Agent Instructions

## Runtime Checks

- Treat Docker checks as production-like checks, not only local build checks.
- Before reporting a Docker run as working, verify the container with the same
  runtime contract expected in deployment: real `.env` values, `API_HOST=0.0.0.0`,
  published host port, persistent `/app/data`, and Telegram polling settings.
- A running container is not enough. After `docker compose up -d --build`, check
  `docker compose ps`, inspect recent logs, and probe the app from the host via
  the published URL, for example `http://127.0.0.1:${HOST_PORT:-3000}/health`.
- Do not print secrets such as `TELEGRAM_BOT_TOKEN`. Check only whether required
  secret variables are present.
- If the app only listens on `127.0.0.1` inside Docker, treat that as a blocker
  for production-like verification and fix or set `API_HOST=0.0.0.0` before
  saying the deployment is reachable.
