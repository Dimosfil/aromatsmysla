# Guide Bot Content Delivery

## Goal

Guide materials and media must work after BotHost/Docker deployment without depending on an administrator workstation path such as `C:\Users\...`.

## Runtime Contract

- Admin uploads are written by the API to `GUIDE_BOT_UPLOAD_DIR`; saved admin content should reference the returned server path.
- A guide may set an optional `fileName`. When present, Telegram uses it as the
  download filename while retaining the stored server path as the file source.
- Each guide material may define its own `photoPath`. Material-specific photos take precedence over the global delivered-message `media.deliveredPhotoPath` fallback.
- Seeded files may live under `guides/`, `bot/guides/`, `/app/guides/`, or `/app/bot/guides/` depending on the deployment layout.
- Legacy local absolute paths are tolerated only as lookup hints: runtime resolution may use their portable basename to search deployed guide/upload folders, but the host cannot read the original workstation path.
- Document delivery tries an existing filesystem path first, then Telegram post link, then Telegram `file_id`. This keeps newly uploaded admin files from being shadowed by stale Telegram fallback fields.
- Delivered-message captions append the guide title only when the configured `deliveredPrefix` does not already contain that title. A `{title}` placeholder in `deliveredPrefix` is replaced explicitly.
- The admin panel must block saving a workstation-local material/media path when there is no Telegram `file_id` or Telegram post link fallback for that material.

## Verification

- `npm run typecheck`
- `npm run test:api`
- `npm run build`
