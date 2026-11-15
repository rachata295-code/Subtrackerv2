# SubTracker v2 Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 design system (tokens for light and dark, ~20 components with motion, a `/#/design` showcase and a `/#/preview-home` sample screen) in a fresh repo at `~/Developer/subtracker`.

**Architecture:** One source of truth for design values: `src/styles/tokens.css` (CSS custom properties, `:root` = light, `[data-theme="dark"]` = dark). Tailwind reads those variables, so components never write `dark:` classes. Pure logic (money formatting, amount parsing, bar segments, theme resolution) lives in `src/lib/` with unit tests; components in `src/components/ui/` are thin. Motion is CSS transitions in `src/styles/motion.css`, plus Vaul (sheet) and Sonner (toast).

**Tech Stack:** Vite 5, React 18.3, TypeScript 5.6 strict, Tailwind CSS 3.4, Vitest 2 + @testing-library/react + jsdom, react-router-dom 6 (HashRouter), vaul, sonner, lucide-react, @fontsource/manrope, @fontsource/anuphan, vite-plugin-pwa.

**Spec:** `PLAN.md` (approved 2026-11-15). Read §5–§9 before starting any task.

## Global Constraints

- Every colour, radius, size and duration comes from a token in `tokens.css`; no raw hex in components.
- Font stack: `"Manrope", "Anuphan", system-ui, sans-serif`; weights 400/500/600 only; nothing under 12px.
- Radii: card 20, tile/control 12, pill 8, dot 2. Gap 14, card padding 16, screen edge 16. Tap targets ≥44px.
- No shadow on anything at rest (only sheet, toast, menu). No gradients, glass, emoji, icons in tinted squares, violet/indigo.
- Numbers: `tabular-nums` everywhere; right-aligned in columns; `฿` + thousands separator + 2 decimals.
- Spending in ink, never red. `negative` only for over-budget/error. Income green with `+`.
- Motion: only `transform`/`opacity` (plus `clip-path`/`filter: blur` where the spec names them). No `transition: all`, no `ease-in`, no `scale(0)`. Hover only under `@media (hover: hover) and (pointer: fine)`. `prefers-reduced-motion: reduce` → no movement, short opacity only.
- No animation on: tab switch, app load, theme switch.
- Contrast: text on surface and tile `ink` on tile `bg` ≥4.5:1; `mark` on `surface` ≥3:1; both themes.
- Comments explain *why*, in English; UI copy in Thai.
- `.superpowers/` and `.taste-skill/` are git-ignored.

## Review Focus

1. **Long Thai names and big amounts in one row** (e.g. "ค่าผ่อนโทรศัพท์มือถือเครื่องใหม่ งวด 10/24" with ฿123,456.78): the amount never wraps or gets cut; the name truncates with an ellipsis. Test in Task 5.
2. **localStorage throws** (iOS private mode, blocked storage): theme falls back to `system` and the app still renders. Test in Task 1.
3. **System theme changes while the app is open** with preference `system`: `data-theme` and `<meta name="theme-color">` follow. Test in Task 1.
4. **Double-tapping "จ่ายแล้ว"** in the preview: the bill is paid once; totals stay 3,541.00. Test in Task 11.
5. **Over-allocated pot** (bills + spent > pot, e.g. 3,541 pot with 4,000 out): the bar shows an over state, "เหลือใช้เล่น" shows a negative in `negative` colour, nothing overflows the card. Test in Task 6.

---

### Task 1: Scaffold, tokens, fonts and theme

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx` (HashRouter with `/design` and `/preview-home`, `/` redirects to `/design`)
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/motion.css`
- Create: `src/lib/theme.ts`, `src/components/ThemeProvider.tsx`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Produces: `type ThemePref = 'system' | 'light' | 'dark'`; `type ResolvedTheme = 'light' | 'dark'`
- Produces: `resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme`
- Produces: `readThemePref(storage?: Storage): ThemePref` (returns `'system'` on missing, invalid or throwing storage); `writeThemePref(pref: ThemePref, storage?: Storage): void` (swallows errors)
- Produces: `<ThemeProvider>`, `useTheme(): { pref: ThemePref; resolved: ResolvedTheme; setPref(p: ThemePref): void }`. It sets `document.documentElement.dataset.theme` and updates `<meta name="theme-color">` to the resolved `--ground` value.
- Produces: Tailwind colour names `ground surface raised border rule control text muted accent positive negative warning`, and for each hue `sky apricot teal stone`: `{hue}-bg {hue}-ink {hue}-mark`. Radii `rounded-card` (20), `rounded-tile` (12), `rounded-pill` (8). CSS vars for motion: `--ease-out --ease-in-out --ease-drawer --dur-press --dur-fast --dur-base --dur-sheet` with the exact values from spec §5.6.

