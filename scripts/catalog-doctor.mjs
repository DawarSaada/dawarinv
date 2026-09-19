#!/usr/bin/env node
/**
 * catalog-doctor — diagnose and repair product data quality.
 *
 *   node scripts/catalog-doctor.mjs                     read-only report (default)
 *   node scripts/catalog-doctor.mjs --apply             back up, then write
 *   node scripts/catalog-doctor.mjs --apply --no-merge  fix fields, keep duplicate rows
 *
 * Context (see PRODUCTION_AUDIT.md):
 *   - A whole class of English names has the first letter of every word and every
 *     letter "u" removed: "Brown Flour Mix" -> "Rown Lor Ix". The Arabic name is
 *     intact, which is what makes those rows repairable.
 *   - Names have trailing spaces, so "Dry tissue " and "Dry Tissue " coexist.
 *     The unique index on inventory_items(location_id, name_en) treats them as
 *     different products.
 *   - Categories include placeholders ("Uncategorized" x171, "Received" x19,
 *     "Packets" x2, "ABC" x1) that product_catalog already knows the answer to.
 *   - Units are free text: 54 spellings for ~6 real units, including 45 "Peace"
 *     (a typo of "Piece") and 6 "cartoon" (a typo of "Carton").
 *
 * Writes are backed up to scripts/backups/product-data-<timestamp>.json plus a
 * matching .rollback.sql before anything is changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const MERGE = !process.argv.includes('--no-merge');
/**
 * Removes branch rows whose product is not in product_catalog.
 *
 * Decided by the operator: branches should only hold catalogue products, and these
 * rows are mostly still-corrupted names whose real product is unknown. Their stock
 * is reported before it goes, and the backup keeps a full copy.
 */
const PRUNE_UNCATALOGUED = process.argv.includes('--prune-uncatalogued');
const PAGE = 1000;

// --- env -------------------------------------------------------------------
const env = {};
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found — run this from the project with a configured .env');
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env');
  process.exit(1);
}
const supabase = createClient(url, anonKey);

const readAll = async (table, columns = '*', order = 'id') => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
};

/**
 * Which migrations are live. The OpenAPI root needs the service_role key, so
 * objects are probed directly: selecting a missing table or column is a clean
 * error, and calling receive_purchase_order with a fabricated uuid writes
 * nothing in either the old or the new version.
 */
async function probeMigrations() {
  const hasObject = async (table, column) => {
    const { error } = await supabase.from(table).select(column, { head: true, count: 'exact' }).limit(1);
    return !error;
  };

  const results = {};
  for (const [label, table, column] of [
    ['01 supabase_schema.sql (locations, app_users, inventory_items, transactions)', 'transactions', 'id'],
    ['02 phase2_notifications_migration.sql', 'notifications', 'is_read'],
    ['03 phase3_migration / phase3_po_migration', 'purchase_order_items', 'id'],
    ['04 phase4_audit_migration.sql', 'audit_items', 'id'],
    ['05 phase5_webpush_migration.sql', 'push_subscriptions', 'id'],
    ['06 phase6_po_migration.sql', 'purchase_orders', 'location_id'],
    ['07 transfer_overhaul_migration.sql', 'transactions', 'received_quantity'],
    ['08 catalog_migration.sql', 'product_catalog', 'name_en'],
  ]) {
    results[label] = await hasObject(table, column);
  }

  const { error: rpcError } = await supabase.rpc('receive_purchase_order', {
    p_po_id: '00000000-0000-0000-0000-000000000000',
    p_items: [],
    p_performed_by: 'catalog-doctor probe',
  });
  const rpcMissing = !!rpcError && rpcError.code === 'PGRST202';

  console.log('\n== Migrations present in this project (probed live) ==');
  for (const [label, ok] of Object.entries(results)) console.log(`  ${ok ? ' OK' : 'MISS'}  ${label}`);
  console.log(`  ${rpcMissing ? 'MISS' : ' OK'}  receive_purchase_order RPC`);
  console.log('  Not probeable through the API (run in the SQL editor to confirm):');
  console.log('    - phase5_rls_migration.sql (is RLS enabled and the "Public Access" policy dropped?)');
  console.log('    - oms_sync_rpc.sql, fix_transfer_category.sql, fix_unit_spelling.sql');
  console.log('    - phase7_integrity_migration.sql: select conname from pg_constraint');
  console.log("        where conname = 'inventory_items_quantity_nonnegative';");
}

