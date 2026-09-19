# Dawar Saada Inventory

Offline-first inventory management PWA for the Dawar Saada warehouse and its branches.
Bilingual (English / Arabic, RTL aware), installable, and designed to keep working when
the network drops in a warehouse.

## Stack

| Area | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Tailwind CSS (compiled at build time) |
| Data | Supabase (Postgres + RPC + Realtime) via `@supabase/supabase-js` |
| Server state | TanStack Query with IndexedDB persistence and an offline mutation queue |
| Build | Vite 7, `vite-plugin-pwa` (injectManifest + Workbox) |
| Exports | jsPDF (+ Arabic font on demand), xlsx, Recharts |
| AI assistant | Supabase Edge Function proxy (`ai-assistant`) — no API key in the browser |

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase values
npm run dev            # http://localhost:3000
```

Node 20.19+ is required.

## Environment variables

Client-visible (build-time, shipped in the bundle — publishable values only):

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Inventory Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon key. **Treat it as a shared secret:** RLS is not yet enforced, so it grants read/write on the data (see the auth risk in PRODUCTION_AUDIT.md). |
| `VITE_VAPID_PUBLIC_KEY` | no | Web Push subscription key |
| `VITE_OMS_SUPABASE_URL` | no | OMS project used for the subscription check |
| `VITE_OMS_SUPABASE_ANON_KEY` | no | OMS anon key |
| `VITE_CURRENCY` | no | ISO 4217 code for money in the UI (default `SAR`) |
| `VITE_DEFAULT_LOCALE` | no | BCP-47 locale for number/date formatting (default `en`) |

Missing required values fail loudly in production builds (see `config.ts`) instead of
rendering an empty application.

Server-side only (Supabase function secrets, never in `.env`):

| Secret | Used by |
| --- | --- |
| `OPENROUTER_API_KEY` | `ai-assistant` edge function — see the table further down |
| `OPENROUTER_MODEL` and the other `OPENROUTER_*` secrets | overrides for the same function |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `push-notifications` edge function |
| `ALLOWED_ORIGINS` (optional) | CORS allowlist for the edge functions |

There is no `GEMINI_*` secret: the AI layer was moved to OpenRouter, and the key is a
function secret so it never reaches the browser.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Serve the production build locally |
| `npm run smoke` | Serve `dist/` and assert the built app mounts with no page errors |
| `npm run icons` | Regenerate PWA icons from the SVG definition |
| `npm run migrations` | Read-only cross-check of which SQL migrations the live project has applied, and which are still outstanding. Never writes. |
| `node scripts/catalog-doctor.mjs` | Read-only report on product data quality: duplicate products, damaged names, placeholder categories, unit spellings, and which migrations the live project has applied. |
| `node scripts/catalog-doctor.mjs --apply` | Applies that repair, writing a JSON backup plus a `.rollback.sql` into `scripts/backups/`. Add `--no-merge` to fix fields without deleting duplicate rows. |
| `node scripts/catalog-doctor.mjs --prune-uncatalogued` | Reports the branch rows whose product is not in the catalogue. With `--apply` it removes them, after backing them up. |

While `npm run dev` is running, `permissions-check.html` runs assertions against the
real `services/permissions.ts` module in the browser and prints a pass/fail table —
the project's only executable test of the branch access rules. It is a development
aid, not part of the production bundle.

While `npm run dev` is running, `ui-review.html` embeds the real app in phone, tablet and
desktop frames for visual review, e.g.
`http://localhost:3000/ui-review.html?device=desktop&route=%23inventory&theme=light`. It is a
development aid only and is not part of the production bundle.

## Supabase provisioning

Run `npm run migrations` to see what is already applied — it is read-only, and it
prints the same information as `migration-check.sql`, which you can paste into the
SQL editor when you want the parts the REST API cannot reach (triggers,
constraints, RLS policies).

`supabase/migrations/` holds the schema-tracked files. Everything in the repository
root up to `phase6` is already applied on the live project; the phases below are the
ones that still need running.

