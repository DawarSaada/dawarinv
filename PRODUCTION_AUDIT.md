# Inventory system audit — correctness, AI, and roadmap

Date: 2026-09-19
Scope: the inventory data path end to end — items, stock movements, transfers,
purchase orders, audits, notifications, realtime — plus the OpenRouter AI layer
and a UI recheck.

Everything below was measured against the live project, not inferred. Read-only
probes only; nothing was written to production except the migration noted as
"apply this".

---

## 1. The headline: the app was only ever loading part of the database

Supabase caps every response at `db-max-rows` — **1000 rows by default** — and
returns no error or marker when it does. Every list query in the app was an
unpaginated `.select('*')`, so each screen silently worked on a truncated copy.

Measured on the live project:

| Table | Rows in DB | Rows one request returns | Consequence in the UI |
| --- | --- | --- | --- |
| `inventory_items` | 1,085 | 1,000 | **85 items invisible** |
| `transactions` | 4,722 | 1,000 | **79% of history missing** from reports and the log |
| `notifications` | 2,042 | 1,000 | old alerts unreachable |

`inventory_items` was the worst of the three because the 1,000 rows that came
back were in no defined order, so *which* items were missing could change between
loads. Concretely, for the Jawafa branch (`b01`): the database holds **272** items
and **94** below minimum; the app displayed **229** and **92**.

That is the answer to "is it working properly" — no. Users could not see, search,
transfer, count or audit roughly one item in twelve, and consumption reports were
computed over a quarter of the ledger.

**Fixed.** `services/pagedFetch.ts` walks a table with `.range()` until a short
page is returned. Every list query in `hooks/useQueries.ts` now uses it, with a
unique tiebreaker in the `ORDER BY` so paging cannot repeat or skip rows. A
`MAX_ROWS` safety valve logs if a table ever exceeds 20,000 rows.

Verified in the running app: Jawafa now reports **272 items, 94 below minimum**,
matching the database exactly.

> Follow-up worth doing: correct ≠ scalable. The browser now downloads all 1,085
> items and all 4,722 transactions. That is fine at this size and will not be at
> 50,000. The durable fix is server-side aggregation for reports plus a date
> window on the log, not a bigger client-side fetch.

---

## 2. The stock ledger was already broken: 71 items at negative quantity

`execute_daily_log()` subtracted usage without checking stock, and
`inventory_items.quantity` had no lower bound, so any over-issue went through
silently. The database currently holds **71 items with negative quantities**
(44 in mammal, 27 in warehouse), as low as **-2,735** for Orange Juice and
**-764** for Potatoes.

This is not cosmetic: thresholds, totals, low-stock alerts and transfer
availability all assume a non-negative quantity, so every one of those figures is
wrong for those items.

**Migration `phase7_integrity_migration.sql` (apply this):**

1. Copies the offending rows into `inventory_negative_stock_backup` **before**
   touching anything, so the original figures are not lost.
2. Clamps the negatives to `0` and adds `CHECK (quantity >= 0)` and
   `CHECK (min_threshold >= 0)`.
3. Rewrites `execute_daily_log` to lock the item row (`FOR UPDATE`), reject a
   zero or negative amount, reject an item that does not belong to the location
   being logged, and **raise a readable error naming the item, the location and
   the available quantity** when usage exceeds stock. The whole batch aborts
   rather than half-applying.
4. The client now surfaces that server message instead of a generic "an error
   occurred".

**Action needed from you:** the clamp is a repair, not a fix. Those 71 items need
a physical count — the backup table has the original numbers and the migration
prints the count as a `NOTICE`. Until then, staff will be correctly blocked from
issuing stock that the system believes is at zero.

---

## 3. Purchase-order receiving silently produced no ledger entry

`receivePurchaseOrderMutation` re-implemented receipt in TypeScript as a loop of
round-trips instead of calling the `receive_purchase_order` RPC that already
existed — and an atomic version of exactly that logic had been written in Phase 3
and never wired up.

Four separate defects followed from that:

- **The ledger entry never happened.** Both `transactions` inserts named
  `item_id` and `location_id`. Neither column exists on `transactions`, so both
  inserts failed — and the result was `await`ed without checking `error`, so the
  failure was swallowed. Stock went up; the audit trail recorded nothing.
- **Wrong location.** Transactions were written with `location_id: 'warehouse'`
  even for a PO belonging to a branch, and inventory was credited to
  `po.location_id` — two different places from one receipt.
- **Lost updates.** `quantity` was read, incremented in JS and written back, so
  two receipts (or a receipt and a transfer) interleaved and one was lost.
- **No over-receipt cap.** You could receive more than was ordered; the RPC
  version marks the whole thing received even when lines were part-received.

**Fixed.** The mutation now calls the RPC, and `phase7_integrity_migration.sql`
replaces that RPC with a correct one that: runs in a single transaction, locks the
PO and each line, credits the PO's own location, matches stock by **exact**
name (the old `ilike` treated `%` and `_` in product names as wildcards and could
merge two different products), caps each line at the ordered quantity, refuses to
re-receive a closed order, writes a ledger row shaped like the rest of the receive
path, closes the PO only when every line is complete, and returns
`{ status, received, fully_received, location_id }` so the UI can say
"partially received" instead of pretending.

