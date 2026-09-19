# Roadmap: from internal tool to international-grade platform

Written after the data-path audit in [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md),
so it reflects what the code actually does rather than a generic wish list.

Two things shape the ordering:

- **Nothing costs more than being wrong.** The audit found 71 items at negative
  stock, 85 inventory items that never reached the UI, and 122 products whose
  names had been corrupted. Every one of those was a data-integrity defect, not a
  missing feature. Integrity work therefore leads.
- **"International" means more than translated.** The app is already bilingual
  with full RTL, which is ahead of most competitors. What is still
  single-country: currency, units, tax, timezone, and number/date formatting.

Effort: **S** ≈ days · **M** ≈ 1–2 weeks · **L** ≈ 3+ weeks. Priority: **P0** blocks
international use · **P1** needed to win deals · **P2** differentiators.

---

## 1. Identity and access — P0

The one area where the system is not defensible today. Users are rows in
`app_users` with **plaintext passwords compared in the browser**, and access rests
on the anon key plus `USING (true)` RLS. Anyone holding that key can read and write
everything. `phase9_branch_permissions.sql` adds the branch rule in SQL; it only
becomes enforcement once requests carry an identity.

| Feature | Why | Effort |
| --- | --- | --- |
| Supabase Auth (email/OTP + password), `user_id` joined to `app_users` | The boundary everything else depends on | M |
| Role-based RLS on every table, replacing `USING (true)` | Turns the branch rule into real enforcement | M |
| Server-side session instead of a `localStorage` flag | Today a user can edit `dawar_user` in devtools and become an admin | S |
| Password policy, hashing, optional TOTP | Standard procurement requirement | S |
| Session list + force-logout per user | Needed when staff leave | M |
| SSO (Google Workspace / Microsoft Entra) | Most mid-size buyers will ask | M |
| Per-module permissions (not just per-branch) | "Can approve POs but not delete stock" | M |
| Invite + deactivate flow with an audit trail | Replacing shared logins is the first thing an auditor checks | S |

## 2. Data model and integrity — P0/P1

| Feature | Why | Effort |
| --- | --- | --- |
| **`catalog_id` foreign key** on `inventory_items` and `purchase_order_items` | Products are matched by name text today, which is what let 122 names corrupt and 88 rows duplicate. This is the single highest-value structural change. | M |
| Append-only movement ledger (`stock_movements`), derive `quantity` from it | "Why is this number this?" becomes a query instead of an investigation | L |
| Idempotency keys on every write | The PWA queues offline writes; a retry currently double-applies | M |
| Enforce `CHECK (quantity >= 0)` everywhere + nightly reconciliation report | Already added in phase7; the report is the missing half | S |
| Units as a controlled vocabulary with metric/imperial conversion | 54 spellings became 40, but conversion is still impossible | M |
| Lot/batch + expiry per receipt | `expiration_date` is a single field on the item; real FEFO needs per-batch dates | L |
| Soft delete + restore for items | Deletion is permanent and unlogged | S |
| `updated_at` / `updated_by` on every mutable table | No change history exists anywhere today | M |
| Postgres constraints for status machines (PO, transfer, audit) | A partly received PO cannot currently be described | S |

## 3. Core inventory operations — P1

| Feature | Why | Effort |
| --- | --- | --- |
| Guided receiving: scan barcode → suggested quantity → expiry → shelf | Turns a multi-step form into a few seconds per item; the scanner exists, the flow does not | M |
| Guided issue/usage with FEFO suggestion | Stops "we used the newest stock" waste | M |
| Barcode generation for items that lack one | Half the catalogue has no barcode, so scanning cannot help | S |
| Stocktakes on the existing Audits module (ABC scheduling, count sheet, variance approval) | Built but never used — 0 rows in `audits` | M |
| Multi-warehouse transfers with goods-in-transit state and arrival confirmation | Transfers exist; in-transit and partial-arrival accounting do not | M |
| Returns, damage, spoilage and write-off as first-class movements | Currently every loss is recorded as "usage", so waste is invisible | M |
| Stock reservations / allocation for large orders | Prevents the same stock being promised twice | L |
| Min/max + reorder point per location, with auto-drafted POs grouped by supplier | `min_threshold` and `suppliers.supplied_items` both exist and are unused | M |
| Cycle-count scheduling that locks the counted location | `useAuditLock` exists; the schedule is manual | M |

## 4. Procurement and suppliers — P1