### Run these, in this order

```
1. phase11_item_date_fix.sql      -- today: add/edit item are broken without it
2. node scripts/catalog-doctor.mjs --apply   -- cleans duplicates (not SQL)
3. phase7_integrity_migration.sql -- negative stock + PO receipt
4. phase8_product_integrity.sql   -- uniqueness + trimming
5. phase10_app_settings.sql       -- central settings (currency, retention)
```

`phase9_branch_permissions.sql` is optional for now: it adds `can_edit_location()` /
`can_read_location()` in SQL, matching `services/permissions.ts`. Apply it when you
move to Supabase Auth, so the branch rule can be enforced by RLS — on its own it
enforces nothing.

Each file runs in one transaction and is safe to re-run.

### Why each one matters

- **`phase11_item_date_fix.sql`** — `execute_add_item` and `execute_edit_item`
  declare `p_expiration_date` as `text` but write it into a `date` column, so
  **every** add and edit fails with `42804 column "expiration_date" is of type date
  but expression is of type text`. Postgres raises this at plan time, before any row
  is touched, so it does not matter what the caller passes. Until this runs, a
  branch cannot add a catalogue product and nobody can correct an existing item.
- **`catalog-doctor.mjs --apply`** — phase8's unique indexes cannot be created while
  duplicate `(location, name)` rows exist, and it fails loudly rather than silently
  skipping them. Run it first; it backs up before it deletes.
- **`phase7_integrity_migration.sql`** — clamps negative stock (with the originals
  preserved in `inventory_negative_stock_backup`), adds `CHECK (quantity >= 0)`,
  guards usage logging against over-issuing, and replaces `receive_purchase_order`
  with an atomic version that credits the PO's own location and can receive a
  partially delivered order.
- **`phase8_product_integrity.sql`** — case/whitespace-insensitive unique indexes per
  location, `CHECK` constraints against untrimmed names, and `execute_add_item` /
  `execute_edit_item` rebuilt to trim on write and report duplicates clearly.
- **`phase10_app_settings.sql`** — adds `updated_by` to `app_settings`, and seeds
  `currency` (SAR) and `retention_months` (0). The settings screen works without it,
  but stays local-only and cannot record who changed a setting.

See [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md) for the reasoning behind each.

Deploy the edge functions and their secrets:

```bash
supabase functions deploy ai-assistant
supabase functions deploy push-notifications
supabase secrets set \
  OPENROUTER_API_KEY=sk-or-v1-... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
```

### AI features on OpenRouter

The assistant and the PDF transfer importer both call the `ai-assistant` edge function, which
relays one `POST /api/v1/chat/completions` request to OpenRouter. The key is a function secret;
the browser never sees it. Configure with:

| Secret | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | **Required.** Provider key. |
| `OPENROUTER_MODEL` | Model slug. Default `google/gemini-2.0-flash-001` (cheap, JSON-capable, vision-capable). |
| `OPENROUTER_MODELS` | Comma-separated allowlist the app may pick from; anything else is rejected as `model_not_allowed`. |
| `OPENROUTER_FALLBACKS` | Models retried automatically on 402/429/5xx. |
| `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE` | Sent as `HTTP-Referer` / `X-Title` for OpenRouter attribution. |
| `OPENROUTER_DENY_DATA_COLLECTION` | `true` routes only to providers that do not train on prompts. |
| `AI_MAX_TOKENS`, `AI_TIMEOUT_MS` | Output cap (2048) and upstream timeout (60s). |
| `ALLOWED_ORIGINS` | Browser origins allowed through CORS. |

Verify the deployment without spending tokens:

```bash
curl -s "$SUPABASE_URL/functions/v1/ai-assistant" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
# { "configured": true, "provider": "openrouter", "model": "...", "capabilities": ["text","json","vision"] }
```