Two related fixes in the same area:

- Editing a PO used to delete and re-insert every line, resetting
  `received_quantity` to `0` for anything already part-received. Existing receipt
  quantities are now carried across by line name and capped at the ordered amount.
- PO numbers are random 4-digit values under a `UNIQUE` constraint; a collision
  threw a raw "duplicate key" error. The insert now retries, and a PO header whose
  lines fail to insert is rolled back rather than left empty.

---

## 4. "Mark as read" was deleting notifications

`markNotificationAsRead` and `markAllNotificationsAsRead` issued `DELETE`. The
`notifications.is_read` column exists (and the query already reads it) but was
never written. Low-stock alerts are generated by a database trigger, so the
practical effect was: staff "clear" an alert, the row disappears, and the next
change to that item's quantity generates the same alert again — while the history
they wanted to review is gone for good. Both mutations now set `is_read = true`.

---

## 5. Realtime fired a full refetch per row

Each `postgres_changes` event invalidated a query immediately. A single daily log
or PO receipt writes many rows, so one action triggered many full-table refetches
on **every** connected client — multiplied by the truncation problem above. Events
are now coalesced on a 600 ms trailing edge, so a burst collapses into one
refetch. Channels are also declared in a table-driven list instead of four
copy-pasted blocks.

---

## 6. Demo data could masquerade as real data

`useInventoryQuery` returned `INITIAL_INVENTORY` whenever the query came back
empty, and `useUsersQuery` returned `INITIAL_USERS` — plaintext sample logins —
whenever `app_users` was empty or had not been migrated yet. An empty database
therefore rendered as a stocked warehouse and, worse, accepted hardcoded
credentials. Both fallbacks are gone; an empty table now means empty. Locations
keep their static fallback deliberately: locations are configuration, not
recorded data.

---

## 7. OpenRouter AI — checked, and it is correctly wired

You asked specifically about this. The AI path is sound and, as of this audit,
nothing about the key is exposed to the browser.

- `supabase/functions/ai-assistant/index.ts` is the only thing that talks to
  OpenRouter. The key is a function secret; `vite.config.ts` no longer injects any
  AI variable into the bundle (`grep` for `GEMINI`/`OPENROUTER` in the client
  finds no key, and `.env.example` documents that there are intentionally no
  `VITE_AI_*` variables).
- Requests are validated before they are forwarded: prompt required and capped at
  120,000 characters, model must be on the `OPENROUTER_MODELS` allowlist, at most
  4 images of ~4 MB each, JSON output requested via `response_format` and retried
  without it if a model rejects it, fallback models retried on 402/429/5xx, and a
  request timeout (`AI_TIMEOUT_MS`).
- Failures come back as stable codes — `ai_not_configured`, `ai_no_credits`,
  `rate_limited`, `timeout`, `model_not_available`, `prompt_too_large`,
  `invalid_response` — which `services/aiClient.ts` maps to typed errors and
  `describeAiError` renders in the user's language. No stack traces reach users.
- All three AI features go through it: assistant Q&A (`services/aiService.ts`),
  PDF transfer import (`services/pdfService.ts`, JSON-schema output validated
  against known item/location ids before anything is acted on), and the proxy's
  vision support for photos.
- Model output is never trusted with inventory math: the PDF importer drops unknown
  ids and non-positive quantities, and floors quantities to integers.

**What I added.** `getAiStatus()` existed but was never called, so there was no way
to tell from inside the app whether AI was live. Admin → Settings now has an
**AI Assistant (OpenRouter)** panel showing configured / not configured, the
active model, the fallback list, and a re-check button — with the exact
`supabase secrets set OPENROUTER_API_KEY=…` command shown when it is not
configured.

**To turn it on:** `supabase secrets set OPENROUTER_API_KEY=sk-or-v1-…` then
`supabase functions deploy ai-assistant`. Until then the panel reports
"Not configured" and the assistant/PDF import show a translated message rather
than failing silently. Pick a vision-capable model if you want photo receiving,
and one with reliable JSON output for the PDF importer.

---

## 8. UI recheck

Checked at 390 px and in the live app in both themes. The revamp from the previous
pass holds up: one shell, one filter bar, cards instead of a squeezed table on
phones, thumb-reachable bottom nav, 272 items rendering with correct low-stock
counts.

Two observations, neither new breakage:

- A branch-manager session landing on an admin route lands on the inventory screen
  with no explanation. That is a missing "not available for your role" state, not
  a crash, and it is what made the admin screens unreachable from the review
  harness with this session.
- Several dialogs (transfer detail, purchase order, audit, add item) still carry
  their own overlay markup, so they inherit the tokens but not the shared focus
  trap or the mobile bottom-sheet behaviour. Already noted in
  `PRODUCTION_READINESS.md`.

---

## 9. Remaining risks, in priority order

