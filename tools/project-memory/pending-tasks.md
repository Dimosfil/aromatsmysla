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

### BotHost Docker Runtime Path

Goal: make the Docker runtime start whether BotHost runs the flattened image
layout or mounts the repository root at `/app`.

Planned changes:

- [x] Update Docker startup command to choose `/app/standalone` when present.
- [x] Verify the standalone build/start path locally without printing secrets.

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
