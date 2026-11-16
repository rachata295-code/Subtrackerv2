# Subtrackerv2

SubTracker v2 is a Thai personal-finance PWA, phone first, light and dark.
Stack: Vite 5, React 18, TypeScript (strict), Tailwind 3, Vitest, TanStack Query, Supabase. Fonts (Anuphan, Manrope) are self-hosted.

Routes use `HashRouter` so no server rewrites are needed:

- `/#/` — ภาพรวม (Overview: play-pot remaining balance, statement bills & upcoming outflows, hot bar, pending recurring income card, "ใช้ได้จริง" shortcut, multi-item quick-add)
- `/#/entries` — รายการ (Entries: period transaction log + spending summary view `?view=summary` with category breakdown & 6-period trend, add/edit/delete)
- `/#/plan` — แผน (Plan & bank reconciliation: expected bank balance `expectedBalance`, balance checks & missed-entry reconciliation, C5 "ใช้ได้จริง" breakdown, period plan items, cash-flow timeline)
- `/#/bills` — บิล & ผ่อน (Bills & installments: unpaid statement bills, recurring subscriptions, active installments)
- `/#/settings` — ตั้งค่า (Settings: salary, payDay, budget start period, recurring incomes, payment sources, budget pots, theme, sign out)
- `/#/login` — เข้าสู่ระบบ (Email + password sign-in)
- `/#/design` — Design system showcase (tokens, contrast ratios, every component)
- `/#/preview-home` — Static home layout showcase with sample data

## Setup

Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build into `dist/` (also emits `sw.js` and the manifest) |
| `npm run preview` | Serve `dist/` at http://localhost:4173 (use this for the inspector and PWA checks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:run` | Vitest in watch mode / once |
| `npm run test:tz` | Run Vitest in both `Asia/Bangkok` and `UTC` timezones |
| `npm run check:motion` | Fails if `src/` (tests excluded) contains `transition: all`, `transition-all`, `ease-in` (not `ease-in-out`) or `scale(0)` |

Before committing: `npm run test:run && npm run test:tz && npm run typecheck && npm run check:motion && npm run build`.

## Supabase setup

SubTracker v2 stores all data in a dedicated Supabase project protected by Row Level Security (`user_id = auth.uid()`). Never put a `service_role` key in `.env*`, frontend code, or GitHub Secrets.

1. **Create a new Supabase project**
   - Choose **Southeast Asia (Singapore)** (`ap-southeast-1`) as the region.
2. **Configure Auth (single-user email + password)**
   - In **Authentication → Providers → Email**, disable **Confirm email** so login works without an email server.
   - Create your user account in **Authentication → Users → Add user** (email + password, auto-confirm).
3. **Run SQL schema, Phase 2 migration, and seed function**
   - **Fresh database**: Open **SQL Editor**, paste and run `supabase/schema.sql` (includes all Phase 1 + Phase 2 tables and RLS policies), then paste and run `supabase/seed.sql` to create the idempotent `seed_defaults()` RPC (called on first login to insert default settings, 3 payment sources, 2 budget pots, and 2 recurring incomes).
   - **Existing Phase 1 / Phase 1.5 database**: Open **SQL Editor**, paste and run `supabase/migrations/2026-11-16-phase2.sql` (idempotent — safe to run multiple times; adds `recurring_incomes`, `balance_checks`, `plan_items`, expands `transactions.category`, adds `created_at` / `recurring_income_id` / `income_due_on`, and enables owner-scoped RLS policies), then re-run `supabase/seed.sql` to update `seed_defaults()`.
4. **Local environment variables**
   - Copy `.env.example` to `.env.local` and fill in your **Project URL** (`VITE_SUPABASE_URL`) and **anon public key** (`VITE_SUPABASE_ANON_KEY`) from **Project Settings → API**.
   - To run locally with in-memory fixture data without Supabase, set `VITE_USE_FIXTURES=1`.
5. **GitHub Secrets (for CI / GitHub Pages deploy)**
   - In GitHub **Settings → Secrets and variables → Actions**, add:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

## Deploy base (`VITE_BASE`)

`vite.config.ts` reads `base` from `VITE_BASE` and defaults to `/`. The app is deployed to GitHub Pages at
`https://rachata295-code.github.io/Subtrackerv2/`, so the production build must use:

```sh
VITE_BASE=/Subtrackerv2/ npm run build
```

The manifest `start_url`/`scope`, the service worker, the icons and the asset URLs all follow this value.
`.github/workflows/deploy.yml` runs `typecheck`, `test:run`, `test:tz`, and `check:motion`, then builds with `VITE_BASE=/Subtrackerv2/` and deploys `dist/` to GitHub Pages on pushes to `main`.

## Phase 1 / Phase 1.5 / Phase 2 status & backlog

**Phase 2 (Complete on `p2/06-integration`)**:
- **Fast entry (`SPEC §4 โจทย์ A`)**: `CurrencyField` inline `+`/`−` arithmetic expressions (`45+60+35` → `= ฿140.00`), multi-row `QuickAddSheet` (`useCreateTransactions` atomic batch save + single-tap undo), and `HotBar` frequent-item chips (tap to save immediately with 5s undo toast; 500ms hold / right-click to prefill `QuickAddSheet`).
- **Spending summary (`SPEC §4 โจทย์ B`)**: `/entries?view=summary` segmented view with `spendingSummary` & `spendingHistory` domain math (counting bank/card/paylater manual spend + period subscription & installment charges without double-counting bill payments; separating `savings` into `เก็บรอบนี้` and highlighting `unknown` as `ลืมจด`), pure-SVG `CategorySpendChart` & 6-period `PeriodTrendChart`, and click-to-filter navigation back to `/entries`.
- **Bank reconciliation, Plan & Cash-flow Forecast (`SPEC §5 โจทย์ C`)**: `/plan` tab with `expectedBalance`, `BalanceCheckSheet` (match / missing-cash live reconciliation with hotbar & recent 5 bank items / surplus income), C5 `forecast` ("ใช้ได้จริง" breakdown + chronological cash-flow timeline + lowest-balance alert without double-deducting pot-linked card bills), `PlanItem` period checklist (`ต้องจ่าย` / `เก็บเงิน`, copy previous period, duplicate auto-bill warning), `RecurringIncome` settings & `IncomeDueCard` confirmation on `/`, and `AvailableCard` linking `/` to `/plan`.
- **Database & E2E verification**: Idempotent `supabase/migrations/2026-11-16-phase2.sql` (verified with consecutive runs on PostgreSQL), full-stack 7-step "วันจริง" E2E test in `src/e2e/specFlow.test.tsx`, and 36 viewport/theme screenshots in `docs/phase2/screens/`.

**Phase 1.5 (Complete on `p15/06-integration`)**:
- Responsive navigation & multi-column layouts (`AppShell`, `SideNav` at `>=1024px`, `TabBar` at `<1024px`, `useMediaQuery` hooks in `src/hooks/useMediaQuery.ts`) across `/`, `/entries`, `/bills`, `/settings`, and `/login` (`docs/phase1_5/SPEC.md`).
- Adaptive `BottomSheet`: Vaul bottom sheet on mobile/tablet (`<1024px`) and `w-panel` right drawer on desktop (`>=1024px`), with Escape/overlay dismissal and automatic focus restoration to the opener; plus `SegmentedControl` mobile tightening for 4+ segments (`375px`).
- Live motion feedback (`useAnimatedItems`, `.row-enter`/`.row-exit`, `AnimatedMoney`) respecting `prefers-reduced-motion: reduce` fade-only fallback and zero animation on route, tab, or breakpoint switches.
- Thai auth error messages (`src/auth/errors.ts`), trimmed `thai` + `latin` PWA font precache, 42 verified viewport/theme screenshots (`docs/phase1_5/screens/`), and `taste-skill` inspector pass (`0 FAIL` at `1280px`).

