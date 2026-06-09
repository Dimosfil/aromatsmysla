# Aroma Smysla Guide Bot

For AI agents: read AGENTS.md first.

This folder is one bot profile. To create another bot, copy this folder to
another repository or profile folder, replace `.env.local`, update
`standalone/bot/content.seed.json`, and put that bot's guide files under
`standalone/bot/guides/`.

Local private config:

```text
<this bot profile root>\.env.local
```

Run this bot:

```powershell
$env:API_ENV_FILE = ".\.env.local"
node .\standalone\node_modules\tsx\dist\cli.mjs .\standalone\apps\api\src\main.ts
```

Profile files:

- `.env.example`: safe template without the real Telegram token.
- `.env.local`: private ignored runtime config with token and infrastructure.
- `content.seed.json`, `assets/`, `guides/`: source profile copies.
- `standalone/`: portable Docker package with API, web admin, shared packages,
  deploy-ready content, assets, guides, Dockerfile, compose file, and deployment
  README.
- `Dockerfile`: root-level deployment entrypoint for platforms that deploy this
  bot folder directly.
- `env.bothost.example`: safe environment template for BotHost-style deployment.

## BotHost-Style Deployment

Use these form choices:

- Platform: `Telegram`.
- Development language: `Node.js`. Do not choose Python for this repository.
- Deployment location: `Netherlands`.
- Additional settings: enable `Use domain` for the web admin.
- Additional settings: enable `Use custom Dockerfile`.
- Main file: leave empty when custom Dockerfile is enabled.
- Repository: point to the deployment repository rooted at this bot profile.
  That repository should contain the files from this bot profile, including
  `Dockerfile`, `.dockerignore`,
  `env.bothost.example`, `content.seed.json`, and `standalone/`.
- Branch: the branch that contains this folder.

Upload or paste variables from `env.bothost.example`. Set a strong
`ADMIN_PASSWORD` for the first owner account; keep `API_HOST=0.0.0.0` and
`API_PORT=3000`.

The hosting form's `Bot Token` should provide `TELEGRAM_BOT_TOKEN`. If the
platform does not map that field to the container environment, add
`TELEGRAM_BOT_TOKEN` manually as an environment variable.

If BotHost tries to run `standalone/packages/core/src/ports.ts` and fails with
`Unknown file extension ".ts"`, the form is not using the repository
`Dockerfile`. Recreate or edit the bot with `Use custom Dockerfile` enabled and
the `Main file` field empty.

Keep bot text, channel URL, guide titles, button prefixes, media, and uploaded
PDFs in `standalone/bot/content.seed.json` for Docker deploys or
`content.seed.json` when BotHost runs the flattened repository workspace. The
API checks both first-run seed locations. Admin edits are saved to
`GUIDE_BOT_CONTENT_PATH`; these values should not be managed as deployment env
variables.

Admin users, roles, password hashes, and login sessions are stored in SQLite.
`ADMIN_USERNAME` and `ADMIN_PASSWORD` are used only to create the first `owner`
when the database has no admin users yet.

For many bots, keep each profile in `bots/<bot-id>/` and give each running bot a
different `API_PORT` and `SQLITE_SESSION_PATH` when running them at the same
time.
