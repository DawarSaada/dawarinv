# Production readiness review

Date: 2026-09-19 · Scope: `dawarsaada-inventory` (React 19 + Vite PWA on Supabase)

Authentication was explicitly left alone (internal tool). Everything below was either
fixed in this pass or is called out as remaining work with its risk.

## Fixed

### Build integrity
- **`npm run build` did not type-check, and `npm run lint` (tsc) failed with 18 errors.**
  Added `vite/client` + `vite-plugin-pwa/client` types, excluded the Deno `supabase/functions`
  tree and the removed test scratch from the app type-check, and fixed the real bugs found:
  a mismatched `Pagination` prop, a `LocationData` fallback missing `description`, a missing
  `t` prop on `BarcodeScanner`, a transfer receipt that dropped quantity/notes, and a
  TanStack Query v5 status comparison. `build` now runs `typecheck && vite build`.
- Added `env.d.ts`, `engines.node >= 20.19`.

### Secrets
- **`vite.config.ts` injected `process.env.GEMINI_API_KEY` into the client bundle** via
  `define`. Any key placed in `.env` would have shipped to every browser. The define is gone
  and both AI features now call a new `ai-assistant` edge function (`supabase/functions/`)
  that holds the key as a function secret, pins the model server-side, validates prompt size
  and returns typed errors. The client degrades with a translated message when the function
  is not deployed.
- `@google/genai` was only used for those two calls and is no longer a dependency.
- `services/supabase.ts` logged the project URL and key presence to the console on every load.

### Assets and PWA
- **The build referenced files that did not exist in the repository**: `favicon.ico`,
  `apple-touch-icon.png`, `masked-icon.svg`, `/manifest.json` (404 in production) and PWA
  icons. Added a real icon set (generated from an SVG via `scripts/generate-icons.mjs`),
  `favicon.svg`, `apple-touch-icon.png`, `robots.txt`, and let `vite-plugin-pwa` own the
  manifest (the stale root `manifest.json` duplicate was removed).
- **`public/sw.js` (hand-written) collided with the generated `dist/sw.js`**, so which service
  worker won depended on install order. It is removed; `sw.ts` is the single source of truth
  and now also precaches navigations (real offline shell), runtime-caches webfonts, cleans up
  outdated caches and handles push/notification clicks with local icon paths.
- **Tailwind was loaded from `cdn.tailwindcss.com`** — a ~400KB JIT compiler fetched at runtime,
  which also means the app renders unstyled when the CDN is unreachable (fine on a laptop,
  wrong in a warehouse). Tailwind + PostCSS + autoprefixer are now real dev dependencies with
  `tailwind.config.js` mirroring the previous inline theme; the compiled CSS is 63KB (10KB gzip).
- Removed the dead AI Studio `importmap` (12 CDN module URLs) from `index.html`.
- The PDF.js worker no longer loads from `esm.sh` at runtime; it is bundled.

### Performance
- `utils/cairoFont.ts` was an unused 800KB base64 module — deleted.
- The 575KB Amiri font is now a lazy chunk, loaded only when a PDF is exported, instead of
  riding along in the main bundle.
- Vendored chunk splitting (react / data / charts / pdf / spreadsheet) plus keeping lazily
  imported libraries out of the manual chunks; `html5-qrcode` (~375KB) is now fetched only
  when the scanner opens. This also fixed a leaked camera: the scanner cleanup read a stale
  closure variable, so the camera stream was never stopped on unmount.

### Reliability and observability
- Central logger (`utils/logger.ts`): debug/info are stripped in production, errors funnel
  through `captureError`, which logs and emits an `app:error` event for a future reporter.
  Wired into the error boundary, global `error`/`unhandledrejection`, and the mutation cache.
- Retry policy: mutations used to retry any failure three times, which can double-apply
  non-idempotent stock writes. Retries now apply only to offline/network/5xx failures.
- Request-level cache busting: the persisted (IndexedDB) query cache is keyed by app version
  and expires after 24h, so a deploy cannot replay stale rows.
- Service-worker updates activate in the background and surface as a toast.

### Configuration and delivery
- `config.ts` validates the required env vars at startup; a deployment missing them now
  renders a readable "Configuration required" screen instead of a blank page (the app is
  imported lazily so the check runs before the data layer initialises). `.env.example`
  documents every variable and where the secrets belong.
- `scripts/smoke-test.mjs` (`npm run smoke`) serves the production build on loopback and
  asserts it mounts with no page errors — used to verify this pass, easy to wire into CI.
- `vercel.json`: SPA rewrite, immutable caching for `/assets`, no-cache for
  `sw.js`/`index.html`/manifest, security headers, and `noindex`/`X-Robots-Tag` for an
  internal app. `public/_redirects` now has an actual SPA fallback.
- `package.json`/lockfile were out of sync with reality: `eslint`, `tailwindcss`, `postcss`,
  `autoprefixer` and the `workbox-*` packages the service worker imports were installed but
  undeclared (a clean `npm ci` would have failed), while `puppeteer` sat in runtime
  dependencies. Dependencies now match what is imported; the lockfile is regenerated.
- Removed stale artifacts: root `sw.js`, `manifest.json`, `lint.log`, `fetch_font.cjs`.
- `README.md` documents setup, env, scripts, Supabase provisioning and deployment.

## Interface revamp (same pass)