| Feature | Why | Effort |
| --- | --- | --- |
| Approval workflow on POs (draft → approve → receive → close, with 'partial') | Only a database status field exists today | M |
| Three-way match (PO / receipt / supplier invoice) | The standard control that catches supplier over-billing | L |
| Supplier price lists with effective dates per item | Prices are typed per PO line, so drift is invisible | M |
| Supplier scorecards (on-time %, fill rate, price variance) | Procurement leverage | M |
| Landed cost (freight, duty) allocated per receipt | Required for true COGS in an import business | L |
| Multi-currency POs with FX rate capture | Imported goods are usually priced in another currency | M |
| GRNI / accrual report for received-not-invoiced | Month-end close requirement | M |

## 5. Reporting, analytics and finance — P1

| Feature | Why | Effort |
| --- | --- | --- |
| Inventory valuation (FIFO / weighted average) | Needs cost on receipts; `product_catalog.default_price` is the seed | L |
| Cost of goods consumed, waste %, shrinkage report | Turns units into money, which is what owners manage | M |
| Server-side aggregation (SQL views/RPCs) | Today 4,722 transactions are shipped to the browser for reports | M |
| Scheduled report emails (daily low-stock, weekly consumption, monthly valuation) | Removes the need to open the app | M |
| Excel/PDF/CSV export honouring the active filters | Export exists; filter-awareness is partial | S |
| Consumption trends and forecasting with seasonality | Reorder suggestions become data-driven | L |
| Budget vs actual per location | Where multi-branch operations feel pain first | L |
| Custom report builder (dimension/metric picker) | The "we need one more report" treadmill | L |

## 6. Internationalization and localization — P0/P1

The app is bilingual with RTL already. These are what "international" adds:

| Feature | Why | Effort |
| --- | --- | --- |
| Multi-currency: per-entity base currency, FX on transactions and documents | Currently no currency concept at all | L |
| VAT/tax rates per item and per jurisdiction, tax-inclusive display | GCC rollout is immediate | M |
| Timezone-correct storage and display (`timestamptz` + per-location zone) | Dates are shown in browser-local time; a multi-country warehouse will be off by hours | S |
| Locale-aware number/date/currency formatting via `Intl` | Arabic-Indic digits and Hijri dates are expected, Gregorian is not always | S |
| Units of measure per market (kg/lb, L/gal, piece/box/case) | Reporting in the wrong unit is a credibility problem | M |
| Third language by configuration, not by find-and-replace | The translation file is a single TypeScript module; extract to JSON with a locale loader | M |
| Translation completeness check in CI (missing-key build failure) | Prevents "Arabic screens with English fragments" | S |
| RTL audit of PDF/Excel output, not just the UI | Exports are frequently missed | S |
| Fiscal calendar / week start / date-format preferences | Regional accounting expectations | M |
| Data residency choice (Supabase region per tenant) | EU and some GCC buyers require it | M |

## 7. Mobile, offline and field use — P1

| Feature | Why | Effort |
| --- | --- | --- |
| Offline write queue with conflict resolution and visible sync state | The service worker caches reads; queued writes are the hard half | L |
| Camera-first capture: item photos, receipts, damage evidence | Transfer photos exist; item photos do not | M |
| Barcode/QR printing (shelf labels, pallet labels) | Scanning is only as good as its labels | M |
| Native app or installable PWA polish (badging, share-target, shortcuts) | Warehouse staff live on phones | M |
| Signature capture for receipts (built, behind a setting) — enable and document | Already implemented, not turned on | S |
| Voice-guided counting for hands-busy stocktakes | Genuine differentiator in cold/production areas | L |

## 8. Integrations and automation — P1/P2

| Feature | Why | Effort |
| --- | --- | --- |
| Accounting export (QuickBooks / Xero / Zoho) | Stops manual re-entry of every receipt and issue | M |
| Webhooks + a public API with keys | Turns the tool into a platform | M |
| OMS/e-commerce sync hardening (the sync script exists and is fragile) | Orders should drive reservations automatically | M |
| Supplier EDI / email PO dispatch | Removes a manual step | M |
| Slack / WhatsApp / Teams notifications | Alerts are only useful where people already are | S |
| IoT/scale integration for weighbridge receiving | Bulk goods | L |
| Label printer + handheld scanner support | The realistic warehouse hardware | M |

## 9. AI — P1/P2

The OpenRouter proxy already supports text, JSON and vision, so each of these is an
increment rather than new platform work.

