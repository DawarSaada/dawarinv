import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to determine category based on name
function determineCategory(nameEn, nameAr) {
  const n = (nameEn + ' ' + nameAr).toLowerCase();
  if (/milk|cheese|labneh|yogurt|butter|mozzarella|feta|kiri|halloumi/i.test(n) || /حليب|جبن|لبنة|زبادي|زبدة/.test(n)) return 'Dairy & Cheese';
  if (/chicken|turkey|liver|sinyora/i.test(n) || /دجاج|تركي|كبدة|سنيورة/.test(n)) return 'Meat & Poultry';
  if (/water|juice|coffee|tea|drink|syrup/i.test(n) || /ماء|عصير|قهوة|شاي|مشروب|كرك/.test(n)) return 'Beverages';
  if (/flour|yeast|bread|pie|baking|halva|falafel|shakshouka/i.test(n) || /دقيق|خميرة|خبز|فطيرة|فلافل|شكشوكة|مراهيف/.test(n)) return 'Bakery & Dough';
  if (/spice|salt|sugar|sauce|paste|dressing|honey|pepper|mint|thyme|ginger|turmeric/i.test(n) || /ملح|سكر|صلصة|معجون|عسل|فلفل|نعناع|زعتر|زنجبيل|كركم/.test(n)) return 'Spices & Condiments';
  if (/box|cup|bag|tin|lid|holder|sticker|packaging|paper|roll/i.test(n) || /بوكس|كوب|كيس|قصدير|غطاء|حامل|استكر|تغليف|ورق|رول/.test(n)) return 'Packaging';
  if (/cleaner|disinfectant|garbage|sponge|soap|freshener/i.test(n) || /منظف|مطهر|نفاية|سفنج|صابون|معطر/.test(n)) return 'Cleaning Supplies';
  if (/glove|mask|cap|pan|spoon|peeler|thermometer|iron|cable/i.test(n) || /قفاز|كمام|طاقية|طاوة|ملعقة|قشارة|ميزان|حديد|سلك|مكنسة/.test(n)) return 'Restaurant Supplies';
  if (/orange|tomato|cucumber|onion/i.test(n) || /برتقال|طماطم|خيار|بصل/.test(n)) return 'Produce';
  return 'Groceries';
}