- [ ] **Step 1:** `git init`. Scaffold Vite React-TS, pin the versions in Tech Stack, add the dependencies, and write `.gitignore` (node_modules, dist, `.superpowers/`, `.taste-skill/`, `.env*.local`).
- [ ] **Step 2: Write failing tests** in `src/lib/theme.test.ts`:
  - `resolveTheme('system', true) === 'dark'`; `resolveTheme('system', false) === 'light'`; `resolveTheme('light', true) === 'light'`
  - `readThemePref` with a storage whose `getItem` throws returns `'system'`
  - `readThemePref` with stored `'purple'` returns `'system'`
  - `writeThemePref('dark', throwingStorage)` does not throw
  - Render `<ThemeProvider>` with pref `system`, flip a mocked `matchMedia('(prefers-color-scheme: dark)')` to `matches: true` and fire `change` → `document.documentElement.dataset.theme === 'dark'` and the theme-color meta content equals the dark `--ground` (`#111214`)
- [ ] **Step 3:** Run `npx vitest run src/lib/theme.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `theme.ts` and `ThemeProvider.tsx`. Write `tokens.css` with every value from spec §5.1–§5.3 and §5.6, light in `:root` and dark in `:root[data-theme="dark"]`. Store colours as space-separated RGB channels so Tailwind's `<alpha-value>` works. Map them in `tailwind.config.ts`. Import `@fontsource/manrope/{400,500,600}.css` and `@fontsource/anuphan/{400,500,600}.css` in `main.tsx`. To avoid a theme flash, add an inline script in `index.html` that reads `localStorage` (inside try/catch) and sets `data-theme` before React mounts.
- [ ] **Step 5:** Run `npx vitest run` and `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 6: Commit** `feat: scaffold v2 with tokens, fonts and theme provider`

### Task 2: Contrast guard and palette tuning

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `src/styles/tokens.contrast.test.ts`
- Modify: `src/styles/tokens.css` (tune values until the test passes)

**Interfaces:**
- Produces: `contrastRatio(hexA: string, hexB: string): number` (WCAG 2.1 relative luminance)
- Produces: `parseTokens(css: string): { light: Record<string,string>; dark: Record<string,string> }` (reads var name → hex from the two blocks)