| Feature | Why | Effort |
| --- | --- | --- |
| Photo receiving (delivery note → draft receipt to confirm) | Vision is already enabled; the camera path exists | M |
| Arabic/English label OCR to create catalogue entries | Directly addresses the corrupted-name problem at its source | M |
| Supplier price-list import via the existing PDF → JSON path | Refreshes catalogues automatically | M |
| Anomaly review over the ledger (implausible movements, sudden variance) | Would have caught the -2,735 stock and the corrupted names | M |
| Natural-language reporting over the ledger | "What did Habuna consume most of last month?" | M |
| Demand forecasting per item/location | Feeds reorder automation | L |
| Duplicate-product detection at entry time (fuzzy match + suggestion) | Prevents re-creating the 88 duplicates the repair just removed | S |
| Shelf-life optimisation (what to discount/promote first) | Margin protection in food retail | L |

## 10. Reliability, observability and delivery — P0/P1

| Feature | Why | Effort |
| --- | --- | --- |
| Error reporting (Sentry) + failed-mutation visibility | A swallowed database error hid the fact that PO receipts wrote no ledger entry | S |
| Unit tests for paging, permissions, stock guards, PO receipt | The current safety net is `tsc`, a build and a headless smoke test | M |
| End-to-end tests for the four core flows | Receive, transfer, issue, count | M |
| CI: typecheck, tests, build, bundle-budget gate on every push | Nothing currently gates a merge | S |
| Database migrations under version control + a runner | ~30 ad-hoc `.mjs`/`.cjs` scripts sit in the repo root | M |
| Staging environment with seeded data | Nobody tests against production today | M |
| Backups + tested restore + PITR | The repair written this week had to make its own backup because none exists | S |
| Health checks, uptime alerts, audit of failed RPCs | Operational baseline | S |
| Structured logging with request IDs | Debugging a multi-branch incident | S |
| Accessibility pass (WCAG 2.1 AA) | Public-sector and enterprise tenders ask | M |

## 11. Compliance and audit — P0 for enterprise buyers

| Feature | Why | Effort |
| --- | --- | --- |
| Immutable audit log of every write (who, what, when, before/after) | Nothing like this exists; it is the first thing an auditor asks for | M |
| Approval trails with reason codes on adjustments and deletions | Justifying a variance | M |
| Retention policy enforcement (settings exist, enforcement is manual) | Already partly built | S |
| GDPR/PDPA: export and erase a subject's data, DPA, consent records | Required for EU/UK and increasingly GCC public sector | M |
| Food-safety traceability (lot → supplier → customer) | Regulatory in food distribution | L |
| Segregation of duties (receiver cannot approve own PO) | Classic internal-control requirement | M |
| SOC 2 / ISO 27001 readiness pack | Unlocks larger contracts | L |

## 12. Product experience — P2

| Feature | Why | Effort |
| --- | --- | --- |
| Barcode-first keyboard workflow (scan anywhere, no mouse) | Speed is the main reason staff abandon warehouse tools | S |
| Saved views / filter presets per user | Repeatable daily work | S |
| Configurable dashboard (drag widgets, per-role defaults) | Every role wants a different first screen | M |
| Bulk import with a validation preview (CSV/Excel) | Onboarding a new branch's stock today is manual | M |
| Onboarding wizard + in-app guided tour | Reduces training cost per branch | M |
| Realtime presence ("Amal is counting Jawafa now") | Prevents two people double-counting | M |
| Dark mode, reduced motion, density settings | Already largely present; expose density | S |
| Customer-facing stock availability portal | If branches sell to walk-ins | L |

---

## Suggested sequence

**Next 4–6 weeks — close what the audit opened.** Auth + RLS; the `catalog_id`
foreign key; apply `phase7`/`phase8`; cost capture + inventory valuation; reorder
automation; error reporting and unit tests.

**Then 2–3 months — the international kit.** Multi-currency and VAT; timezone and
locale-correct formatting; UoM conversion; Expiry/FEFO; stocktake rollout on the
existing Audits module; guided receiving and issuing; scheduled reports.

**Then — platform and differentiation.** Movement ledger; lot traceability;
three-way match; accounting integration; public API and webhooks; offline write
queue; AI photo receiving and anomaly review; accessibility and compliance packs.

## What to keep

Three things are already better than most tools in this category and should not be
traded away for features:

1. **Bilingual with true RTL**, not a translation layer bolted on.
2. **A coherent design system** (`components/ui`) with one shell, keyboard
   navigation and responsive behaviour down to 390 px.
3. **Offline-capable reads with a real service worker** — most competitors need a
   connection.