The UI was rebuilt on a shared primitive layer so screens stop drifting apart. No screen
keeps its own header, table, filter row or dialog implementation.

- **Design system** — `components/ui/` provides `AppShell`, `PageHeader`/`PageBody`,
  `FilterBar`, `DataTable`, `Panel`, `StatTile`, `Badge`, `Field`, `Button`, `Menu`,
  `Segmented`, `Checkbox`, `Modal` and `Feedback`. Tokens (brand/status palettes, elevation,
  `z-*` layers, focus ring, reduced motion, tabular numbers) live in `tailwind.config.js` and
  `index.css`.
- **App shell** — `AdminDashboard`, `InventoryDashboard` and `MammalEmployeeDashboard` now run
  inside one shell: desktop sidebar, mobile drawer, bottom tab bar for the primary
destinations, and a sticky top bar holding live status, notifications, the assistant,
theme/language and sign-out. The old per-screen headers and the admin-only sidebar were
  removed (`InventoryHeader`, `InventoryToolbar`, `AdminSidebar` deleted).
- **Floating controls are gone.** `ThemeLanguageControls` was a fixed bottom-corner overlay
  that covered cards and forms on every screen; theme and language now live in the top bar
  (`AppControls`) and each screen receives them as props.
- **Inventory screen** — added KPI tiles, a single filter bar (search + scan, active-filter
  chips, a filter sheet on phones, view switcher, primary action and an overflow menu), item
  cards with bulk selection and a per-row action menu, a real empty state with reset actions,
  and a pager with first/prev/next/last and windowed page numbers.
- **Productivity** — `⌘K` / `Ctrl+K` command palette on both dashboards (screens, items,
  actions, preferences) with full keyboard navigation; sortable tables; select-all and bulk
  edit/transfer/print; skeleton, empty and error states; filter counts.
- **Notifications** — the transfer/alert panel was rendering hundreds of alert rows on every
  load; it is now a collapsed summary (incoming / approvals / unread alerts) that expands on
  demand, renders at most 20 alerts before "show all", and hides entirely when nothing is
  pending. Mark-as-read now goes through the app's mutation so the cache stays in sync.
- **Responsiveness** — every list has a phone layout (cards instead of tables, sheets instead
  of dialogs, thumb-reach navigation), safe-area padding, and no horizontal overflow. Verified
  against the real app at 390 / 834 / 1440 / 1920 using `ui-review.html` in both themes and
  both languages.

## Remaining (deferred, by request or by scope)

> Data-path correctness is audited separately in
> [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md) — the 1000-row truncation that hid 85
> inventory items, the 71 negative-stock rows, the PO receipt that wrote no ledger
> entry, and the roadmap. Apply `phase7_integrity_migration.sql` if you have not.

| Risk | Detail | Suggested action |
| --- | --- | --- |
| **High — auth** | Users are rows in `app_users` with plaintext passwords; the login compares them client-side and the app trusts the anon key. Anyone with the anon key can read/write inventory. | Move to Supabase Auth, or at minimum hash passwords and enforce RLS on every table (`phase5_rls_migration.sql` exists — verify it is applied to the live project). |
| **High — negative stock** | `inventory_items.quantity` had no lower bound and usage logging did not check stock, so 71 items are at or were at negative quantities. `phase7_integrity_migration.sql` repairs and prevents this, but those items need a physical count. | Apply the migration, then stock-take the 71 items listed in `inventory_negative_stock_backup`. |
| **Medium — keys in git history** | The anon keys of both Supabase projects are hardcoded in the `*.mjs`/`*.cjs` helper scripts that are committed. Anon keys are publishable, but combined with permissive RLS they expose data. | Move scripts to `scripts/` reading `process.env`, and confirm RLS is enabled. Rotating the anon keys is only effective once RLS is enforced. |
| **Medium — push function** | `push-notifications` runs with the service-role key, accepts any caller holding the anon key and used `Access-Control-Allow-Origin: *`. | Add a caller check inside the function and keep `ALLOWED_ORIGINS` tight (the new `ai-assistant` function already follows this pattern). |
| **Low — first load size** | `recharts`, `jspdf`, `xlsx` and `pdfjs-dist` are still statically imported, so ~1.2MB of the initial graph is only needed for exports and analytics. | Convert `services/exportService.ts` and `utils/pdfExport.ts` to dynamic imports inside their handlers. |
| **Low — webfonts** | Cairo/Inter still load from Google Fonts at runtime (preconnected, and runtime-cached by the service worker after first use, so offline use is fine). | Self-host the woff2 subsets in `public/fonts/` to remove the third-party dependency and the pre-connect round trips. |
| **Low — repo layout** | ~60 one-off migration/diagnostic scripts sit in the repository root. | Group under `scripts/` and `sql/`. |
| **Low — strict mode** | `tsconfig.json` still has implicit `strict: false`; ~220 ESLint `no-explicit-any` warnings. | Enable `strict` incrementally (start with `strictNullChecks`) and add an ESLint config to CI. |
| **Low — remaining overlays** | A few dialogs (transfer detail, purchase order, audit, add item) still carry their own overlay markup instead of `components/ui/Modal`; they inherit the new tokens but not the focus trap or mobile sheet behaviour. | Move them onto `Modal` (or `ConfirmDialog`) the same way `ConfirmationModal` was. |