- [ ] **Step 1: Write failing tests:** `contrastRatio('#000000', '#ffffff')` ≈ 21 (±0.01). Then read `tokens.css` with `fs` and, for **both themes**, assert: `text`/`surface` ≥ 4.5; `text`/`ground` ≥ 4.5; `muted`/`surface` ≥ 4.5; `accent`/`surface` ≥ 3; and for each hue in `sky apricot teal stone`: `{hue}-ink`/`{hue}-bg` ≥ 4.5 and `{hue}-mark`/`surface` ≥ 3.
- [ ] **Step 2:** Run `npx vitest run src/styles`. Expected: FAIL on light `stone-mark` (≈1.7) and `apricot-mark` (≈2.9), and possibly some dark pairs.
- [ ] **Step 3:** Implement `contrast.ts` and `parseTokens`. Tune only the failing values in `tokens.css`, keeping the hue (spec §5.3 note: darken stone towards mid-grey, apricot towards brick). Keep the original value in a comment so the change is visible.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: contrast guard for all token pairs in both themes`

### Task 3: Money formatting and `<Money>`

**Files:**
- Create: `src/lib/money.ts`, `src/components/ui/Money.tsx`
- Test: `src/lib/money.test.ts`, `src/components/ui/Money.test.tsx`

**Interfaces:**
- Produces: `formatTHB(amount: number): string` → e.g. `"฿1,381.93"`, `"−฿50.00"` (U+2212 minus), `"฿0.00"`
- Produces: `splitTHB(amount: number): { sign: '' | '−' | '+'; baht: string; satang: string }`. `baht` includes `฿` and separators; `satang` is `".07"`.
- Produces: `<Money value: number | null; size?: 'xl' | 'md' | 'sm'; kind?: 'spend' | 'income' | 'neutral' />`. `null` renders `—` in muted. `0` renders `฿0.00` in muted. `income` renders `+` in `positive`. `spend` renders ink, never red. `xl` renders satang smaller and muted. A negative `neutral` value (over budget) renders in `negative`.

- [ ] **Step 1: Write failing tests:** `formatTHB(662.07) === '฿662.07'`; `formatTHB(1234567.891) === '฿1,234,567.89'`; `formatTHB(0.005)` rounds to `'฿0.01'` (use `Math.round(x*100)/100` with an epsilon); `formatTHB(-458.93) === '−฿458.93'`. `splitTHB(662.07)` → `{sign:'', baht:'฿662', satang:'.07'}`. The component renders `—` for `null`, has class `text-positive` and the text `+฿100.00` for income, and its spend output contains no `text-negative`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` and prefix `฿` yourself (do not use currency style; it renders `THB` inconsistently across engines).
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: THB money formatting and Money component`

### Task 4: Pressable primitives (Button, IconButton, Card, Tile, Pill)

**Files:**
- Create: `src/components/ui/{Button,IconButton,Card,Tile,Pill}.tsx`; add `.pressable` to `src/styles/motion.css`
- Test: `src/components/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: tokens (Task 1), `<Money>` (Task 3)
- Produces: `type Hue = 'sky' | 'apricot' | 'teal' | 'stone'`
- Produces: `<Button variant: 'primary'|'secondary'|'ghost'|'danger'; size?: 'md'|'lg'; loading?: boolean; ...ButtonHTMLAttributes>`
- Produces: `<IconButton label: string; icon: ReactNode; ... />` (`label` is required and becomes `aria-label`)
- Produces: `<Card padding?: 'md'|'none'>`, `<Tile hue: Hue; label: string; value: number | null; onClick?: () => void>` (a `<button>` when clickable, otherwise a `<div>`), `<Pill hue: Hue>{children}</Pill>`
- Produces: CSS class `.pressable`: `transition: transform var(--dur-press) var(--ease-out)`; `:active { transform: scale(0.97) }`; disabled → no scale.

- [ ] **Step 1: Write failing tests:** a disabled Button does not call `onClick`; a `loading` Button has `aria-busy="true"` and is disabled; IconButton exposes `getByRole('button', { name: 'เพิ่มรายการ' })`; a Tile with `onClick` is a button, and without it has no button role; Tile `sky` has classes `bg-sky-bg text-sky-ink`. Add a source scan: no file in `src/` contains `transition: all` or `transition-all`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Primary is `bg-accent text-white`, rounded-tile, h-11 (44px). Secondary is `bg-stone-bg text-stone-ink`. Focus ring: `focus-visible:outline-2 outline-accent outline-offset-2`. Hover tint goes only inside the hover media query (Tailwind `supports`/custom variant `hover-fine`).
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: pressable primitives with press feedback`

### Task 5: List building blocks (ListRow, DateBadge, SectionHeader, EmptyState, Skeleton)

**Files:**
- Create: `src/components/ui/{ListRow,DateBadge,SectionHeader,EmptyState,Skeleton}.tsx`; `src/lib/thaiDate.ts`
- Test: `src/components/ui/list.test.tsx`, `src/lib/thaiDate.test.ts`

**Interfaces:**
- Consumes: `<Money>`, `<Pill>`, `Hue`
- Produces: `thaiMonthShort(monthIndex0: number): string` (`10 → 'พ.ย.'`, `11 → 'ธ.ค.'`)
- Produces: `<DateBadge day: number; month: number /*0-11*/; dueBy?: boolean />` (`dueBy` shows `≤10`)
- Produces: `<ListRow leading?: ReactNode; title: string; detail?: ReactNode; amount: number | null; amountKind?: MoneyKind; strong?: boolean; onClick?: () => void />`
- Produces: `<SectionHeader title: string; actionLabel?: string; onAction?: () => void />`, `<EmptyState message: string />`, `<Skeleton className?: string />`

- [ ] **Step 1: Write failing tests:** `thaiMonthShort(10) === 'พ.ย.'`; DateBadge `{day:10, month:11, dueBy:true}` has the text `≤10` and `ธ.ค.`. **Review Focus 1:** a ListRow with title `'ค่าผ่อนโทรศัพท์มือถือเครื่องใหม่ งวด 10/24'` and amount `123456.78` has a title element with the class `truncate` (and `min-w-0` on its parent), and its amount element has `whitespace-nowrap` and `shrink-0`. EmptyState renders only its message (no `img`, no `svg`). Skeleton has `aria-hidden="true"`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Skeleton pulses opacity 0.5↔1 over 1.6s (slow, per spec "ไม่กระพริบเร็ว"); under reduced motion it is static.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: list row, date badge, section header, empty and loading states`