1. **Auth (unchanged, at your request).** Users live in `app_users` with
   plaintext passwords compared in the browser, and access rests on the anon key
   plus permissive RLS (`USING (true)`). Anyone with that key can read and write
   everything. The anon keys are also hardcoded in the helper scripts in the repo
   root. This is the one item that would stop me calling the system production
   ready, and it is a containment problem, not a data-quality one — the app is
   internal, so the exposure is anyone who obtains the key.
2. **Stock take needed for the 71 repaired items** (see §2).
3. **Whole-table reads.** Correct now, but they grow. Reports should aggregate in
   SQL; the transaction log should take a date range.
4. **Product identity is a string.** Catalog items, PO lines and inventory rows are
   matched by `name_en`/`name_ar` text. That is the root cause of the `ilike`
   merging bug in §3 and will cause duplicates as the catalog grows. A stable
   `catalog_id` foreign key on `inventory_items` and `purchase_order_items` is the
   single most valuable structural change left.
5. **Purchase orders cannot be "partial".** `purchase_orders.status` allows only
   `draft, pending, approved, received, cancelled`, so a partly received order
   keeps its previous status. Add a `partial` state (schema + UI) to make the
   state machine honest.
6. **Audits have never been run** — `audits` and `audit_items` are both empty. The
   module is unexercised against real data; do one supervised cycle before
   relying on `apply_audit_variances`.
7. **No write history.** Items are hard-deleted with no record of who removed them,
   and there is no change log anywhere. The transactions table is a movement
   ledger, not an audit log.
8. **Repo hygiene.** ~30 ad-hoc `.mjs`/`.cjs` probe scripts sit in the project root,
   several with credentials in them, and there is no unit test runner — the safety
   net is `tsc`, a build and a headless smoke test.

---

## 10. What would make it genuinely impressive

Ordered roughly by value per unit of effort. The first three are directly enabled
by what is already in the codebase.

**Close to done already**

- **Reorder automation.** `min_threshold` and `suppliers.supplied_items` both
  exist and are unused. One grouped-by-supplier "suggested purchase orders" screen
  that turns every low-stock item into draft POs would remove the manual step that
  the 94 low-stock items in Jawafa currently require.
- **Expiry management.** `expiration_date` is stored but nothing acts on it, and
  this is a food operation (liver, parsley, orange juice). Expiry dashboard, FEFO
  issue suggestions, and an alert ahead of expiry — high value, low effort.
- **Cycle counting on the Audits module** — ABC classification so A-items are
  counted monthly and C-items quarterly, with a mobile count sheet and variance
  review. The plumbing is already built; it just needs to be used.

**Structural**

- **Stable product identity** (`catalog_id` FK) as described in §9.4, which then
  unlocks cost tracking: `product_catalog.default_price` plus a `unit_cost` on
  receipts gives inventory valuation, COGS and shrinkage in currency instead of
  units.
- **Immutable movement ledger.** Make `transactions` append-only with a
  `movement_id` per stock change, and derive `quantity` from it. Then "why is this
  number this?" is always answerable, and reconciliation becomes a report instead
  of an investigation.
- **Idempotency keys on writes.** Offline queueing already exists; without a
  client-generated key, a retry can double-apply a movement. This is the last real
  correctness gap in the offline story.

**Using the AI layer you now have**

The OpenRouter proxy supports text, JSON-mode and vision, so these are all small
increments on top of it:

- **Photo receiving** — photograph a delivery note or the pallet, get draft
  quantities to confirm. Vision is already enabled in the proxy and the client
  already has a camera path.
- **Supplier price list import** — the same PDF → JSON-schema mechanism as the
  transfer importer, pointed at supplier catalogues, to create/refresh
  `product_catalog` rows.
- **Arabic label OCR** — photograph a product label, get `name_ar`/`name_en`,
  category and unit filled in.
- **Anomaly review** — a nightly pass over the ledger flagging implausible
  movements (like the -2,735 Orange Juice already sitting in the data). This is
  exactly the class of bug that went unnoticed for so long.
- **Natural-language reporting** — the assistant already answers questions over
  inventory; point it at the ledger for "what did Habuna consume most of last
  month?".

**Operational**

- **Server-side enforcement.** Move roles into Supabase Auth (or signed JWTs) and
  make RLS the boundary rather than a permissive policy plus client-side checks.
  This is the item that turns "internal tool" into something defensible.
- **Observability.** Sentry-style error reporting plus a small view of failed
  mutations; right now a swallowed error is invisible (which is exactly how §3 hid
  for as long as it did).
- **Test coverage.** A handful of unit tests around the paging helper, the stock
  guards and the PO receipt would have caught §1–§3 before production.

---

## Branch permissions (added 2026-09-19)

Agreed model: **admin** may read and write every location; everyone else has full
access to their own branch (and any branch granted to them) and **read-only**
access to the rest.

The grant model already existed in the data — `app_users.branch_code`,
`accessible_branches`, and a `"<branch>:read"` suffix for read-only grants — but
the enforcement was scattered and contradictory:

- `useInventoryData` only compared `branch_code`, so a branch manager who had
  been **granted full access to another branch was silently blocked** from editing
  it. The grant was configurable in the admin UI and did nothing.
- A branch listed as read-only for a user **was still editable**: the dashboard
  computed `isReadOnly` and then never applied it to the edit or usage flags.
- `canRecordUsage` contained `locationId === 'warehouse' || locationId === 'warehouse'`,
  a copy-paste that denied warehouse managers usage at mammal.
- `canBulkEdit` excluded branch managers outright.
- **Bulk edit, transfers, daily logs, and item deletion from the admin inventory
  screen had no permission check at all.** A warehouse manager could delete stock
  in any branch.

Everything now comes from `services/permissions.ts`, which is the single source of
truth, is wired into every write path in `useInventoryData`, drives the dashboard's
write flags, and gates the admin inventory actions. A refused write now says *why*
("You have read-only access to this location") instead of appearing to do nothing.

Verified by `permissions-check.html`, which runs 16 assertions against the real
module in the browser: read-only grants beating a home branch, cross-branch full
grants working, warehouse and mammal staff scoped correctly, and unknown users
failing closed. All 16 pass.

### What branches may and may not do (agreed 2026-09-19)

- **Add:** a branch may put a **catalogue product** on its own shelf; it may not create
  a **new product**. Product creation is admin-only and happens on the Catalog screen.
  The add-item dialog enforces this by requiring a catalogue selection (the name fields
  are read-only in create mode), and now says so explicitly when the catalogue is empty
  rather than silently leaving the form unfillable.
- **Delete:** a branch may remove an item from its own branch — that is how it stops
  carrying something. Allowed anywhere the user has write access.
- **Catalogue-only:** every `inventory_items` row must reference a `product_catalog`
  product. **Coverage is now 100%** (962 rows, 0 unmatched). An audit found 35 rows
  (3.5%) with no catalogue entry — mostly still-corrupted names whose real product could
  not be determined (`Heese Ie Acket`, `Tella Eant Tter Ie Acket`, `Alt Aper`,
  `Wholemeal Flor Mixtre`), one row whose English name was Arabic (`خلية كبير`), and the
  unresolved `Remote control stones` / `Alom Stra` / `Hello`. Per the operator's
  decision those 35 rows were removed from the branches, taking **347 units** of stock
  with them (b01 8 rows, b02 10, b03 8, mammal 7, warehouse 2). They are fully backed up
  in `scripts/backups/` with a rollback script, and their ledger history is untouched
  because transactions store item names rather than ids. **Any of these the business
  still stocks should be re-created as catalogue products and added back — the backup
  has the quantities.**

### Purchase order fixes in the same pass

- The branch PO screen passed `userName={''}`, so **a branch receiving a purchase order
  wrote a ledger entry with no performer**, and a branch-raised PO recorded an empty
  `created_by`. Both now pass the real user name.
- The receive dialog's banner still claimed stock goes to the **Warehouse** even though
  the receipt correctly credits the PO's own location. It now names that location.
- **Only `approved` orders showed a Receive button**, so a `pending` order could not be
  received at all. `pending` and `approved` are both receivable now — which is also the
  intersection of the old and new `receive_purchase_order` implementations, so it is
  safe before and after phase7.
- Received quantities are now **clamped to what is still outstanding**, per line, with a
  `max` hint and a disabled field once a line is complete. Previously you could type 500
  against 5 outstanding and the server would silently clamp it.
- The list shows **partial-receipt progress** per order (`received / ordered` with a
  bar) and a remaining-lines count on the button, so a half-received order no longer
  looks untouched.
- Currency is no longer hardcoded `SAR`; it comes from `VITE_CURRENCY`.

Adjusting quantities happens in the receive dialog, which is open to **any user who can
see the order** — that is the quantity adjustment being asked for. Editing the order's
supplier, prices and line-up stays administrative.

**Honest boundary.** This is a UX and integrity control, not a security boundary.
Without Supabase Auth, anyone holding the anon key can write through the REST API
and bypass every check — which is why `phase9_branch_permissions.sql` adds
`can_edit_location()` / `can_read_location()` in SQL as the primitive to enforce
these rules via RLS once Auth lands, rather than rewriting five RPC signatures now
for no real gain. Also worth knowing: the app re-syncs the signed-in user from
`app_users` on load, so grants are authoritative from the database rather than
from anything a user can edit locally.

## Stale data on load (found 2026-09-19)

Caught by cross-checking the app against the database after the catalogue prune: the
DB said Jawafa held 224 items and the screen said 232 — a difference of exactly the
rows that had just been deleted.

The cause was a combination of two settings in `index.tsx`, both individually
reasonable:

- `staleTime: 5 * 60 * 1000` — queries were considered fresh for five minutes.
- a **persisted** query cache in IndexedDB with a 24-hour `gcTime`.

Together they meant a page load painted whatever was cached and did not revalidate:
up to five minutes of staleness inside a session, and the *previous session's* data
otherwise. A quantity written by another device, by an operator running a script, or by
the database itself would not appear. For an inventory screen, a stale quantity is a
wrong quantity, and nothing in the UI indicated the numbers were old.

