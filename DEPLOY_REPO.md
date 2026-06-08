# Deploy Repository

Target git repository root:

```text
D:\AI\tg-bots\aromatsmysla
```

Copy these files and folders to that repository:

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `DEPLOY_REPO.md`
- `content.seed.json`
- `env.bothost.example`
- `standalone/`

Do not copy or commit:

- `.env`
- `.env.local`
- real Telegram tokens
- real admin passwords
- runtime `data/`
- SQLite files
- logs
- generated `node_modules/` or `dist/`

On the hosting platform, use the repository root above, enable the custom
Dockerfile option, choose `Node.js`, enable a domain for the admin panel, and
upload variables from `env.bothost.example`. Leave the main file empty when the
custom Dockerfile option is enabled. Keep bot copy, channel button URL, guide
titles, button prefixes, media, and PDF paths out of env; first deploy reads
them from `standalone/bot/content.seed.json`, and later admin edits are stored
at `GUIDE_BOT_CONTENT_PATH`.
