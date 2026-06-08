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