**Phase 1 (Complete on `p1/08-integration`)**:
- Supabase SQL schema + RLS (`supabase/schema.sql`, `supabase/seed.sql`), Auth guard + login + sign out (`src/auth/`).
- Pure domain calculations matching `docs/phase1/SPEC.md §4` (`src/domain/*`), tested in `Asia/Bangkok` and `UTC`.
- TanStack Query data hooks (`src/hooks/useFinance.ts`) + repository (`src/data/financeRepo.ts`) wired into all screens (`/`, `/bills`, `/entries`, `/settings`), with app-level `ErrorBoundary` and fixture mode (`VITE_USE_FIXTURES=1`).
- Automated full-stack flow test (`src/e2e/specFlow.test.tsx`). Live Supabase E2E verification requires `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and an Auth user.

**Deferred to Phase 2**:
- JSON backup export/import, multi-month trends/charts, statement/CSV auto-import, bill due-date reminders, multi-user shared pots.
- Device-level iPhone PWA safe-area verification, VoiceOver double-tap polish for `HoldToDelete`, and final app icon artwork replacing `public/icons/` placeholders.

## PWA notes

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`: a new deploy replaces the cached app on the next load.
- Workbox precaches the app shell (`**/*.{js,css,html,svg,png}`) plus only the 9 self-hosted `woff2` subsets
  declared in `src/styles/fonts.css` (`anuphan-{thai,latin}-{400,500,600}` and `manrope-latin-{400,500,600}`),
  explicitly ignoring unused subsets (`cyrillic`, `greek`, `vietnamese`, `latin-ext`) and `.woff` fallbacks.
  This keeps Thai rendering in Anuphan and Latin/numbers in Manrope offline without bloating the precache.
  Check with `grep -o 'assets/[^"]*\.woff2' dist/sw.js` (expects 9 files).
- Service workers only run on the production build (`npm run preview`), not on `npm run dev`.
- `index.html` carries the iOS standalone tags (`apple-mobile-web-app-capable`, `viewport-fit=cover`,
  `apple-touch-icon`) so "Add to Home Screen" opens an app window and the safe-area insets work.
- **The icons in `public/icons/` are placeholders**: a flat accent square with a geometric baht sign, drawn by
  `node scripts/generate-icons.mjs` (Node built-ins only; colours come from `tokens.css`). Replace them with real
  artwork before launch (192, 512, maskable 512, and the 180 `apple-touch-icon`).

## Quality gate (taste-skill inspector)

```sh
npm run build && npm run preview
node <taste-skill>/scripts/lint.mjs --app src
node <taste-skill>/scripts/inspect.mjs --app "http://localhost:4173/#/preview-home" --out .taste-skill/home
node <taste-skill>/scripts/inspect.mjs --app "http://localhost:4173/#/design" --out .taste-skill/design
```

Output stays in `.taste-skill/` (git-ignored). Expected: 0 FAIL at 390, 768 and 1440 px.

The app is a deliberate 480px centred column on every screen size (spec section 4), so at 1440px roughly a third
of the first screen is empty ground either side of it. The inspector reports that as a `hero-void` WARN at 1440 only.
It is not a FAIL today and nothing is silenced. If a newer inspector promotes the side-space or column rule to a
FAIL, the accepted reason is that this empty ground is the intended phone-column layout, not a layout error; pass
`--allow <rule>` for that one rule and nothing else.

## Migration

One-time import from SubTracker v1 CSV exports lives in [`scripts/migrate-v1/`](scripts/migrate-v1/README.md) (Node 22+, dry-run by default, `--apply` inserts via anon key + RLS using owner credentials from env).

```sh
# 1. Place the 4 CSV exports from Supabase v1 in scripts/migrate-v1/input/ (git-ignored)
# 2. Preview row counts and before/after totals (dry-run):
node scripts/migrate-v1/migrate.mjs --airpods-count 10 --airpods-first 2026-09-01

# 3. Apply idempotently once verified (reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, MIGRATE_EMAIL, MIGRATE_PASSWORD):
node scripts/migrate-v1/migrate.mjs --apply --airpods-count 10 --airpods-first 2026-09-01
```

Notes on what the import does to the budget figures:

- v1 `budget_entries` split by `payment_type`: `cash` goes to the bank account + pot `ใช้จ่ายจำเป็น`, `card` goes to the credit card + pot `ใช้ตามใจ` (so everyday cash spending no longer drains the ฿3,000 discretionary pot). Both pots must exist (they come from `seed_defaults`).
- `settings.budget_start_period` (rollover start, see SPEC §4) needs `supabase/migrations/2026-11-15-budget-start.sql` on existing databases. After `--apply` the script sets it to the current pay period (Asia/Bangkok) only if it is still empty; override the value with `--budget-start YYYY-MM`. An already-set value is never overwritten, and it can be changed later in Settings.

See [scripts/migrate-v1/README.md](scripts/migrate-v1/README.md) for the full export guide, mapping rules, and idempotency details.