The same status is surfaced in the admin **Settings** screen, so a missing key or a model that
no longer exists is visible without opening the browser console. Errors are mapped to stable
codes (`ai_not_configured`, `ai_no_credits`, `rate_limited`, `timeout`, `model_not_available`)
and translated in the UI; the PDF importer additionally validates every returned item id and
reports the document lines it could not match.

## Deployment

The app deploys as a static site. `vercel.json` configures the SPA rewrite, aggressive
caching for hashed assets, no-cache for `sw.js`/`index.html`, and security headers
(`X-Frame-Options`, `nosniff`, HSTS, camera-only Permissions-Policy) plus
`noindex`/`no-follow` because this is an internal tool. `public/_redirects` provides the
equivalent SPA fallback on Netlify-style hosts.

## UI and design system

Every screen is composed from one small set of primitives in `components/ui/`, so spacing,
colour, focus behaviour and RTL handling stay identical across the app:

| Primitive | Used for |
| --- | --- |
| `AppShell` | Sidebar + mobile drawer + bottom tab bar + sticky top bar |
| `PageHeader` / `PageBody` | The one title treatment and content container (`max-w-[1600px]`) |
| `FilterBar` | Search, active-filter chips, a mobile filter sheet and the row actions |
| `DataTable` | Dense tables with sticky header, sorting, bulk selection and card fallback on phones |
| `Panel`, `StatTile`, `Badge`, `Field`, `Button`, `Menu`, `Segmented`, `Modal` | Everything else |

Conventions worth keeping:

- **Design tokens** live in `tailwind.config.js` and `index.css` (brand/status palettes,
  elevation, `z-*` layers, tabular numbers, one focus ring, reduced-motion handling).
