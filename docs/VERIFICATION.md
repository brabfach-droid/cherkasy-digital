# V3 verification

Locally verified on 2 October 2026:

- npm install --ignore-scripts --prefer-offline: dependencies available.
- npm run build: TypeScript and Vite production build pass.
- npm test: 10 logic checks pass.
- npm run test:db: real PostgreSQL (PGlite), all setup modules including V3 execute twice; ownership, department boundaries, statuses, drafts, RLS, Storage, CMS archive/trash/restore and token security pass.
- V3 DB checks: linked private documents satisfy required fields; unrelated users cannot read/reuse files; linked metadata/object deletion is blocked; only authorized staff sets priority/deadline; transfers revoke the old team's access; internal notes are hidden from residents; message attachment IDs are validated; appeal public tokens expose five non-private fields and can be revoked; announcement notifications are server-created and deduplicated.
- Public UI: routes, filters, menu, guards, empty states; no page errors/overflow at desktop/tablet/mobile sizes.
- V3 public production UI: 1920, 1440, 1024, 768, 430, 390, 320px; saved dark theme, keyboard search across real content, exactly one Ctrl+K dialog, reduced motion, no horizontal overflow.
- Authenticated UI fixtures: account/staff/admin at 1920,1440,1024,768,430,390px; CMS preview/save, archive/delete, draft submit and display settings pass. UI network fixtures check rendering and interaction; server authorization is checked by the DB suite separately.
- Broadcast: 1366×768,1920×1080,2560×1440,3840×2160; alert start overlay 7s, rotation and ticker continue, all-clear 5s, stale/unknown data, critical scene, reduced motion, cursor hide and shared polling pass.
- Production V2 compatibility: announcement physical layout/dismiss/version/critical, notification popover, display, QR, reduced motion, PWA static-cache allowlist and offline fallback pass.

The user's hosted Supabase, alerts.in.ua credentials and GitHub Pages are not available in this workspace. No production database or deployment was changed. Apply the migration and upload the code using docs/UPDATE_V3.md.
