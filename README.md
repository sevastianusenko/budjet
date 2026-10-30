# Hearth — a shared family budget

One budget for the whole household. Everyone has their own login and color, so you
always see who logged what. Log an expense in three taps, keep a plan for the month,
watch the one number that matters (**Safe to spend**), and grow your goals.

Built for phones first, installable from the browser ("Add to Home Screen"), hosted on Vercel.

## What it does

- **Safe to spend** — the money left in your variable categories, after fixed bills and goals, with a per-day figure.
- **Month pulse** — every day of the month as a square: how much, and who.
- **50/30/20 check** — needs / wants / saving against your targets (editable).
- **Plan** — zero-based-lite: planned vs spent per category, pace against the calendar, rollover for sinking funds, "To assign" check, copy last month, suggested starter plan from the 50/30/20 rule and BLS spending proportions.
- **Goals** — target, monthly plan, deadline, ETA at current pace; the Emergency Fund shows months of essentials covered.
- **Recurring bills** — due dates, "Paid" in one tap.
- **Insights** — plain-language, rule-based observations plus charts: income vs spending, savings rate, where the money went (with the typical U.S. household share for comparison), who logged what.
- **Every number explains itself** — tap the ? next to it.
- **CSV export**, no bank linking, your own database.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without a `DATABASE_URL` the app uses an embedded Postgres
(PGlite) stored in `./.data/pg`, so nothing else needs installing. Create a household,
then invite a second member with the code from Settings (open an incognito window to sign up as them).

Optional demo data for a household you created (stop `npm run dev` first; PGlite is single-process):

```bash
npm run seed:demo -- you@example.com
```

Tests for the budget math:

```bash
npm test
```

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it in Vercel (framework preset: Next.js).
2. In the Vercel project, open **Storage → Create Database → Neon (Postgres)** and connect it to the project.
   Vercel injects `DATABASE_URL` automatically.
3. Add an environment variable `AUTH_SECRET` (any long random string; `openssl rand -base64 32`).
4. Deploy. The build runs the SQL migrations in `drizzle/` against the database before `next build`,
   so the schema is created on the first deploy and updated on later ones.
5. Open the site on your phone, sign up, and use **Share → Add to Home Screen** for the app icon.

Everyone in the family uses the same URL. The first person creates the household; the others
choose **Join a household** and enter the invite code from Settings.

## Project layout

| Path | What |
|---|---|
| `src/lib/calc.ts` | All budget math (safe to spend, pace, rollover, 50/30/20, goals, projections). Unit-tested in `calc.test.ts`. |
| `src/lib/insights.ts` | Rule-based observations shown on Home and Insights. |
| `src/lib/bls.ts` | BLS Consumer Expenditure Survey 2024 shares used for comparisons and the starter plan. |
| `src/lib/defaults.ts` | Starter categories, member colors, icon lists. |
| `src/db/` | Drizzle schema and the Neon / PGlite connection switch. |
| `src/actions/` | Server actions (auth, transactions, budgets, goals, categories, bills, household). |
| `src/app/(app)/` | Signed-in screens: home, activity, plan, goals, insights, settings. |
| `src/components/` | UI. `add/AddTransactionSheet.tsx` is the entry flow. |
| `drizzle/` | SQL migrations (`npm run db:generate` after changing the schema). |
| `PLAN.md` | Research notes, product plan, formulas, and the self-critique that shaped v1. |

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | production | Postgres connection string. Injected by the Vercel Neon integration. Unset locally = PGlite. |
| `AUTH_SECRET` | production | Signs the session cookie (HS256). A dev fallback is used locally. |

## Not in v1 (on purpose)

Bank syncing, net worth and investments, AI advice, multi-currency, push reminders, receipt photos,
password reset by email. See the backlog at the end of `PLAN.md`.