### Task 6: AllocationBar

**Files:**
- Create: `src/lib/allocation.ts`, `src/components/ui/AllocationBar.tsx`
- Test: `src/lib/allocation.test.ts`

**Interfaces:**
- Produces: `type Segment = { id: string; label: string; amount: number; hue: Hue | 'remaining'; state?: 'reserved' | 'paid' }`
- Produces: `computeAllocation(total: number, parts: Segment[]): { segments: (Segment & { fraction: number })[]; remaining: number; over: boolean }`. `remaining = total − Σparts`. `fraction` is each part divided by `max(total, Σparts)`. Zero-amount parts are dropped. `over = remaining < 0`.
- Produces: `<AllocationBar total: number; parts: Segment[] />`. It renders segments plus a `remaining` segment (teal mark) when `remaining > 0`. A `paid` segment renders at reduced opacity. Width changes animate with `transform: scaleX` from a left origin inside fixed-width slots, so no layout properties animate (`--dur-base` `--ease-in-out`).

- [ ] **Step 1: Write failing tests:** with total 3541 and parts 1077 / 1381.93 / 420, `remaining ≈ 662.07` (toBeCloseTo, 2) and the fractions sum to 1 (±1e-9). A zero part is dropped. **Review Focus 5:** total 3541 with parts summing to 4000 gives `over === true`, `remaining ≈ −459`, fractions summing to 1, and none above 1.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. When `over`, the component adds `aria-label` text such as `เกินงบ ฿459.00` and a 2px `negative` outline on the bar.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: allocation bar with over-budget state`

### Task 7: SegmentedControl and TabBar

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`, `src/components/layout/TabBar.tsx`
- Test: `src/components/ui/nav.test.tsx`

**Interfaces:**
- Produces: `<SegmentedControl<T extends string> options: {value: T; label: string}[]; value: T; onChange(v: T): void; label: string />` (`role="tablist"`, arrow keys move the selection, and a sliding indicator moves with `transform: translateX` `--dur-fast` `--ease-in-out`)
- Produces: `<TabBar />` with 4 fixed links (ภาพรวม `/preview-home`, รายการ, บิล & ผ่อน, ตั้งค่า — the last three go to `/design` for now). Colour changes only, no content animation. `padding-bottom: max(8px, env(safe-area-inset-bottom))`. It is `position: sticky; bottom: 0` inside a full-height flex column.

- [ ] **Step 1: Write failing tests:** pressing ArrowRight on the SegmentedControl calls `onChange` with the next value; the selected tab has `aria-selected="true"`; the TabBar's active link has `aria-current="page"`; the TabBar's inline/computed style contains `safe-area-inset-bottom`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Icons come from lucide-react at 20px with a 1.6 stroke.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: segmented control and bottom tab bar`

### Task 8: Form fields (TextField, CurrencyField, Switch)

**Files:**
- Create: `src/lib/parseAmount.ts`, `src/components/ui/{TextField,CurrencyField,Switch}.tsx`
- Test: `src/lib/parseAmount.test.ts`, `src/components/ui/fields.test.tsx`

**Interfaces:**
- Produces: `parseAmount(input: string): number | null` (trims; strips `,`, spaces and `฿`; accepts one `.`; at most 2 decimals; returns `null` when it can't parse)
- Produces: `<TextField label: string; error?: string; ...InputHTMLAttributes>` (the error is linked via `aria-describedby`)
- Produces: `<CurrencyField label: string; value: number | null; onChange(v: number | null): void; error?: string />` (`inputMode="decimal"`, keeps the raw text while typing, formats with separators on blur)
- Produces: `<Switch label: string; checked: boolean; onChange(v: boolean): void />` (`role="switch"`; the thumb moves with transform, `--dur-fast` `--ease-out`)

- [ ] **Step 1: Write failing tests:** `parseAmount('1,381.93') === 1381.93`; `parseAmount(' ฿3,000 ') === 3000`; `parseAmount('12.345') === null`; `parseAmount('abc') === null`; `parseAmount('') === null`. TextField with an error: `getByLabelText` returns an input whose `aria-describedby` points to an element containing the error text. A Switch click calls `onChange(true)` and has `aria-checked`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Inputs are 16px so iOS does not zoom on focus.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: text, currency and switch fields`

