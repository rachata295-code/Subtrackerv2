# Subtrackerv2

SubTracker v2 design system: a Thai personal-finance PWA, phone first, light and dark.
Stack: Vite 5, React 18, TypeScript (strict), Tailwind 3, Vitest. Fonts (Anuphan, Manrope) are self-hosted.

Two pages exist so far (HashRouter, so no server rewrites are needed):

- `/#/design` the design system showcase (tokens, contrast ratios, every component)
- `/#/preview-home` the home screen assembled from the design system, with sample data

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
| `npm run check:motion` | Fails if `src/` (tests excluded) contains `transition: all`, `transition-all`, `ease-in` (not `ease-in-out`) or `scale(0)` |

Before committing: `npm run test:run && npm run typecheck && npm run check:motion && npm run build`.

## Deploy base (`VITE_BASE`)

`vite.config.ts` reads `base` from `VITE_BASE` and defaults to `/`. The app is deployed to GitHub Pages at
`https://rachata295-code.github.io/Subtrackerv2/`, so the production build must use:

```sh
VITE_BASE=/Subtrackerv2/ npm run build
```

The manifest `start_url`/`scope`, the service worker, the icons and the asset URLs all follow this value.
There is no deploy workflow in the repo yet.

## PWA notes

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`: a new deploy replaces the cached app on the next load.
- Workbox precaches `**/*.{js,css,html,woff2,svg,png}`. `woff2` is included on purpose so Thai text keeps
  rendering in Anuphan when the app is opened offline. Check with `grep -o '[a-z-]*thai[^"]*woff2' dist/sw.js`.
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