Realtime invalidation was supposed to cover this during a session, but it cannot cover
a cold load, and it is not a correctness guarantee if a channel drops.

**Fixed** with `refetchOnMount: 'always'` plus `staleTime: 30s`: the cached data still
paints instantly (so the offline-friendly behaviour is kept), and every load revalidates
in the background. Verified — the app now reports 224 / 79 below minimum, matching the
database.

## Appendix: the product data was already corrupted (repaired 2026-09-19)

Found while checking whether the item data and categories were right. It is the
largest single defect in this audit, and it was invisible from the UI because the
damaged names had been there for as long as anyone had looked at them.

### The signature

A large set of English product names is missing **the first letter of every word
and every letter `u`**:

| Stored now | Was meant to be |
| --- | --- |
| `Rown Lor Ix` | Brown Flour Mix |
| `Range Ice` | Orange Juice |
| `Esto Ace` | Pesto Sauce |
| `Ettce` | Lettuce |
| `Ggplant` | Eggplant |
| `Omato Lices` | Tomato Slices |
| `Iver Heese Ie Acket` | Liver with Cheese Sachet |
| `Perin Water` | Berain Water |

`B`rown, `F`lour and `M`ix each lose their first letter, and `Flour` also loses
its `u` — which is why `Flour` became `Lor` rather than `lour`.

This was not cosmetic. It broke the string matching the whole system relies on,
so a damaged row could not be found by search, could not be matched to its
`product_catalog` entry, and therefore kept a placeholder category. That is the
real reason `Uncategorized` held 171 rows.

I could not reproduce the transform from any script in the repository — the
Arabic-stripping regex in `syncOmsToInventory.mjs` looks suspicious, but I ran it
and it behaves correctly — so this came from a one-off bulk edit or an import
that no longer exists. What matters is that the damage is detectable and
reparable.

### Why it was reparable

The corruption only ever touched `name_en`. The Arabic name is intact, and
`product_catalog` holds the correct English names. So `خلطة الدقيق البر` pointed
straight at the right product even though the English said `Rown Lor Ix`.

### What was done

`scripts/catalog-doctor.mjs` (report by default, `--apply` to write) resolves each
row to a real product — by exact English name, then by Arabic name, then by
reproducing the corruption against the catalog — and then:

| Change | Count |
| --- | --- |
| Corrupt English names recovered | 122 |
| Categories corrected from the catalog | 144 |
| Categories inferred for catalog-less products | 16 |
| Duplicate groups merged | 84 (88 rows removed) |
| `product_catalog` duplicates removed | 17 |
| Trailing/duplicated whitespace in names trimmed | all rows |
| Unit spellings normalised (`Peace` to `Piece`, `cartoon` to `Carton`) | 54 spellings, 0 non-canonical |

Result: `inventory_items` 1,085 to 997, `product_catalog` 241 to 224, distinct
categories 14 to 11, `Uncategorized` 171 to 5.

Two effects are visible in the app. Jawafa went from displaying 272 items and 94
below minimum to 232 and 80 — because the same product had been split across two
rows, one of which usually showed 0. **The stock was always there; the low-stock
alerts were false.** Parsley is a good example: 35 in one row and 230 in another,
reported as low stock, actually 265 on hand.

Merging sums the quantities, which is right for rows that are genuinely the same
product and is what the Arabic-name match verifies. Every change is backed up to
`scripts/backups/product-data-<timestamp>.json`, with a matching
`.rollback.sql` that restores both tables if any merge turns out to be wrong.

### Prevention

`phase8_product_integrity.sql` adds case- and whitespace-insensitive unique
indexes per location, `CHECK` constraints against untrimmed names, and rebuilds
`execute_add_item` / `execute_edit_item` to trim on write, reject an empty name,
and raise a readable message when a duplicate is attempted. The unit field now
offers a canonical list in the add-item dialog instead of free text.

### Left for you

Five rows could not be resolved and keep a placeholder category:
`Remote control stones` (b02, mammal), `Alom Stra` (b03, mammal) and `Hello`
(b03, previously categorised `ABC`). They need a human who knows what they are.

## Subscription enforcement (rewritten 2026-09-19)

Requested behaviour: once the subscription period ends, the whole application stops and the
user is told to contact the administrator to renew. The check existed but could not deliver
that, in four ways.

**Only non-admins were locked.** The old lock screen sat inside `App` behind
`isSubscriptionLocked && currentUser?.role !== 'admin'`, so an administrator kept the entire
application. "Everything stops" now means everyone, administrators included — renewal happens
in the OMS project, not here, so nothing is lost by locking them out.

**It checked once, on mount.** `useEffect(..., [])`, so a session left open ran on past the
period end until somebody reloaded — the one case the control exists for. The period end is now
compared against the clock every 30s, and the billing service is re-queried every 5 minutes, on
reconnect, and when the tab becomes visible.