### Task 9: Overlays and hold-to-delete (BottomSheet, Toast, HoldToDelete)

**Files:**
- Create: `src/components/ui/{BottomSheet,Toaster,HoldToDelete}.tsx`
- Test: `src/components/ui/overlays.test.tsx`

**Interfaces:**
- Produces: `<BottomSheet open: boolean; onOpenChange(o: boolean): void; title: string>{children}</BottomSheet>` (wraps `vaul` `Drawer`, has a visible title and a close button labelled `ปิด`, background `surface`, top radius 20, shadow allowed)
- Produces: `<AppToaster />` (Sonner `<Toaster position="bottom-center" />` offset above the TabBar, themed from `useTheme().resolved`) and `notify(message: string, opts?: { undo?: () => void })` (shows a `เลิกทำ` action when `undo` is given)
- Produces: `<HoldToDelete onConfirm(): void; label?: string />` (overlay `clip-path: inset(0 100% 0 0)` → `inset(0)` over 1200ms linear while pressed; release snaps back in 200ms `--ease-out`; it fires once on completion; keyboard: Enter held for 1200ms, or a second Enter press within 3s confirms)

- [ ] **Step 1: Write failing tests:** a BottomSheet with `open` shows its title in a dialog, and clicking `ปิด` calls `onOpenChange(false)`. With fake timers, HoldToDelete pointerdown + advancing 1199ms does not call `onConfirm`, and advancing to 1200ms calls it exactly once; pointerup at 600ms then advancing 1000ms does not call it. `notify('บันทึกแล้ว', { undo })` renders a `เลิกทำ` button that calls `undo`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The sheet's timing: override Vaul's transition to `--dur-sheet` `--ease-drawer` on open and 240ms on close (exit faster than enter).
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: bottom sheet, toast with undo, hold-to-delete`

### Task 10: Showcase page `/#/design`

**Files:**
- Create: `src/pages/DesignPage.tsx`, `src/components/ThemeSwitch.tsx`
- Test: `src/pages/DesignPage.test.tsx`

**Interfaces:**
- Consumes: every component from Tasks 1–9
- Produces: `<ThemeSwitch />` (SegmentedControl `ระบบ / สว่าง / มืด` bound to `useTheme`)

- [ ] **Step 1: Write a failing smoke test:** render DesignPage inside the providers. It has an `h1` `Design system`, one section heading per component group (สี, ตัวอักษร, ปุ่ม, Tile & Pill, ตัวเลขเงิน, แถบสัดส่วน, แถวรายการ, ฟอร์ม, Sheet & Toast, สถานะว่าง/โหลด), and a ThemeSwitch.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Build the page. Show every token as a swatch with its contrast ratio (from `contrastRatio`), and every component in every state (default, disabled, loading, error, empty, zero, `null`, over budget). It sits in the 480px centred column.
- [ ] **Step 4:** Run the tests, then `npm run dev` and look at it at 390px in both themes.
- [ ] **Step 5: Commit** `feat: design system showcase page`

### Task 11: Sample home `/#/preview-home` with AnimatedNumber

**Files:**
- Create: `src/pages/preview/sampleData.ts`, `src/pages/preview/PreviewHome.tsx`, `src/components/ui/AnimatedMoney.tsx`
- Test: `src/pages/preview/preview.test.tsx`

**Interfaces:**
- Consumes: AllocationBar, Tile, ListRow, DateBadge, Money, SectionHeader, TabBar, IconButton, BottomSheet, notify
- Produces: `samplePeriod`. These figures, with derived totals computed from the rows: pot 3,000 + carry 541; bills `{ card: 1077.00 (due 24 พ.ย.; Claude 699, Gemini + YouTube 279, iCloud 99), spay: 1381.93 (AirPods 3/10, due ≤10 ธ.ค.) }`; play spent 420.00 (3 rows: หนัง 220, ชานม 85, เกม 115); upcoming list in date order: 24 พ.ย. card bill · 25 พ.ย. Gemini + YouTube 279 · 1 ธ.ค. Claude 699 · ≤10 ธ.ค. AirPods 1,381.93. Period 10 พ.ย.–10 ธ.ค. 2026, today 15 พ.ย. → "อีก 25 วัน".
- Produces: `<AnimatedMoney value: number; size?: MoneySize />` (on change, crossfades old → new over `--dur-base` with `filter: blur(2px)` at the midpoint; reduced motion → opacity only)