async function runCleanup() {
  console.log("Starting cleanup process...");
  
  // 1. Fetch catalog
  let { data: catalog, error: catErr } = await supabase.from('product_catalog').select('*');
  if (catErr) throw catErr;
  
  // 2. Delete "Hello"
  const helloItem = catalog.find(c => c.name_en === 'Hello');
  if (helloItem) {
    await supabase.from('product_catalog').delete().eq('id', helloItem.id);
    catalog = catalog.filter(c => c.id !== helloItem.id);
    console.log("Deleted 'Hello' item.");
  }
  
  // 3. Translate missing and Fix Categories
  const translations = {
    'استكر بر': 'Sticker',
    'تقسيمات بوكس افطار': 'Breakfast Box Dividers',
    'خلية كبير': 'Large Cell',
    'غطاء بوكس افطار': 'Breakfast Box Cover'
  };
  
  let canonicalMap = {}; // Lowercase nameEn -> Canonical item
  let itemsToUpdate = [];
  let itemsToDelete = []; // Duplicate IDs
  
  for (let item of catalog) {
    // Translate missing
    if (translations[item.name_ar]) {
      item.name_en = translations[item.name_ar];
    }
    // Remove weird characters if any in english name
    item.name_en = (item.name_en || '').replace(/[\u0600-\u06FF]/g, '').trim() || item.name_ar;
    
    // Determine category
    item.category = determineCategory(item.name_en, item.name_ar);
    
    const key = item.name_en.toLowerCase().trim();
    if (!canonicalMap[key]) {
      canonicalMap[key] = item;
      itemsToUpdate.push({
        id: item.id,
        name_en: item.name_en,
        category: item.category
      });
    } else {
      itemsToDelete.push(item.id);
    }
  }
  
  // Apply catalog updates
  for (const upd of itemsToUpdate) {
    await supabase.from('product_catalog').update({ name_en: upd.name_en, category: upd.category }).eq('id', upd.id);
  }
  console.log(`Updated categories & translations for ${itemsToUpdate.length} canonical catalog items.`);
  
  // Delete catalog duplicates
  if (itemsToDelete.length > 0) {
    // Supabase JS allows max 1000 items in 'in' filter, we are safe (16 items)
    await supabase.from('product_catalog').delete().in('id', itemsToDelete);
    console.log(`Deleted ${itemsToDelete.length} duplicate catalog items.`);
  }
  
  // 4. Update Inventory Items
  console.log("Updating inventory items...");
  const { data: inventory, error: invErr } = await supabase.from('inventory_items').select('*');
  if (invErr) throw invErr;
  
  let locationInventoryMap = {}; // locationId -> Map of canonical nameEn -> existing inventory item
  let invToDelete = [];
  let invToUpdate = [];
  
  for (let inv of inventory) {
    // Find canonical item
    let key = (inv.name_en || '').toLowerCase().trim();
    
    // If not found by English name, try Arabic name
    if (!canonicalMap[key]) {
      let foundByAr = Object.values(canonicalMap).find(c => c.name_ar === inv.name_ar);
      if (foundByAr) {
        key = foundByAr.name_en.toLowerCase().trim();
      }
    }
    
    const canonical = canonicalMap[key];
    if (canonical) {
      if (!locationInventoryMap[inv.location_id]) {
        locationInventoryMap[inv.location_id] = new Map();
      }
      
      const locMap = locationInventoryMap[inv.location_id];
      if (locMap.has(key)) {
        // Duplicate inventory item at the same location!
        const existing = locMap.get(key);
        existing.quantity = Number(existing.quantity) + Number(inv.quantity);
        invToDelete.push(inv.id);
      } else {
        inv.name_en = canonical.name_en;
        inv.name_ar = canonical.name_ar;
        inv.category = canonical.category;
        locMap.set(key, inv);
        invToUpdate.push(inv);
      }
    } else {
      console.log(`Warning: Inventory item not found in catalog: ${inv.name_en} / ${inv.name_ar}`);
    }
  }
  
  // Execute inventory deduplication and updates
  if (invToDelete.length > 0) {
    // chunk deletions
    for (let i = 0; i < invToDelete.length; i += 100) {
      await supabase.from('inventory_items').delete().in('id', invToDelete.slice(i, i + 100));
    }
    console.log(`Merged and deleted ${invToDelete.length} duplicate inventory items.`);
  }
  
  for (let upd of invToUpdate) {
    await supabase.from('inventory_items').update({
      name_en: upd.name_en,
      name_ar: upd.name_ar,
      category: upd.category,
      quantity: upd.quantity
    }).eq('id', upd.id);
  }
  console.log(`Updated metadata for ${invToUpdate.length} inventory items.`);
  
  // 5. Seed missing catalog items to all branches
  console.log("Seeding missing catalog items to branches...");
  const { data: locations } = await supabase.from('locations').select('*');
  let itemsToInsert = [];
  
  const allCanonical = Object.values(canonicalMap);
  
  for (let loc of locations) {
    const locMap = locationInventoryMap[loc.id] || new Map();
    
    for (let canonical of allCanonical) {
      const key = canonical.name_en.toLowerCase().trim();
      if (!locMap.has(key)) {
        itemsToInsert.push({
          location_id: loc.id,
          name_en: canonical.name_en,
          name_ar: canonical.name_ar,
          description: canonical.description,
          category: canonical.category,
          quantity: 0,
          unit: canonical.unit,
          min_threshold: canonical.min_threshold,
          barcode: canonical.barcode,
          last_updated: new Date().toISOString()
        });
      }
    }
  }
  
  if (itemsToInsert.length > 0) {
    for (let i = 0; i < itemsToInsert.length; i += 100) {
       await supabase.from('inventory_items').insert(itemsToInsert.slice(i, i + 100));
    }
    console.log(`Seeded ${itemsToInsert.length} new inventory items across branches.`);
  }
  
  console.log("Cleanup complete!");
}

runCleanup().catch(console.error);