- **RTL is automatic.** Use logical utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`,
  `end-*`, `text-start`) and `rtl:rotate-180` for directional icons; never `left/right`.
- **Language and theme switches** live in the shell top bar (`AppControls`) — not as floating
  overlays, which used to sit on top of cards and forms.
- **Keyboard:** `⌘K` / `Ctrl+K` opens the command palette (jump to a screen, item or action),
  with arrow-key navigation, `Enter` to run and `Esc` to close. Tables and menus are fully
  keyboard reachable.
- **Mobile first:** primary destinations stay in thumb reach in the bottom bar, filters open
  as a sheet, dialogs become bottom sheets, and `pb-safe` keeps controls clear of the home
  indicator.

## Architecture notes

- **Offline first.** Queries are persisted to IndexedDB; pending mutations resume when the
  connection returns. Retries are limited to transient/network failures — stock movements,
  transfers and receipts are not idempotent, so a blanket retry could double-apply a write.
- **Realtime.** A single subscription layer (`useRealtimeSubscriptions`) invalidates queries
  as rows change.
- **Service worker.** `sw.ts` precaches the build output, serves the app shell for
  navigations, runtime-caches the webfonts, and handles push notifications. Updates activate
  in the background; the user is told but never interrupted mid-task.
- **AI features** (assistant chat, PDF transfer import) go through the `ai-assistant` edge
  function, which holds the OpenRouter key and normalises provider errors. If it is not
  deployed the features degrade with a clear, translated message instead of breaking the page.
  The function also supports vision (`images: [dataUrl]`) and a `GET` status probe.
- **UI layer.** Screens own their data and state; presentation is delegated to
  `components/ui`. `AdminDashboard` and `InventoryDashboard` both run on `AppShell` with a
  `⌘K` command palette, so navigation and shortcuts behave the same for admins and staff.
- **Business settings.** `hooks/useAppSettings.ts` reads and writes `public.app_settings`
  (see `phase10_app_settings.sql`): currency, transfer rules and transaction retention. The
  administrator sets them once and every user on every device gets them. This used to be
  `localStorage`, so a rule applied only to the browser it was typed into, and currency was a
  build-time variable needing a redeploy. Language and theme deliberately stay per-browser —
  those are personal preferences. If the settings table is missing the hook keeps working from
  `localStorage` and the settings screen says so; if the table exists but predates `updated_by`,
  saving retries without that column rather than failing.
- **Subscription gate.** `components/SubscriptionGate.tsx` sits *above* `App`, so an expired
  licence does not merely cover the screen — the application never mounts, and no query,
  realtime channel or scheduled cleanup runs behind it. The decision logic lives in
  `hooks/useOMSSubscription.ts`: the period end is compared against the clock every 30s (so
  a session left open locks itself at the expiry moment), the last confirmed state is cached
  in `localStorage` (so an offline client cannot outrun the expiry), and the billing service
  is re-checked every 5 minutes, on reconnect and when the tab becomes visible. Any status
  other than `active` — `past_due`, `canceled`, `unpaid` — locks as well. Before the first
  successful check, and if the check fails with nothing cached, the app stays locked and says
  the licence could not be verified. The period end is read as the *end* of the day when the
  billing service reports a date without a time. Assertions for all of this run in
  `subscription-check.html` (25 cases) against the real module.

  Two caveats worth knowing. Without `VITE_OMS_SUPABASE_URL`/`_ANON_KEY` there is nothing to
  check against, so the gate is off and the app runs — that is a deliberate escape hatch for a
  deployment that is not licensed through OMS, and it is logged as a warning. And like every
  client-side licence check this governs the app, not the API: the anon key still reaches the
  database directly (`PRODUCTION_AUDIT.md`, risk 1).

  To exercise it: open `subscription-check.html` with the dev server running for the 25
  assertions, or set `localStorage.dawar_subscription_override` to the same shape as the cache
  (`{ status, periodEnd, simulateFailure, ... }`) to rehearse the lock screen without waiting for
  a real expiry. The override is read only in a **development** build, so it cannot be used as a
  bypass in a deployed app.

## Known limitations

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for build, delivery and interface
debt, and [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md) for the inventory-domain audit — what
was silently broken in the data path, what was fixed, and the branch permission model.
[ROADMAP.md](./ROADMAP.md) lists what is still needed to reach international-grade
(identity, multi-currency, tax, traceability, compliance, integrations).

### Purchase order approvals

A **branch manager's order is created approved.** Branches order for their own shelf and there
is nobody to approve for them, so the create dialog shows one `Create Order (approved)` action
instead of draft/submit, and `useInventoryData.handleCreatePO` forces the status so no other
code path can leave a branch order waiting. Admin and warehouse flows keep draft and
submit-for-approval. Editing and cancelling stay available to whoever may write the order's
location.

### Branch access control

`services/permissions.ts` is the single source of truth: `admin` may read and write
every location, and everyone else has full access to their own branch plus any branch
granted to them, and read-only access to the rest. `app_users.accessible_branches` holds
the grants, with a `"<branch>:read"` suffix marking read-only. Wire new write paths
through `canWriteLocation()` rather than comparing `role` by hand — the hand-written
checks this replaced disagreed with each other and ignored the grants entirely.

On top of that:

- **Branches may add catalogue products to their own shelf, but cannot create new
  products** (`canAddCatalogItem()` / `canCreateProduct()`). Creating a product is
  admin-only and happens on the Catalog screen; the add-item dialog is catalogue-only
  for everyone, and the name fields are read-only in create mode.
- **Branches may delete items on their own branch** (`canDeleteItem()`), which is how
  a branch stops carrying something.
- Every inventory row must reference a `product_catalog` product. Coverage is
  verifiable any time with `node scripts/catalog-doctor.mjs`.

`permissions-check.html` (dev only) asserts all of these rules in the browser.

The most important open item is that authentication is deliberately lightweight for
internal use: users are rows in `app_users` with plaintext passwords, and access control
relies on the Supabase anon key plus RLS. Replace it with Supabase Auth before exposing
this app outside the company.

Tables are read with paged requests (`services/pagedFetch.ts`). Do not add an unpaginated
`.select('*')`: Supabase caps a response at 1000 rows by default and reports no error,
which is how 85 inventory items and most of the transaction ledger used to disappear.