- [ ] **Step 1: Write failing tests:** the sample data's total pot equals 3541.00; `bills + spent + playLeft === pot` to the satang, summed from the displayed 2-decimal values; `playLeft` renders as `฿662.07`. "ยังต้องจ่ายอีก" starts at `฿2,458.93`. Clicking `จ่ายแล้ว` on the card bill makes it `฿1,381.93`, keeps `฿662.07`, and removes the 24 พ.ย. row. **Review Focus 4:** clicking `จ่ายแล้ว` twice quickly leaves "ยังต้องจ่ายอีก" at `฿1,381.93` (not `฿304.93`), and the bar total stays 3,541.00.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Build the screen to match the B mockup (`.superpowers/brainstorm/69542-1794732328/content/visual-style.html`, the middle phone). The paid card segment switches `state` to `'paid'`. The `+` button opens a BottomSheet holding a CurrencyField, a Switch "นับรวมในวงเงินใช้ตามใจ" and a Save button that calls `notify('บันทึกแล้ว', { undo })`. Paying the last open bill plays the one "celebration": a check icon stroke draws in (`stroke-dashoffset`, ≤500ms) and the row collapses.
- [ ] **Step 4:** Run the tests, then check it at 390px in both themes.
- [ ] **Step 5: Commit** `feat: preview home assembled from design system`

### Task 12: PWA, deploy base and the quality gate

**Files:**
- Modify: `vite.config.ts` (VitePWA, `base: process.env.VITE_BASE ?? '/'`), `index.html` (iOS meta: `apple-mobile-web-app-capable`, `viewport-fit=cover`, `apple-touch-icon`)
- Create: `public/icons/` (placeholder 192/512 PNG + maskable), `README.md` (setup, scripts, `VITE_BASE`)
- Create: `scripts/check-motion.mjs` (fails if `src/` contains `transition: all`, `transition-all`, `ease-in` not followed by `-out`, or `scale(0)`)

**Interfaces:**
- Produces: npm scripts `dev build preview typecheck test test:run check:motion`

- [ ] **Step 1:** Configure VitePWA: `registerType: 'autoUpdate'`, workbox `globPatterns: ['**/*.{js,css,html,woff2,svg,png}']` so the fonts are precached, a manifest with name `SubTracker`, `display: 'standalone'`, and `theme_color`/`background_color` = light `ground`.
- [ ] **Step 2:** Run `npm run typecheck && npm run test:run && npm run check:motion && npm run build`. Expected: all pass, and `dist/sw.js` lists the `.woff2` files.
- [ ] **Step 3:** Run `npm run preview`. Then run `node <taste-skill>/scripts/lint.mjs --app src` and `node <taste-skill>/scripts/inspect.mjs --app http://localhost:4173/#/preview-home` (and `/#/design`). Expected: 0 FAIL at 390/768/1440. Allow only the side-space rule for the 480px column (spec §4), and record the reason in README.
- [ ] **Step 4:** Offline font check: open the preview once, set DevTools to Offline, and reload. Thai text still renders in Anuphan (`document.fonts.check('16px Anuphan')` is true).
- [ ] **Step 5:** Open every inspector screenshot at both themes. Fix anything visibly wrong, then re-run Step 3.
- [ ] **Step 6: Commit** `chore: PWA, deploy base and quality gate`

---

## Spec coverage check (done while writing)

| Spec | Task |
|---|---|
| §4 stack, fonts self-hosted, Vaul/Sonner, PWA, base, 480px column | 1, 9, 12, 10 |
| §5.1–5.3 tokens both themes, mark tuning ≥3:1 | 1, 2 |
| §5.4 type, tabular nums, small satang | 1, 3 |
| §5.5 radii/spacing/no shadows | 1, 4 |
| §5.6 + §6 motion table | 4 (press), 6 (bar), 7 (segmented, no tab anim), 8 (switch), 9 (sheet, toast, hold), 11 (number, celebration), 12 (check-motion) |
| §7 component list | 3–11 (ThemeProvider/switch in 1, 10) |
| §8 showcase + preview with assertions | 10, 11 |
| §9 DoD | 2 (contrast), 12 (build, inspect, offline, motion), 7 (safe-area) |
