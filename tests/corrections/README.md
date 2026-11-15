# Match correction regression tests

Tests use a local PostgreSQL engine (PGlite), seeded fictional users and matches, and Playwright. They do not log into or modify the production database. Browser REST requests are intercepted and executed against the local database, including the real migration RPCs and RLS.

## Install

```sh
npm install --prefix tests/corrections
npx --prefix tests/corrections playwright install --with-deps chromium
```

## Database / permissions

```sh
node tests/corrections/database.cjs
```

Covers repeatable migration, atomic scores and rollback, scorer/team/type changes, cancellation, reasons, stale revisions, notifications, live/post-match corrections, finalisation, admin reopening, immutable audit trail, invalid inputs and unauthorised API calls.

## Browser

Build the app with **test-only** configuration (do not deploy this build):

```sh
REACT_APP_SUPABASE_URL=https://placeholder.supabase.co REACT_APP_SUPABASE_ANON_KEY=test-anon-key npm run build
node tests/corrections/server.cjs
```

In another terminal:

```sh
node tests/corrections/browser.cjs
```

The server defaults to port 8765. Set TEST_BASE_URL if using another static SPA server. Screenshots go to ignored `artifacts/`. Covers phone and desktop controls, scored-player edit, cancellation, post-full-time entry, finalisation, completed-match history, admin reopening, fan timeline and player goal tallies.

## Production setup

Run `supabase/migration-event-corrections.sql` in Supabase SQL Editor. It adds RPCs, audit storage, soft-cancellation and report columns, and replaces broad commissioner write access with assigned-match checks. New controls remain disabled with a setup notice until the database migration is present. Existing historical scores are preserved; corrections apply deltas, not a destructive recount. Older events only acquire audit entries when changed after installation.

If match notification helpers are already installed, corrections also send notifications. This migration does not install the broader match-start notification system; that remains in `migration-match-notifications.sql`. When setting up a fresh database, run the notifications migration before the corrections migration (the latter includes the full event-type constraint, including fouls).

The match-history selector is explicitly calendar year, not a new cross-year league-season data model.
