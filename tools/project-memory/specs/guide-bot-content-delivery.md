# Guide Bot Content Delivery

## Goal

Guide materials and media must work after BotHost/Docker deployment without depending on an administrator workstation path such as `C:\Users\...`.

## Runtime Contract

- Admin uploads are written by the API to `GUIDE_BOT_UPLOAD_DIR`; saved admin content should reference the returned server path.
- Each guide material may define its own `photoPath`. Material-specific photos take precedence over the global delivered-message `media.deliveredPhotoPath` fallback.
- Seeded files may live under `guides/`, `bot/guides/`, `/app/guides/`, or `/app/bot/guides/` depending on the deployment layout.
- Legacy local absolute paths are tolerated only as lookup hints: runtime resolution may use their portable basename to search deployed guide/upload folders, but the host cannot read the original workstation path.
- Document delivery tries configured sources in this order: Telegram post link, Telegram `file_id`, then filesystem path. If a Telegram post link fails, delivery must fall back to the next configured source instead of aborting immediately.
- The admin panel must block saving a workstation-local material/media path when there is no Telegram `file_id` or Telegram post link fallback for that material.

## Verification

- `npm run typecheck`
- `npm run test:api`
- `npm run build`
