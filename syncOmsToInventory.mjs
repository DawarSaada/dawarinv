import { createClient } from '@supabase/supabase-js';

const omsSupabase = createClient('https://usjzaxmqdwmgcwpcxicb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzanpheG1xZHdtZ2N3cGN4aWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUwOTMsImV4cCI6MjA4Njc1MTA5M30.1KA1qKdN2lO1oxDzNsFn7B7XpjYlR6mL_9gmqleScSs');
const invSupabase = createClient('https://wmopyqckfwlfeepsappe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM');

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function determineCategory(nameEn, nameAr) {
  const n = (nameEn + ' ' + nameAr).toLowerCase();
  if (/milk|cheese|labneh|yogurt|butter|mozzarella|feta|kiri|halloumi/i.test(n) || /حليب|جبن|لبنة|زبادي|زبدة/.test(n)) return 'Dairy & Cheese';
  if (/chicken|turkey|liver|sinyora/i.test(n) || /دجاج|تركي|كبدة|سنيورة/.test(n)) return 'Meat & Poultry';
  if (/water|juice|coffee|tea|drink|syrup/i.test(n) || /ماء|عصير|قهوة|شاي|مشروب|كرك/.test(n)) return 'Beverages';
  if (/flour|yeast|bread|pie|baking|halva|falafel|shakshouka/i.test(n) || /دقيق|خميرة|خبز|فطيرة|فلافل|شكشوكة|مراهيف|عجين/.test(n)) return 'Bakery & Dough';
  if (/spice|salt|sugar|sauce|paste|dressing|honey|pepper|mint|thyme|ginger|turmeric|cardamom|saffron/i.test(n) || /ملح|سكر|صلصة|معجون|عسل|فلفل|نعناع|زعتر|زنجبيل|كركم|هيل|زعفران/.test(n)) return 'Spices & Condiments';
  if (/box|cup|bag|tin|lid|holder|sticker|packaging|paper|roll/i.test(n) || /بوكس|كوب|كيس|قصدير|غطاء|حامل|استكر|تغليف|ورق|رول/.test(n)) return 'Packaging';
  if (/cleaner|disinfectant|garbage|sponge|soap|freshener/i.test(n) || /منظف|مطهر|نفاية|سفنج|صابون|معطر/.test(n)) return 'Cleaning Supplies';
  if (/glove|mask|cap|pan|spoon|peeler|thermometer|iron|cable/i.test(n) || /قفاز|كمام|طاقية|طاوة|ملعقة|قشارة|ميزان|حديد|سلك|مكنسة/.test(n)) return 'Restaurant Supplies';
  if (/orange|tomato|cucumber|onion|parsley|lettuce|eggplant|potato/i.test(n) || /برتقال|طماطم|خيار|بصل|بقدونس|خس|باذنجان|بطاطس/.test(n)) return 'Produce';
  return 'Groceries';
}

