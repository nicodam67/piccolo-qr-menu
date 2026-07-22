# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single full-stack **Next.js 16 + PostgreSQL** app (Piccolo QR Menu). There is no separate backend, Docker, or message queue. Standard commands live in `README.md` and `package.json` scripts; only non-obvious, durable notes are below.

### Services

- **Next.js dev server** — `npm run dev` on port `3000`. `/` redirects to `/es` (public menu); `/login` + `/admin/*` are the session-protected admin panel.
- **PostgreSQL 16** — local cluster, DB `piccolo_qr_menu`, role `piccolo`/`piccolo`. It does **not** auto-start on VM boot; start it before running the app or tests:

  ```bash
  sudo pg_ctlcluster 16 main start
  ```

### Environment

- `.env` is git-ignored and already provisioned in the VM snapshot with a working local `DATABASE_URL`, a generated `AUTH_SECRET`, and admin bootstrap vars. Admin login for local testing: `admin@piccolo.local` / `PiccoloAdmin123!`.
- Migrations, demo seed, and the admin user have already been applied to the local DB (persisted in the snapshot). After changing `src/db/schema.ts`, run `npm run db:generate` then `npm run db:migrate`. The seed (`npm run db:seed`) is idempotent.

### Checks / tests

- Lint/typecheck/build/E2E commands are in `README.md` (`## Comprobaciones`). E2E is `npx playwright test`.
- Playwright uses Chrome hardcoded at `/usr/local/bin/google-chrome` (see `playwright.config.ts`) and reuses an already-running dev server on port 3000 (`reuseExistingServer: true`), so keep `npm run dev` running or let Playwright start it.

### Gotchas

- Outbound HTTP (port 80) to the Ubuntu package mirrors is blocked in this environment, but HTTPS works. `/etc/apt/sources.list.d/ubuntu.sources` has been switched to `https://` mirrors so `apt-get` succeeds; keep that if you need to install system packages.