**It could not lock offline.** This is an offline-first PWA: the app shell is cached and the
queries persist to IndexedDB, so a device that went offline before the expiry kept working
indefinitely, and a device that loaded from cache did not check at all. The last confirmed
licence is now cached in `localStorage`, so the expiry is enforced locally with no network.

**An error locked the business out, and a lock could be missed.** `catch { setIsLocked(true) }`
meant any transient failure — a dropped request on warehouse wifi — stopped every user, with no
retry. Meanwhile the gate itself was porous: it sat *inside* `App`, so while the lock screen was
showing, `App` had already mounted, opened its realtime channels, run its queries and (as
administrator) executed the transaction-retention cleanup.

The gate now sits **above** `App` (`components/SubscriptionGate.tsx`, wired in `index.tsx`), so a
lapsed licence means the application never mounts. A transient failure *after* a successful check
keeps the last known state and re-evaluates it locally rather than locking. A failure with nothing
cached does lock, because there is nothing to trust, and the message says the licence could not be
verified rather than pretending it expired.

### Live state at the time of writing

`polar_subscription_status = active`, `polar_current_period_end = 2026-10-15T23:59:59Z` — the app
is running and will stop by itself at that instant. The OMS project also exposes
`polar_checkout_url`, so the lock screen offers administrators a **Renew subscription** button
next to the contact message.

### Also fixed in the same pass

`AdminSettings` coloured the status with `status.includes('active')`, which is true for
`inactive` as well as `active` — an expired licence was displayed in green. It now uses the
enforcement state, shows the days remaining, warns at 30 days, states plainly that the app is
stopped while the licence is not active, and offers a **Check now** button.

### Decisions worth knowing

- A **date-only** period end (`2026-10-15`) is read as the end of that day in local time. Reading
  it as UTC midnight would stop the app a day early anywhere east of Greenwich.
- **Any** status other than `active` locks: `past_due`, `canceled`, `unpaid`, `incomplete`.
- An `active` status with **no period end** is honoured, since there is no date to reach, but it is
  logged as a warning — without an end date this control can never fire.
- Arabic dates are shown with the **Gregorian** calendar (`ar-SA-u-ca-gregory`). The default
  `ar-SA` locale renders Umm al-Qura, and a renewal deadline reading only as `٥ محادى الأولى ١٤٤٨`
  is not something to act on.
- Without OMS credentials the gate is **off** and the app runs (logged as a warning). That keeps an
  unlicensed deployment working, and it is the one documented way to run without enforcement.
- This is a commercial control, not a security boundary — it governs the app, and the anon key
  still reaches the API directly (risk 1 above).

`subscription-check.html` asserts the decision logic against the real module: **25/25 pass**,
covering expiry, every status, the simulated-failure switch, the legacy month fallback, the
unverified state and the unconfigured state. The smoke test now seeds a cached in-period licence
and fails loudly if the app is held at the gate, so a build check can no longer pass on a loading
splash or silently depend on the billing service being reachable.

## Administrator settings, currency, and branch purchase orders (2026-09-19)

Three requests: everything settable from the administrator account, an optional currency option
in Settings, and branch purchase orders approved on creation.

### The settings screen was writing to one browser

The screen looked like system settings, but two of its three saved values — transfer rules and
transaction retention — went to `localStorage`. A rule set by one administrator applied only to
the device it was typed on: a second administrator saw the defaults, and the staff who are
supposed to follow the rule never received it at all. Currency was a build-time environment
variable, so changing it meant rebuilding and redeploying the application.

All three now live in `public.app_settings` and are read through one context
(`components/AppSettingsProvider.tsx`, `hooks/useAppSettings.ts`). The screen is rebuilt around
that: Licence, Business (currency, retention), Transfers, AI, and System, with the storage mode
shown so an administrator can see whether a change is shared or local.

**There was already an `app_settings` table in the project** — `key`, `value`, `updated_at`, and a
single `transfer_settings` row dated 2026‑07‑06. It was never wired to anything, which is exactly
why settings never travelled. Two consequences, both handled:

- The migration now **upgrades** that table (`create table if not exists` plus
  `alter table … add column if not exists`) instead of assuming it is absent, so running it against
the live database adds `updated_by`, `currency` and `retention_months` and leaves the existing row
alone.
- Because the table exists but lacks `updated_by`, `centralStoreAvailable` is true while an upsert
  carrying that column returns **400**. The save path therefore detects a missing column (`42703` /
  `PGRST204`) and retries without the audit stamp, so the administrator's click works before the
  migration is applied. Verified live: the first POST returned 400, the retry 201, and the
  `currency` row was written and re-read.

### A leftover browser value could delete history

Retention deletes transactions permanently, and the app runs that sweep when an administrator
signs in. It was being driven by whatever sat in that browser's `localStorage` — during this pass
a stale `6` triggered `execute_cleanup_transactions` on load. Nothing was lost (the oldest
movement is 2026‑06‑19, three months old), but it is not a decision anyone made.