async function runPhase2() {
  console.log("Starting Phase 2: OMS Sync and Formatting...");
  
  // 1. Fetch current catalog and inventory
  const { data: catItems } = await invSupabase.from('product_catalog').select('*');
  const { data: invItems } = await invSupabase.from('inventory_items').select('*');
  
  // 2. Fix formatting and untranslated bugs in Catalog
  const translations = {
    'استكر بر': 'Sticker',
    'تقسيمات بوكس افطار': 'Breakfast Box Dividers',
    'خلية كبير': 'Large Cell',
    'غطاء بوكس افطار': 'Breakfast Box Cover'
  };
  
  console.log("Formatting Catalog to Title Case...");
  for (let cat of catItems) {
    let oldEn = cat.name_en || '';
    let oldAr = cat.name_ar || '';
    let updated = false;
    
    // Fix arabic-only bugs using includes or exact trim match
    for (const [ar, en] of Object.entries(translations)) {
      if (oldAr.trim().includes(ar.trim())) {
        cat.name_en = en;
        updated = true;
      }
    }
    
    // Remove stray arabic chars if they are still in english name
    if (/[\\u0600-\\u06FF]/.test(cat.name_en)) {
       cat.name_en = cat.name_en.replace(/[\\u0600-\\u06FF]/g, '').trim();
       if (!cat.name_en) {
           // Fallback to translation if possible, else generic
           for (const [ar, en] of Object.entries(translations)) {
              if (oldAr.trim().includes(ar.trim())) cat.name_en = en;
           }
           if (!cat.name_en) cat.name_en = "Untitled Item";
       }
       updated = true;
    }
    
    let titleCaseEn = toTitleCase(cat.name_en);
    if (titleCaseEn !== oldEn) {
      cat.name_en = titleCaseEn;
      updated = true;
    }
    
    if (updated) {
      await invSupabase.from('product_catalog').update({ name_en: cat.name_en }).eq('id', cat.id);
    }
  }
  
  console.log("Formatting Inventory Items to Title Case...");
  // Bulk update inventory items
  let invUpdates = [];
  for (let inv of invItems) {
    let updated = false;
    
    for (const [ar, en] of Object.entries(translations)) {
      if ((inv.name_ar || '').trim().includes(ar.trim())) {
        inv.name_en = en;
        updated = true;
      }
    }
    
    if (/[\\u0600-\\u06FF]/.test(inv.name_en)) {
       inv.name_en = inv.name_en.replace(/[\\u0600-\\u06FF]/g, '').trim();
       if (!inv.name_en) {
           for (const [ar, en] of Object.entries(translations)) {
              if ((inv.name_ar || '').trim().includes(ar.trim())) inv.name_en = en;
           }
           if (!inv.name_en) inv.name_en = "Untitled Item";
       }
       updated = true;
    }
    
    let titleCaseEn = toTitleCase(inv.name_en);
    if (titleCaseEn !== inv.name_en) {
      inv.name_en = titleCaseEn;
      updated = true;
    }
    
    if (updated) {
      invUpdates.push({ id: inv.id, name_en: inv.name_en });
    }
  }
  
  // Chunk inventory updates
  for (let upd of invUpdates) {
      await invSupabase.from('inventory_items').update({ name_en: upd.name_en }).eq('id', upd.id);
  }
  console.log(`Updated formatting for ${invUpdates.length} inventory items.`);
  
  // 3. OMS Cross-check and Import
  console.log("Checking OMS missing items...");
  const { data: omsItems } = await omsSupabase.from('items').select('*');
  let newCatalogInserts = [];
  
  omsItems.forEach(oms => {
    let titleOmsEn = toTitleCase(oms.nameEn);
    let match = catItems.find(c => 
      c.name_en.toLowerCase().trim() === oms.nameEn.toLowerCase().trim() ||
      c.name_ar.trim() === oms.nameAr.trim() ||
      c.name_en === titleOmsEn
    );
    
    if (!match) {
      newCatalogInserts.push({
        name_en: titleOmsEn,
        name_ar: oms.nameAr.trim(),
        category: determineCategory(titleOmsEn, oms.nameAr.trim()),
        unit: oms.uom || 'Piece',
        min_threshold: 0,
        default_price: oms.rate || 0
      });
      // push to catItems to prevent duplicate inserts from OMS itself if OMS has dupes
      catItems.push({
         name_en: titleOmsEn,
         name_ar: oms.nameAr.trim()
      });
    }
  });
  
  if (newCatalogInserts.length > 0) {
    const { data: newlyInsertedCat, error } = await invSupabase.from('product_catalog').insert(newCatalogInserts).select('*');
    if (error) {
       console.error("Error inserting to catalog", error);
    } else {
       console.log(`Imported ${newCatalogInserts.length} missing OMS items to product_catalog.`);
       
       // 4. Seed to branches
       console.log("Seeding imported items to all branches...");
       const { data: locations } = await invSupabase.from('locations').select('*');
       let itemsToInsertToBranches = [];
       
       for (let loc of locations) {
         for (let cat of newlyInsertedCat) {
           itemsToInsertToBranches.push({
              location_id: loc.id,
              name_en: cat.name_en,
              name_ar: cat.name_ar,
              category: cat.category,
              quantity: 0,
              unit: cat.unit,
              min_threshold: cat.min_threshold,
              last_updated: new Date().toISOString()
           });
         }
       }
       
       // Chunk inserts
       for (let i = 0; i < itemsToInsertToBranches.length; i += 100) {
         await invSupabase.from('inventory_items').insert(itemsToInsertToBranches.slice(i, i + 100));
       }
       console.log(`Seeded ${itemsToInsertToBranches.length} inventory records across all branches.`);
    }
  } else {
    console.log("No missing items found in OMS.");
  }
  
  console.log("Phase 2 Sync Complete!");
}

runPhase2().catch(console.error);