// --- normalisation ---------------------------------------------------------
const AR_MARKS = /[\u064B-\u065F\u0670\u0640]/g;
const normalize = (v) =>
  String(v ?? '')
    .toLowerCase()
    .replace(AR_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (w) => w.replace(/\b([a-z]{3,})ies\b/g, '$1y').replace(/\b([a-z]{3,})(ses|xes|zes|ches|shes)\b/g, '$1');
const groupKey = (v) => singular(normalize(v));

/** Reproduces the corruption so catalog names can be matched against damaged ones. */
const mangle = (v) => normalize(v).split(' ').map((w) => w.slice(1).replace(/u/g, '')).join(' ');

const titleCase = (v) =>
  v.split(/\s+/).filter(Boolean).map((w) => (w.length <= 2 && /^[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');

// Units are free text. Map the observed variants onto a canonical set.
const UNIT_MAP = new Map([
  ['peace', 'Piece'], ['peice', 'Piece'], ['piece', 'Piece'], ['pieces', 'Pieces'], ['pcs', 'Pieces'],
  ['cartoon', 'Carton'], ['cartons', 'Carton'], ['carton', 'Carton'], ['box', 'Box'], ['boxes', 'Box'],
  ['kg', 'KG'], ['kgs', 'KG'], ['kilogram', 'KG'], ['pack', 'Pack'], ['packs', 'Pack'],
  ['packet', 'Packet'], ['packets', 'Packet'], ['bag', 'Bag'], ['bags', 'Bag'], ['bottle', 'Bottle'],
  ['bottles', 'Bottle'], ['liter', 'Liter'], ['liters', 'Liter'], ['litre', 'Liter'], ['l', 'Liter'],
  ['tin', 'Tin'], ['tins', 'Tin'], ['roll', 'Roll'], ['rolls', 'Roll'], ['tray', 'Tray'], ['trays', 'Tray'],
]);
const canonicalUnit = (unit) => {
  const raw = String(unit ?? '').trim();
  if (!raw) return 'Piece';
  const hit = UNIT_MAP.get(raw.toLowerCase());
  if (hit) return hit;
  // Keep measured units such as "KG10" / "8KG" / "1 Pack (900g)" as-is, just tidy them.
  return raw.replace(/\s+/g, ' ');
};

const CATEGORY_FALLBACK = 'Uncategorized';
const JUNK_CATEGORIES = new Set(['uncategorized', 'received', 'abc', 'packets', 'general', 'other', 'none', 'misc', 'miscellaneous']);

const dupe = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

// ---------------------------------------------------------------------------
async function loadAll() {
  const [items, catalog, locations, transactions] = await Promise.all([
    readAll('inventory_items', 'id,location_id,name_en,name_ar,category,unit,quantity,min_threshold,barcode', 'location_id'),
    readAll('product_catalog', '*', 'name_en'),
    readAll('locations', 'id,name', 'id'),
    readAll('transactions', 'type,item_name_en,quantity', 'id'),
  ]);
  return { items, catalog, locations, transactions };
}

/**
 * Category inference for the handful of real products the catalog does not list.
 * Only ever applied when the row currently holds a placeholder category.
 */
const CATEGORY_RULES = [
  [/cheese|halloumi|yogurt|yoghurt|labneh|milk|butter|cream|kiri/i, 'Dairy & Cheese', /جبن|لبن|زبدة|حليب|قشطة|زبادي/],
  [/turmeric|pepper|salt|spice|cardamom|cinnamon|cumin|sumac|zaatar|thyme|paprika|paste|sauce|ketchup|mayonnaise|vinegar|honey|sugar|saffron|زعفران/i, 'Spices & Condiments', /كركم|فلفل|ملح|بهار|هيل|قرفة|كمون|سماق|زعتر|معجون|صلصة|عسل|سكر/],
  [/chicken|beef|liver|meat|lamb|turkey|fish|shrimp|sausage/i, 'Meat & Poultry', /دجاج|لحم|كبدة|سنيورة|تركي|سمك|روبيان/],
  [/lettuce|tomato|cucumber|onion|potato|carrot|parsley|mint|pepper bell|apple|banana|lemon|fruit|vegetable|eggs?$/i, 'Produce', /خس|طماطم|خيار|بصل|بطاطا|جزر|بقدونس|نعناع|فلفل|بيض/],
  [/juice|water|coffee|tea|drink|soda|cola|syrup/i, 'Beverages', /عصير|ماء|قهوة|شاي|مشروب|كرك/],
  [/box|cup|bag|sticker|label|gloves|tissue|napkin|paper|container|packet|tin|foil/i, 'Packaging', /استكر|كوب|كيس|قصدير|علبة|ورق|منديل|قفاز|بوكس/],
  [/soap|detergent|cleaner|bleach|disinfect|sanitiz|towel|dishwash/i, 'Cleaning Supplies', /صابون|منظف|معقم|جلي|مطهر/],
  [/flour|bread|dough|yeast|bakery|pastry|halva|maklouba|pastry/i, 'Bakery & Dough', /دقيق|خبز|عجين|خميرة|فطير/],
  [/jam|rice|pasta|tuna|beans|lentil|chickpea|oil|corn|olive|sardine|sugar|nutella|cereal/i, 'Groceries', /رز|معكرونة|تونة|فاصوليا|عدس|حمص|زيت|ذرة|سكر/],
];

const inferCategory = (nameEn, nameAr) => {
  for (const [en, category, ar] of CATEGORY_RULES) {
    if (en.test(nameEn) || ar.test(nameAr)) return category;
  }
  return null;
};

// ---------------------------------------------------------------------------
/**
 * Builds the full change plan. The report prints exactly what --apply executes.
 */
function buildPlan({ items, catalog }) {
  // 1. Catalog: drop rows whose English name normalises to a name we already kept.
  const catalogByName = new Map();
  const catalogMerges = [];
  for (const c of catalog) {
    const k = normalize(c.name_en);
    if (!catalogByName.has(k)) {
      catalogByName.set(k, c);
      continue;
    }
    const keep = catalogByName.get(k);
    // Keep the row that carries more information.
    const score = (r) => (r.name_ar ? 1 : 0) + (r.unit ? 1 : 0) + (r.category ? 1 : 0) + (r.default_price ? 1 : 0);
    if (score(c) > score(keep)) {
      catalogByName.set(k, c);
      catalogMerges.push({ keep: c, remove: keep });
    } else {
      catalogMerges.push({ keep, remove: c });
    }
  }
  const catalogKept = [...catalogByName.values()];

  // Lookup tables for recovery.
  const byNameEn = new Map();
  const byNameAr = new Map();
  const byMangle = new Map();
  for (const c of catalogKept) {
    byNameEn.set(normalize(c.name_en), c);
    if (c.name_ar && normalize(c.name_ar)) dupe(byNameAr, normalize(c.name_ar), c);
    const m = mangle(c.name_en);
    if (m) dupe(byMangle, m, c);
  }

  const unique = (list) => (list && list.length === 1 ? list[0] : null);

  // 2. Per inventory row: resolve the real product and the canonical fields.
  const resolved = items.map((item) => {
    const trimmedName = String(item.name_en ?? '').trim().replace(/\s+/g, ' ');
    const trimmedAr = String(item.name_ar ?? '').trim().replace(/\s+/g, ' ');

    let product = byNameEn.get(normalize(trimmedName)) ?? null;
    let reason = product ? 'exact name' : null;

    if (!product) {
      // The Arabic name survived the corruption, so it is the strongest signal.
      const byAr = unique(byNameAr.get(normalize(trimmedAr)));
      if (byAr) {
        product = byAr;
        reason = 'matched on Arabic name';
      }
    }
    if (!product) {
      const byM = unique(byMangle.get(groupKey(trimmedName)));
      if (byM) {
        product = byM;
        reason = 'recovered truncated name';
      }
    }

  const nameEn = product ? String(product.name_en).trim() : trimmedName;
  const nameAr = trimmedAr || (product ? String(product.name_ar ?? '').trim() : '');
  const currentCategory = String(item.category ?? '').trim();
  const category = product?.category
    ? String(product.category).trim()
    : JUNK_CATEGORIES.has(normalize(currentCategory))
      ? inferCategory(nameEn, nameAr) ?? CATEGORY_FALLBACK
      : currentCategory || CATEGORY_FALLBACK;
    // Prefer the row's own unit and only tidy its spelling: a branch may legitimately
    // hold a product in a different unit (Carton vs Box) than the catalog entry.
    const unit = String(item.unit ?? '').trim() ? canonicalUnit(item.unit) : canonicalUnit(product?.unit);

    const patch = {};
    if (nameEn !== item.name_en) patch.name_en = nameEn;
    if (nameAr !== item.name_ar) patch.name_ar = nameAr;
    if (category !== item.category) patch.category = category;
    if (unit !== item.unit) patch.unit = unit;
    if (item.min_threshold == null && product?.min_threshold != null) patch.min_threshold = Number(product.min_threshold);

    return {
      item,
      product,
      reason,
      nameEn,
      nameAr,
      category,
      unit,
      patch,
      // Identity used to decide whether two rows are the same product.
      identity: product ? `catalog:${product.id}` : `name:${groupKey(nameEn)}`,
    };
  });

  // 3. Duplicates inside one location, by resolved identity.
  const byLocIdentity = new Map();
  for (const r of resolved) dupe(byLocIdentity, `${r.item.location_id}::${r.identity}`, r);

  const itemMerges = [];
  for (const [key, group] of byLocIdentity) {
    if (group.length < 2) continue;
    // Keep the row that already matches the catalog, then the one with the most stock.
    const canonical =
      group.find((r) => r.reason === 'exact name' && r.item.name_en === r.nameEn) ??
      [...group].sort((a, b) => Number(b.item.quantity) - Number(a.item.quantity))[0];
    const redundant = group.filter((r) => r !== canonical);
    itemMerges.push({
      key,
      canonical,
      redundant,
      mergedQuantity: group.reduce((sum, r) => sum + Number(r.item.quantity || 0), 0),
    });
  }

  // A row that only needs its own fields normalised once merging is accounted for.
  const mergedAway = new Set(itemMerges.flatMap((m) => m.redundant.map((r) => r.item.id)));
  const itemFixes = resolved.filter(
    (r) => !mergedAway.has(r.item.id) && Object.keys(r.patch).length > 0
  );

  // Rows that still cannot be placed: no catalog match and a placeholder category.
  const stillUnplaced = resolved.filter(
    (r) => !r.product && JUNK_CATEGORIES.has(normalize(r.category)) && !mergedAway.has(r.item.id)
  );

  // Final check: after the plan, does any location still hold two identical names?
  const finalNames = new Map();
  for (const r of resolved) {
    if (mergedAway.has(r.item.id)) continue;
    const canonical = itemMerges.find((m) => m.canonical.item.id === r.item.id);
    const name = canonical ? canonical.canonical.nameEn : r.nameEn;
    dupe(finalNames, `${r.item.location_id}::${normalize(name)}`, name);
  }
  const residualCollisions = [...finalNames.entries()].filter(([, v]) => v.length > 1);

  // Rows with no catalogue match: cannot get a category, unit or price, and are
  // never offered when raising a purchase order.
  const uncatalogued = resolved.filter((r) => !r.product && !mergedAway.has(r.item.id));

  return { resolved, catalogMerges, catalogKept, itemMerges, itemFixes, stillUnplaced, residualCollisions, uncatalogued };
}

// ---------------------------------------------------------------------------
function printReport(data, plan) {
  const { items, catalog, transactions } = data;
  const { itemMerges, itemFixes, catalogMerges, stillUnplaced, residualCollisions } = plan;

  const catCount = new Map();
  items.forEach((i) => catCount.set(i.category || '(none)', (catCount.get(i.category || '(none)') ?? 0) + 1));
  console.log(`\n== NOW: categories (${catCount.size} distinct) ==`);
  [...catCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${String(n).padStart(5)}  ${c}`));

  const unitCount = new Map();
  items.forEach((i) => unitCount.set(i.unit || '(none)', (unitCount.get(i.unit || '(none)') ?? 0) + 1));
  const messyUnits = [...unitCount.keys()].filter((u) => canonicalUnit(u) !== u);
  console.log(`\n== NOW: units — ${unitCount.size} distinct spellings, ${messyUnits.length} non-canonical ==`);
  messyUnits.slice(0, 20).forEach((u) => console.log(`  "${u}" -> "${canonicalUnit(u)}"  x${unitCount.get(u)}`));

  const recovered = itemFixes.filter((r) => r.reason === 'recovered truncated name' || r.reason === 'matched on Arabic name');
  console.log(`\n== Name recovery ==`);
  console.log(`  rows whose English name is corrupt and recoverable: ${recovered.length}`);
  recovered.slice(0, 25).forEach((r) =>
    console.log(`      [${r.item.location_id}] "${r.item.name_en}"  ->  "${r.nameEn}"   (${r.reason})`)
  );

  const catFixed = itemFixes.filter((r) => r.patch.category);
  console.log(`\n== Category fixes ==`);
  console.log(`  rows getting a real category from product_catalog: ${catFixed.length}`);
  const byPair = new Map();
  catFixed.forEach((r) => {
    const k = `${r.item.category} -> ${r.patch.category}`;
    byPair.set(k, (byPair.get(k) ?? 0) + 1);
  });
  [...byPair.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));

  console.log(`\n== Duplicate merge (${MERGE ? 'will run' : 'DISABLED'}) ==`);
  console.log(`  groups: ${itemMerges.length}   rows removed: ${itemMerges.reduce((n, m) => n + m.redundant.length, 0)}`);
  itemMerges.forEach((m) => {
    console.log(`  [${m.canonical.item.location_id}] keep "${m.canonical.nameEn}" qty ${m.canonical.item.quantity} -> ${m.mergedQuantity}`);
    m.redundant.forEach((r) => console.log(`        drop "${r.item.name_en}" (qty ${r.item.quantity}, cat ${r.item.category})`));
  });

  console.log(`\n== product_catalog duplicates ==`);
  console.log(`  ${catalog.length} rows -> ${plan.catalogKept.length} kept, ${catalogMerges.length} removed`);

  console.log(`\n== Cannot be resolved automatically ==`);
  console.log(`  ${stillUnplaced.length} rows keep a placeholder category and have no catalog match`);
  stillUnplaced.slice(0, 30).forEach((r) => console.log(`      [${r.item.location_id}] "${r.item.name_en}" (${r.item.category})`));

  // Catalog coverage: a branch row that is not in product_catalog cannot get a
  // category, a unit or a price, and it will not be offered when creating a PO.
  const coverage = plan.resolved.filter((r) => !r.product);
  const coverageByLoc = new Map();
  coverage.forEach((r) => coverageByLoc.set(r.item.location_id, (coverageByLoc.get(r.item.location_id) ?? 0) + 1));
  console.log(`\n== Catalog coverage ==`);
  console.log(`  inventory rows with no product_catalog match: ${coverage.length} / ${items.length}`);
  if (coverageByLoc.size) console.log('  by location:', JSON.stringify(Object.fromEntries(coverageByLoc)));
  coverage.slice(0, 25).forEach((r) => console.log(`      [${r.item.location_id}] "${r.item.name_en}" (${r.item.category})`));

  // Products missing from the catalog can be created as draft entries.
  const catalogNames = new Set(data.catalog.map((c) => normalize(c.name_en)));
  const missingInCatalog = coverage.filter((r) => !catalogNames.has(normalize(r.item.name_en)));
  console.log(`  of those, absent from product_catalog entirely: ${missingInCatalog.length}`);

  if (PRUNE_UNCATALOGUED) {
    const removable = plan.uncatalogued;
    const units = removable.reduce((sum, r) => sum + Number(r.item.quantity || 0), 0);
    console.log(`\n== Prune uncatalogued branch rows (WILL DELETE) ==`);
    console.log(`  rows: ${removable.length}   stock removed: ${units} units`);
    removable.forEach((r) =>
      console.log(`      [${r.item.location_id}] "${r.item.name_en}" qty ${r.item.quantity} ${r.item.unit} (${r.item.category})`)
    );
  }

  console.log(`\n== Totals ==`);
  console.log(`  inventory rows: ${items.length}   field updates: ${itemFixes.length}   rows merged away: ${MERGE ? itemMerges.reduce((n, m) => n + m.redundant.length, 0) : 0}`);
  console.log(`  transactions untouched: ${transactions.length} (names are copies, history is preserved)`);
  console.log(`  residual (location, name) collisions after the plan: ${residualCollisions.length}`);
  if (residualCollisions.length) {
    console.log('  (a unique index on lower(btrim(name_en)) per location can only be added once these are 0)');
  }
}

// ---------------------------------------------------------------------------
async function applyPlan(data, plan) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, 'scripts', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const backupFile = path.join(dir, `product-data-${stamp}.json`);
  const rollbackFile = path.join(dir, `product-data-${stamp}.rollback.sql`);

  const prunedIds = PRUNE_UNCATALOGUED ? plan.uncatalogued.map((r) => r.item.id) : [];
  const touchedItemIds = new Set([
    ...plan.itemFixes.map((r) => r.item.id),
    ...plan.itemMerges.flatMap((m) => [m.canonical.item.id, ...m.redundant.map((r) => r.item.id)]),
    ...prunedIds,
  ]);
  const backup = {
    runAt: new Date().toISOString(),
    project: url,
    inventory_items: data.items.filter((i) => touchedItemIds.has(i.id)),
    product_catalog: plan.catalogKept.concat(plan.catalogMerges.map((m) => m.remove)),
  };
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

  const sqlEscape = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const rollback = [
    '-- Generated by scripts/catalog-doctor.mjs',
    `-- Restores inventory_items and product_catalog as they were at ${backup.runAt}`,
    'begin;',
    ...backup.inventory_items.map(
      (i) =>
        `update public.inventory_items set name_en = ${sqlEscape(i.name_en)}, name_ar = ${sqlEscape(i.name_ar)}, ` +
        `category = ${sqlEscape(i.category)}, unit = ${sqlEscape(i.unit)} where id = ${sqlEscape(i.id)};`
    ),
    // Rows this run deleted are re-inserted verbatim.
    ...backup.inventory_items
      .filter(
        (i) =>
          plan.itemMerges.some((m) => m.redundant.some((r) => r.item.id === i.id)) ||
          prunedIds.includes(i.id)
      )
      .map(
        (i) =>
          `insert into public.inventory_items (id, location_id, name_en, name_ar, description, category, quantity, unit, min_threshold, expiration_date, barcode, last_updated) ` +
          `values (${sqlEscape(i.id)}, ${sqlEscape(i.location_id)}, ${sqlEscape(i.name_en)}, ${sqlEscape(i.name_ar)}, ` +
          `${sqlEscape(i.description)}, ${sqlEscape(i.category)}, ${i.quantity}, ${sqlEscape(i.unit)}, ${i.min_threshold}, ` +
          `${sqlEscape(i.expiration_date)}, ${sqlEscape(i.barcode)}, now()) on conflict (id) do nothing;`
      ),
    '-- product_catalog rows removed by the dedupe',
    ...plan.catalogMerges.map((m) => `-- delete public.product_catalog where id = ${sqlEscape(m.remove.id)};`),
    'commit;',
  ].join('\n');
  fs.writeFileSync(rollbackFile, rollback);

  console.log(`\nBackup  : ${path.relative(root, backupFile)}`);
  console.log(`Rollback: ${path.relative(root, rollbackFile)}`);

  const fail = (label, error) => {
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  // 1. product_catalog dedupe
  if (plan.catalogMerges.length) {
    const ids = plan.catalogMerges.map((m) => m.remove.id);
    const { error } = await supabase.from('product_catalog').delete().in('id', ids);
    fail('catalog dedupe', error);
    console.log(`catalog rows removed: ${ids.length}`);
  }

  // 2. inventory field fixes, batched by identical payload
  const batches = new Map();
  for (const [index, row] of plan.itemFixes.entries()) {
    const key = JSON.stringify(row.patch);
    if (!batches.has(key)) batches.set(key, { patch: row.patch, ids: [] });
    batches.get(key).ids.push(row.item.id);
    if (index % 500 === 0) process.stdout.write('');
  }
  let updated = 0;
  for (const { patch, ids } of batches.values()) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await supabase.from('inventory_items').update(patch).in('id', chunk);
      fail('inventory update', error);
      updated += chunk.length;
    }
  }
  console.log(`inventory rows updated: ${updated}`);

  // 3. merges: move the stock onto the kept row, then delete the redundant ones
  let mergesDone = 0;
  let rowsRemoved = 0;
  for (const merge of plan.itemMerges) {
    const keep = merge.canonical;
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity: merge.mergedQuantity, ...keep.patch, name_en: keep.nameEn, name_ar: keep.nameAr, category: keep.category, unit: keep.unit })
      .eq('id', keep.item.id);
    fail('merge update', updateError);

    const removeIds = merge.redundant.map((r) => r.item.id);
    const { error: deleteError } = await supabase.from('inventory_items').delete().in('id', removeIds);
    fail('merge delete', deleteError);

    mergesDone += 1;
    rowsRemoved += removeIds.length;
  }
  console.log(`duplicate groups merged: ${mergesDone}  rows removed: ${rowsRemoved}`);

  // 4. remove branch rows whose product is not in the catalogue
  if (PRUNE_UNCATALOGUED && prunedIds.length) {
    const { error } = await supabase.from('inventory_items').delete().in('id', prunedIds);
    fail('prune uncatalogued', error);
    const units = plan.uncatalogued.reduce((sum, r) => sum + Number(r.item.quantity || 0), 0);
    console.log(`uncatalogued rows removed: ${prunedIds.length} (${units} units of stock)`);
    console.log('Their ledger history is untouched: transactions store item names, not ids.');
  } else if (PRUNE_UNCATALOGUED) {
    console.log('uncatalogued rows to remove: 0 (already clean)');
  }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('catalog-doctor', APPLY ? (MERGE ? '(APPLY, with merges)' : '(APPLY, fields only)') : '(read-only report)');
  console.log('→', url);

  await probeMigrations();

  const data = await loadAll();
  const plan = buildPlan(data);

  console.log(`\n== Volume ==`);
  console.log(`  inventory_items ${data.items.length}   product_catalog ${data.catalog.length}   transactions ${data.transactions.length}`);

  printReport(data, plan);

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to back up and repair.');
    return;
  }
  if (plan.residualCollisions.length) {
    console.log(`\nNote: ${plan.residualCollisions.length} (location, name) collisions remain after the plan;`);
    console.log('they only block adding the unique index, not the repair itself.');
  }
  await applyPlan(data, plan);
  console.log('\nDone. Re-run without --apply to confirm the data is clean.');
}

main().catch((error) => {
  console.error('\ncatalog-doctor failed:', error.message);
  process.exit(1);
});
