/**
 * Migration cross-check — read-only.
 *
 *   node scripts/migration-doctor.mjs
 *
 * Answers "which migrations are already applied?" from a terminal, using only the
 * public REST API. Three kinds of evidence, strongest first:
 *
 *  1. Objects   — tables and columns are probed with a zero-row `select`.
 *  2. Behaviour — functions are probed with calls engineered to be incapable of
 *                 writing a row: an empty array, zero months, or an id that matches
 *                 nothing. The error text is the evidence (a missing function
 *                 answers PGRST202, a version mismatch answers its own message).
 *  3. Data      — some migrations leave a fingerprint no schema probe can see:
 *                 phase7 clamps negative stock, so a negative row proves it has not
 *                 run; phase8 forbids untrimmed names, so one proves the same.
 *
 * Two limits worth knowing. Nothing here can see triggers, constraints or RLS
 * policies — the anon key cannot read pg_catalog. Where that matters the row says
 * so and points at migration-check.sql, which reads the catalog directly from the
 * SQL editor. And a GET on /rpc/<name> cannot detect a function at all (it answers
 * 404 for existing and missing alike), so this script does not use one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const NIL = '00000000-0000-0000-0000-000000000000';

const get = async (q) => {
  const res = await fetch(`${url}/rest/v1/${q}`, { headers: H });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
};

const rpc = async (fn, args = {}) => {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
};

const readAll = async (table, cols) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { status, body } = await get(`${table}?select=${cols}&limit=1000&offset=${from}`);
    if (status >= 300) throw new Error(`${table}: ${JSON.stringify(body)}`);
    out.push(...(body ?? []));
    if ((body ?? []).length < 1000) return out;
  }
};

/** True when the column (or table.column) can be selected. */
const hasColumn = async (table, column) => (await get(`${table}?select=${column}&limit=1`)).status < 300;

const msg = (r) =>
  typeof r.body === 'object'
    ? String(r.body?.message ?? r.body?.details ?? JSON.stringify(r.body))
    : String(r.body);
// PostgREST answers PGRST202 for a function it does not know. `code` is the reliable
// signal: the message does not contain that string.
const missing = (r) => r.body?.code === 'PGRST202';
const exists = (r) => !missing(r);

const line = (label, ok, detail = '') =>
  console.log(`  ${ok === true ? 'APPLIED' : ok === false ? '  MISS ' : '  ??   '} ${label}${detail ? `  — ${detail}` : ''}`);

console.log(`project: ${url}`);
console.log('(triggers, constraints and RLS policies are invisible here — see migration-check.sql)\n');

// ---------------------------------------------------------------- objects
console.log('== Tables and columns ==');
const objects = [
  ['supabase_schema: inventory_items/transactions/app_users/locations', 'transactions', 'id'],
  ['phase2_notifications: notifications.is_read', 'notifications', 'is_read'],
  ['phase3_po: purchase_orders', 'purchase_orders', 'id'],
  ['phase3_po: purchase_order_items', 'purchase_order_items', 'id'],
  ['phase4_audit: audits + audit_items', 'audit_items', 'id'],
  ['phase5_webpush: push_subscriptions', 'push_subscriptions', 'id'],
  ['phase6_po: purchase_orders.location_id', 'purchase_orders', 'location_id'],
  ['transfer_overhaul: transactions.transfer_group_id', 'transactions', 'transfer_group_id'],
  ['transfer_overhaul: transactions.received_quantity', 'transactions', 'received_quantity'],
  ['transfer_overhaul: transactions.signature_url', 'transactions', 'signature_url'],
  ['transfer_overhaul: transactions.photo_urls', 'transactions', 'photo_urls'],
  ['catalog_migration: product_catalog.min_threshold', 'product_catalog', 'min_threshold'],
  ['supplier_items: suppliers.supplied_items', 'suppliers', 'supplied_items'],
  ['catalog default_price: product_catalog.default_price', 'product_catalog', 'default_price'],
  ['phase10: app_settings', 'app_settings', 'value'],
  ['phase10: app_settings.updated_by', 'app_settings', 'updated_by'],
];
for (const [label, table, column] of objects) line(label, await hasColumn(table, column));

// ---------------------------------------------------------------- behaviour
console.log('\n== Functions, probed by behaviour (none of these can write) ==');
const probes = [
  // label, promise, verdict(r)
  ['migration.sql/phase5: execute_cleanup_transactions(p_months=0)', rpc('execute_cleanup_transactions', { p_months: 0 }), exists],
  ['migration.sql/phase5: execute_delete_items([])', rpc('execute_delete_items', { p_item_ids: [] }), exists],
  ['migration.sql/phase5: execute_bulk_edit_items([],{})', rpc('execute_bulk_edit_items', { p_item_ids: [], p_updates: {} }), exists],
  ['migration.sql: execute_transfer family', rpc('confirm_source_transfer', { p_transaction_id: NIL }), (r) => /Transaction not found/.test(msg(r))],
  ['transfer_overhaul: receive_transfer_group', rpc('receive_transfer_group', { p_transfer_group_id: 'probe-none', p_items: [] }), exists],
  ['transfer_overhaul: confirm_transfer_group', rpc('confirm_transfer_group', { p_transfer_group_id: 'probe-none' }), exists],
  ['transfer_overhaul: reject_transfer_group', rpc('reject_transfer_group', { p_transfer_group_id: 'probe-none', p_reason: 'probe' }), exists],
  // 36500 days puts the cutoff a century back, so no transfer can qualify.
  ['transfer_overhaul: auto_reject_expired_transfers(36500)', rpc('auto_reject_expired_transfers', { p_days: 36500 }), exists],
  ['phase4: apply_audit_variances', rpc('apply_audit_variances', { p_audit_id: NIL, p_performed_by: 'probe' }), (r) => /Audit not found/.test(msg(r))],
  // phase9 only adds these three; all are read-only.
  ['phase9: can_edit_location', rpc('can_edit_location', { p_actor: 'admin', p_location: 'b01' }), exists],
  ['phase9: can_read_location', rpc('can_read_location', { p_actor: 'admin', p_location: 'b01' }), exists],
  ['phase9: app_user_access', rpc('app_user_access', { p_actor: 'admin' }), exists],
];

