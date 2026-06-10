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

### Telegram Reply Keyboard Buttons

Goal: add support for Telegram reply-keyboard buttons shown under the message
input.

Planned changes:

- [x] Add shared response typing for reply keyboards.
- [x] Serialize reply keyboards in the Telegram polling gateway.
- [x] Attach a guide-bot menu keyboard to relevant responses.
- [x] Add focused verification for the Telegram API payload.

### Admin User Password Save

Goal: make password changes for existing admin users save through the expected
user edit flow.

Planned changes:

- [x] Make the existing-user save action apply a filled "new password" field.
- [x] Refresh user data after password reset so timestamps and status are clear.
- [x] Add focused API coverage for admin password reset and new-login behavior.
- [x] Run focused verification.

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

### BotHost Admin Web Startup Guard

Goal: prevent BotHost from serving API-only 404 at `/` when the API build
exists but the web admin `dist` output is missing.

Planned changes:

- [x] Default `ADMIN_WEB_DIR` to the Docker web dist path.
- [x] Rebuild on container startup when API or web build output is missing.
- [x] Verify build and local container root response.

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

### Admin PDF Upload Limit

Goal: allow admin-managed guide PDF uploads through the BotHost admin panel.

Planned changes:

- [x] Add a configurable upload body limit for guide bot uploads.
- [x] Cover large PDF uploads with a focused API test.
- [x] Verify API tests/build.

### Telegram File ID Guide Delivery

Goal: allow guide documents to be delivered from Telegram storage by file_id,
while keeping local/admin-uploaded PDF paths working.

Planned changes:

- [x] Add `telegramFileId` to guide content/runtime/shared types.
- [x] Send Telegram documents by `file_id` when configured, falling back to
  local `filePath`.
- [x] Add an admin field for Telegram file_id on each guide.
- [x] Cover Telegram-link/file_id delivery with focused tests and run
  verification.
# 2026-06-09 Auth Module

- [x] Move admin credentials from env-only checks into SQLite-backed auth users.
- [x] Add roles, persistent admin sessions, user management, and password change endpoints.
- [x] Add admin UI for users and password changes.
- [x] Update focused API tests and run verification.

### Configuration Boundary Audit

Goal: align the existing codebase with the instruction-kit rule that
deployment, user, runtime, service, credential, path, feature-flag, and
operational-policy values belong in project-local config, environment variables,
service discovery records, or secret references.

Planned changes:

- [ ] Audit targeted runtime, deploy, and admin paths for hard-coded ports, URLs,
  hostnames, credentials, private paths, user names, feature toggles, limits,
  model names, deployment folders, and environment-specific switches.
- [ ] Refactor low-risk findings into existing configuration surfaces.
- [ ] Record any larger cleanup items as separate durable tasks.