The sweep now requires the value to come from the **central store** (`centralValues`), so a number
left behind in one browser cannot delete anything; the manual **Clean up now** button, which
confirms first, remains for the administrator. The migration seeds `retention_months` as **0**
(never delete) for the same reason — seeding anything else would start deleting history on the
next administrator sign-in.

### Currency is now a setting, not a literal

`SAR` was typed into the purchase-order list and modal, the product catalogue and the PDF export.
Those all render through `utils/money.ts`, which reads the administrator's choice from settings,
formats with the right number system per language, and keeps the code on one side of the number to
avoid a bidi mess in Arabic. `VITE_CURRENCY` remains only as the starting value for a fresh
database. Eleven currencies are offered (the Gulf currencies, EGP, JOD, USD, EUR, GBP); there is no
conversion, so this is a label and a format, and the roadmap's multi-currency item is unchanged.

### Branch purchase orders are approved on creation

A branch orders for its own shelf; there is nobody in that flow to approve for it, so the order sat
`pending` forever. A branch manager's create dialog now offers a single **Create Order (approved)**,
and `useInventoryData.handleCreatePO` forces the status so no other code path can produce an
unapproved branch order. Admin and warehouse flows keep draft and submit-for-approval. The
approve/send-for-approval buttons are hidden where they no longer apply, while **Edit Order** and
**Cancel Order** remain for anyone who may write the order's location.

### Known gaps left deliberately

- The existing `transfer_settings` row carried all-off defaults, so centralising transfer rules
  changed nothing for anyone. Any value an administrator had set locally in their own browser is
  now ignored in favour of the central row — worth a check that the toggles read as expected.
- `retention_months` seeds to 0. If the operation was relying on a browser-local 12-month sweep,
  it will stop deleting until someone sets it in Settings.
- Language and theme stay per-browser on purpose; forcing one on every member of staff would be
  wrong. This is stated in the settings screen rather than left to be discovered.

## Verification performed

- `npm run typecheck` — clean.
- `npm run build` — clean (typecheck + client build + service worker precache).
- `npm run smoke` — passes (headless Chrome, built output, asserts it mounts with
  no page errors).
- Live read-only probes for every figure quoted above, and the fix confirmed in
  the running app (Jawafa: 229/92 before → 272/94 after, matching the database).