for (const [label, promise, verdict] of probes) {
  const r = await promise;
  const ok = verdict(r);
  line(label, ok);
  // Show the server's own words when it refused — that is the evidence.
  if (!ok && r.status >= 400) console.log(`           ${r.status}  ${msg(r).slice(0, 90)}`);
}

// ------------------------------------------------- phase7 vs phase3_po discriminator
console.log('\n== Which receive_purchase_order is installed? ==');
{
  const r = await rpc('receive_purchase_order', { p_po_id: NIL, p_items: [], p_performed_by: 'probe' });
  // phase7 refuses an unknown id up front; the phase3_po version falls through and no-ops.
  const isPhase7 = /not found/.test(msg(r));
  line(
    'phase7: receive_purchase_order credits the PO location',
    isPhase7,
    isPhase7 ? 'refuses an unknown id' : 'the older version is installed (silently no-ops)'
  );
}

// ------------------------------------------------- phase11: the add/edit blocker
console.log('\n== phase11: can add and edit actually work? ==');
{
  const add = await rpc('execute_add_item', {
    p_location_id: 'no-such-location-probe', // the foreign key rejects this, so nothing is written
    p_name_en: 'Probe', p_name_ar: '', p_description: '', p_category: 'Probe',
    p_quantity: 0, p_unit: 'piece', p_min_threshold: 0, p_expiration_date: null, p_barcode: null,
  });
  const broken = /42804|is of type date but expression is of type text/.test(msg(add));
  line('execute_add_item / execute_edit_item usable', !broken,
    broken ? 'BOTH FAIL for every payload — run phase11_item_date_fix.sql' : 'calls reach the real logic');
  if (!broken) console.log(`           ${add.status}  ${msg(add).slice(0, 90)}`);
}

// ---------------------------------------------------------------- fingerprints
console.log('\n== Data fingerprints (prove a migration has NOT run) ==');
const items = await readAll('inventory_items', 'id,location_id,name_en,name_ar,quantity,unit,category,min_threshold');
const negatives = items.filter((i) => Number(i.quantity) < 0);
line('phase7: no negative stock', negatives.length === 0, `${negatives.length} row(s) negative`);
if (negatives.length)
  console.log(`           e.g. ${negatives.slice(0, 3).map((i) => `${i.location_id}/${i.name_en}=${i.quantity}`).join(', ')}`);

const groups = new Map();
for (const i of items) {
  const k = `${i.location_id}|${String(i.name_en).trim().toLowerCase()}`;
  groups.set(k, (groups.get(k) ?? 0) + 1);
}
const dupes = [...groups.values()].filter((n) => n > 1).length;
line('phase8 precondition: no duplicate (location, name)', dupes === 0, `${dupes} duplicate group(s) — run catalog-doctor --apply`);

const untrimmed = items.filter((i) => String(i.name_en) !== String(i.name_en).trim()).length;
line('phase8 fingerprint: names trimmed', untrimmed === 0, `${untrimmed} untrimmed`);

const peace = items.filter((i) => String(i.unit).toLowerCase() === 'peace').length;
line('fix_unit_spelling: no "peace" unit', peace === 0, `${peace} row(s); distinct units: ${new Set(items.map((i) => i.unit)).size}`);

const placeholders = items.filter((i) => ['Uncategorized', 'Received', 'Packets', 'ABC'].includes(i.category)).length;
line('catalog-doctor: no placeholder categories', placeholders === 0, `${placeholders} row(s)`);

// ---------------------------------------------------------------- settings detail
console.log('\n== app_settings ==');
{
  const { status, body } = await get('app_settings?select=*');
  if (status >= 300) console.log(`  unreadable: ${JSON.stringify(body).slice(0, 120)}`);
  else {
    console.log(`  rows: ${body.length}   columns: ${Object.keys(body[0] ?? {}).join(', ')}`);
    for (const row of body)
      console.log(`     ${row.key} = ${String(typeof row.value === 'object' ? JSON.stringify(row.value) : row.value).slice(0, 70)}`);
    const missing = ['currency', 'retention_months', 'transfer_settings'].filter((k) => !body.some((r) => r.key === k));
    if (missing.length) console.log(`  phase10 seeds absent: ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------- counts
console.log('\n== Row counts ==');
for (const t of ['locations', 'app_users', 'inventory_items', 'transactions', 'product_catalog', 'suppliers', 'purchase_orders', 'purchase_order_items', 'notifications', 'audits', 'audit_items', 'push_subscriptions']) {
  const { status, body } = await get(`${t}?select=id&limit=1`);
  if (status >= 300) {
    console.log(`  ${t.padEnd(22)} MISSING`);
    continue;
  }
  const res = await fetch(`${url}/rest/v1/${t}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  console.log(`  ${t.padEnd(22)} ${res.headers.get('content-range')?.split('/')[1] ?? '?'}`);
  void body;
}
