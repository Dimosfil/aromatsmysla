# Pending Tasks

Use this file for active project-wide plans and multi-step work.

Keep entries concise and task-relevant. Do not store full diffs, large logs,
generated outputs, secrets, credentials, or private production data.

## Status Markers

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked or needs attention

## Tasks

### BotHost Terminal Constraints

Observation: BotHost web terminal is an allowlisted shell inside the running
container, not a full Docker host shell.

Known constraints:

- [x] `docker ps` and other Docker control commands are blocked by BotHost
  security policy.
- [x] Shell/JS snippets containing command separators or separator-like tokens
  can be rejected with `Использование разделителей команд запрещено`.
- [x] `ps` is allowed and shows the Node API process when the app is running.
- [x] Node `fetch("http://127.0.0.1:3000/health")` works for API smoke checks
  when written without suspicious shell separators.

Diagnostic preference:

- [x] Prefer simple `ps`, `env`, and minimal `node -e` one-liners.
- [x] Avoid recommending `docker ps`, `docker exec`, chained shell commands, or
  complex JS one-liners for BotHost terminal troubleshooting.

### BotHost Workspace Link Build

Goal: make BotHost runtime builds restore npm workspace links before TypeScript
compilation.

Planned changes:

- [x] Reproduce or isolate why `core` cannot resolve the `shared` workspace.
- [x] Update the Docker startup build path to refresh workspace links reliably.
- [x] Verify the standalone build after the change.

### BotHost Docker Runtime Path

Goal: make the Docker runtime start whether BotHost runs the flattened image
layout or mounts the repository root at `/app`.

Planned changes:

- [x] Update Docker startup command to choose `/app/standalone` when present.
- [x] Verify the standalone build/start path locally without printing secrets.
- [x] Ensure runtime builds restore workspace links before compiling on BotHost.

### Local Docker Env Startup

Goal: start the guide bot container with the private local runtime env.

Planned changes:

- [x] Check that `.env.local` exists and contains required values without
  printing secrets.
- [x] Pass the local env file into Docker Compose.
- [x] Recreate the container and verify `/health` from the host.

### Docker Runtime ESM Startup

Goal: make the Docker runtime start the built API successfully on Node.js 20.

Planned changes:

- [x] Verify local Docker build and runtime failure mode.
- [x] Update Docker entrypoint to use the working ESM-compatible runner.
- [x] Rebuild and smoke-check the container locally.

Verification:

- [x] `docker build -t aromatsmysla-local:latest .`
- [x] Confirm `/app/apps/api/dist/main.js` exists inside the image.
- [x] Check `/health` and admin web root on the local container.
- [x] `docker build -t aromatsmysla-standalone-local:latest .\standalone`

### BotHost Deploy Push Prep

Goal: prepare the repository root for a safe Git push and BotHost custom
Dockerfile deployment.

Planned changes:

- [x] Verify deploy files, ignore rules, and BotHost form instructions.
- [x] Update deploy-facing docs and env templates where they are stale.
- [x] Run a focused build/check that matches the Docker deployment path.

Execution order:

- [x] Inspect current Git status and deployment artifacts.
- [x] Apply scoped documentation/config hygiene changes.
- [x] Verify build and report exact BotHost form values.

Risks or dependencies:

- [x] Do not commit `.env.local`, runtime data, logs, SQLite files, or real
  tokens/passwords.

Verification:

- [x] `npm run build` in `standalone/`.
- [x] `npm run test` in `standalone/`.
- [x] `npm run smoke:api` in `standalone/`.
- [!] `docker build -t aromatsmysla-bothost-check .` requires Docker Desktop
  daemon; it was not running locally.

### BotHost Admin Web Root Fallback

Goal: make the deployed API serve the admin panel even when BotHost runs from
either the flattened Docker image layout or a repository-root workspace layout.

Planned changes:

- [x] Confirm BotHost logs show the web build succeeds but `/` returns 404.
- [x] Add admin web root fallback resolution for known runtime layouts.
- [x] Verify build and a local admin-root request.

### TODO Task Name

Goal: TODO

Planned changes:

- [ ] TODO

Execution order:

- [ ] TODO

Risks or dependencies:

- [ ] TODO

Verification:

- [ ] TODO

### BotHost Content Seed Fallback

Goal: make the admin content API load the aromatsmysla seed when BotHost uses
either the Docker `/app/bot/content.seed.json` layout or a flattened
`/app/content.seed.json` workspace layout.

Planned changes:

- [x] Add seed fallback path resolution in the admin content store.
- [x] Cover the wrong-env-path plus fallback-seed scenario with a focused test.
- [x] Verify API tests/build.

### BotHost Guide File Path Fallback

Goal: make seeded guide PDF and media paths work for customer-facing BotHost
deployments without manual admin uploads.

Planned changes:

- [x] Resolve relative guide/media paths across Docker and flattened BotHost
  layouts.
- [x] Add focused tests for path fallback resolution.
- [x] Verify API tests/build.
