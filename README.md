# FCB Under 19 Football League

A complete football league management web app with **five roles** (Admin, Commissioner, Manager, Player, Fan), a **Supabase** (Postgres) backend, real email/password login, and **real-time live match control**.

Built with React (Create React App), MUI and Supabase.

## Roles & features

| Role | What they can do |
| --- | --- |
| **Fan** | Dashboard, matches (live/scheduled/finished), live scores, standings, teams, news |
| **Player** | Everything a fan can do + My Team page (squad, fixtures, personal events) |
| **Manager** | Team dashboard with squad, fixtures/results, league position |
| **Commissioner** | **Live Match Control** (start/end matches, record goals & cards in real time), Match Events browser, Match Reports |
| **Admin** | Everything + manage users (roles/team assignments), teams, matches, news, officials, league settings |

Live updates use Supabase Realtime: when the commissioner records a goal, every open screen (fan dashboards, match pages) updates instantly.

## 1. Set up the database (one time, ~5 minutes)

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste the **entire contents of [`supabase/schema.sql`](supabase/schema.sql)** and click **Run**.
   This creates all tables, security rules (RLS), the auto-profile trigger, and seeds 8 teams, a 4-week schedule, results, events, news and officials.
3. In **Authentication → Sign In / Providers → Email**, turn **off "Confirm email"** so users get in immediately after registering.
4. Copy your **Project URL** and **anon public key** from **Project Settings → API**. You need them for the next steps.

> **The first account that registers automatically becomes the League Admin.** After that, Admins can promote anyone (including Commissioners) from *Admin → Users*.

## 2. Run it locally

```bash
cp .env.example .env   # then fill in the two REACT_APP_SUPABASE_* values
npm install
npm start              # http://localhost:3000
```

## 3. Deploy to Vercel

1. **Create a new (empty) GitHub repository**, e.g. `fcb-under19-league-app` (do **not** let GitHub create a README — this project already has one).
2. Push this project to it:
   ```bash
   git init
   git add .
   git commit -m "FCB Under 19 Football League"
   git branch -M main
   git remote add origin https://github.com/<you>/<fcb-under19-league-app>.git
   git push -u origin main
   ```
3. On [vercel.com/new](https://vercel.com/new), import the repository. Vercel auto-detects the **Create React App** preset. Set:
   - **Build Command:** `CI=false npm run build` (standard for CRA — stops lint warnings from failing the build)
   - **Output Directory:** `build`
4. Under **Environment Variables**, add for Production + Preview + Development:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
5. Click **Deploy**. Every future `git push` to `main` redeploys automatically.

## Project structure

```
supabase/schema.sql        # one-shot database setup (tables, RLS, triggers, seed data)
src/
  lib/supabase.js          # Supabase client (reads REACT_APP_* env vars)
  context/AuthContext.jsx  # session + profile handling
  components/              # layout, cards, standings table, route guards…
  pages/
    auth/                  # login, register
    fan/                   # dashboard, matches, standings, teams, news
    player/ manager/       # "my team" areas
    commissioner/          # dashboard, live match control, events, reports
    admin/                 # dashboard + manage users/teams/matches/news/officials/settings
  utils/standings.js       # table calculation + date helpers
```

## Security notes

- The anon key is public by design — all data access is protected by Postgres **row-level security** (see `schema.sql`): only admins write teams/officials/settings; only admins & commissioners write matches/events/news; users can only edit their own profile.
- Registration can only self-assign `fan`, `player` or `manager` (enforced in the database trigger, not just the UI).