- `permissions-check.html`: 16 branch-access assertions, all passing.
- `subscription-check.html`: 25 licence assertions against the real decision module, all
  passing; the lock screen verified in the running app for an expired period end, a
  `past_due` status (with the administrator's renewal button) and Arabic/RTL.
- Settings verified in the running app: a branch manager's Purchase Orders tab lists only their
  own order, the create dialog offers `Create Order (approved)`, an existing order offers Edit and
  Cancel but no approval step, and money renders as `SAR 0.00` through the shared formatter.
- Nothing is committed or staged.

## Recheck pass (2026-09-19)

A second pass over the whole system, looking for what the first one missed. Data side, the
database is now clean: **962** inventory rows with no blank name, unit or category, no
untrimmed names, no row outside a known location, **100%** matching `product_catalog`, and
**no duplicate `(location, name)` pair** — the 1,085 rows with 88 duplicates are gone. The
ledger holds 4,701 movements, none with a blank item name or performer.

What the recheck did find:

1. **59 rows are still at negative stock** (mammal 37, warehouse 22; `Liver` −663, `Tea Mint`
   −578, `Liver Onions` −467). This is the same defect as §2 and it is still live because
   `phase7_integrity_migration.sql` has not been applied. Nothing in the client can fix it: the
   `CHECK (quantity >= 0)` constraint and the guard in `execute_daily_log` are both server-side.
   **This remains the one item blocking a "production ready" answer on data integrity.**
2. **Purchase-order approval and receipt were unguarded in the admin screen.** The branch
   screen guarded receiving, but `AdminDashboard` — which a warehouse manager can open — passed
   `onReceivePO` and `onUpdatePOStatus` straight through. Approving, cancelling or receiving a
   branch's order writes that branch, so both now resolve the order's own location and require
   write access there (`useInventoryData`), and the status/edit controls are withheld when the
   viewer can only read that location.
3. **Deleting a supplier is now an administrator action.** Suppliers are shared master data that
   purchase orders reference; a branch or warehouse user could delete one from the admin screen.
4. **`inactive` was rendered as `active`** in the admin settings screen (`String.includes`),
   and is fixed as part of the subscription work above.
5. **58% of the catalogue has no minimum threshold** — 129 of 224 products have
   `min_threshold = 0`, and 88 items across the sites sit at zero with no threshold set. The
   app counts low stock as `quantity <= minThreshold`, so those products are flagged the moment
   they reach zero and never warned before it. This is data entry, not a code defect: setting a
   threshold per product is what turns "below minimum" into an early warning. It is left for you
   deliberately — inventing thresholds would have produced alerts that do not reflect how the
   branches actually order.
6. **`PO-2026-8535`** (branch b01, pending) records no `created_by` and totals zero. Both have
   the same benign cause: it has one line, `Mozzarella Cheese`, with a unit price of 0, so
   `total_amount` really is 0 and the total trigger is working. The missing `created_by` is the
   branch-PO bug from the previous pass, which is fixed for new orders. It looks like leftover
   test data from verification — safe to delete if it is not a real order.

### The anon key is open for writing

Confirmed by probe: an `UPDATE` against `inventory_items` with nothing but the anon key and a
non-existent id **succeeds**. Combined with risk 1 this means the database is writable by anyone
holding that key, which ships inside the client bundle. Every permission control built in this
project is a UX and integrity boundary — which is why `phase9_branch_permissions.sql` mirrors the
rules as SQL functions ready for RLS. This is the auth item you asked me to leave.

## Migration cross-check (2026-09-19)

Asked to say which of the SQL files actually need running, I probed the live project instead of
trusting the README. `npm run migrations` (new: `scripts/migration-doctor.mjs`) now answers this
from a terminal, and `migration-check.sql` answers it from the SQL editor for the parts the REST
API cannot see.

The probe technique matters, because the obvious one does not work. `GET /rest/v1/rpc/<name>`
answers **404 for a function that exists and one that does not**, identically, so it cannot detect
anything — an earlier version of this script used it and reported all 25 functions missing. The
script now probes functions by *behaviour*, with calls engineered to be incapable of writing: an
empty array, `p_months = 0`, `p_days = 36500`, or an id that matches no row. The server's refusal
is the evidence, and a missing function answers `PGRST202`.

### Already applied

`supabase_schema`, `phase2_notifications`, `phase3_migration`, `phase3_po`, `phase4_audit`,
`phase5_webpush`, `phase6_po`, `catalog_migration`, `transfer_overhaul`, `oms_sync_rpc`, both
`supabase/migrations/*` files. Their tables, columns and functions are all present.

### Still outstanding

| # | File | Evidence it has not run |
| --- | --- | --- |
| 1 | `phase11_item_date_fix.sql` **(new)** | `execute_add_item` / `execute_edit_item` fail with `42804` for every payload |
| 2 | `catalog-doctor.mjs --apply` | 3 duplicate `(location, name)` groups, 8 untrimmed names, 13 placeholder categories, 4 `peace` units |
| 3 | `phase7_integrity_migration.sql` | **68** rows at negative stock; `receive_purchase_order` is the older version |
| 4 | `phase8_product_integrity.sql` | preconditions in row 2; `execute_edit_item` does not raise on an unknown id |
| 5 | `phase10_app_settings.sql` | `app_settings.updated_by` absent; `retention_months` not seeded |
| — | `phase9_branch_permissions.sql` | `can_edit_location()` etc. absent — optional, enforces nothing alone |

`phase5_rls_migration.sql` is a special case worth stating plainly: its *functions* are installed,
but its **RLS half is not in force**. A `PATCH` to `inventory_items` with only the anon key returns
**204**, where phase5 makes that table read-only over REST. So the RPC-only design is not actually
enforced — nothing stops a client bypassing the guards `phase7` adds, as §9 already notes.

### Add and edit are broken right now

This is the finding that came out of the cross-check, and it was invisible from the UI only
because it fails on every attempt.

`execute_add_item` and `execute_edit_item` declare `p_expiration_date` as `text` and pass it
straight into `inventory_items.expiration_date`, which is **`date`** in the live database:

```
42804  column "expiration_date" is of type date but expression is of type text
```

Postgres raises this at plan time, before the row is touched and before any other check, so it does
not matter whether the caller passes a date or `NULL`. Reproduced three ways — direct REST, the
app's own client from the browser, and with a location that fails the foreign key (the type error
precedes it). Confirmed in the running app: adding a catalogue product returns
`Failed to add item: column "expiration_date" is of type date but expression is of type text`.

The root cause is a schema drift nobody could see: `supabase_schema.sql` declares
`expiration_date text`, and guards the column with
`add column if not exists`, so the file and the database disagree and re-running it changes nothing.

`phase11_item_date_fix.sql` resolves it by casting inside the function
(`nullif(btrim(p_expiration_date), '')::date`), which works whichever type wins when the schema is
reconciled, and keeps the signature unchanged so existing calls still resolve. `phase8` carries the
same two functions and now has the same cast, so applying it later cannot reintroduce the bug.

### The data is drifting again

The earlier pass left 962 rows and 100% catalogue coverage. It is now **975 rows**, and every one of
the 13 new rows was written between 08:52 and 08:56 today — by the *previous* deployment, an hour
before the 10:01 push. They carry the old fingerprints: trailing spaces, the `Peace` unit,
`Uncategorized`. Two of them (`yogurt`, `Astra Halloumi Cheese`) are rows this audit pruned as
uncatalogued, re-created by `receive_purchase_order` when it looked for an item that was no longer
there. That is the same defect §7 of the phase8 header describes and the reason phase8's unique
indexes matter: without them, a receipt can resurrect a deleted product.

`catalog-doctor.mjs` resolves all of it — 12 duplicate rows merged, 3 field repairs, 0 residual
collisions — and the run is reported above.
