import { createClient } from '@supabase/supabase-js';

const omsSupabase = createClient('https://usjzaxmqdwmgcwpcxicb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzanpheG1xZHdtZ2N3cGN4aWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUwOTMsImV4cCI6MjA4Njc1MTA5M30.1KA1qKdN2lO1oxDzNsFn7B7XpjYlR6mL_9gmqleScSs');
const invSupabase = createClient('https://wmopyqckfwlfeepsappe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM');

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

async function run() {
  console.log("Fetching OMS items...");
  const { data: omsItems } = await omsSupabase.from('items').select('*');
  
  console.log("Fetching Inventory catalog and items...");
  const { data: catItems } = await invSupabase.from('product_catalog').select('*');
  const { data: invItems } = await invSupabase.from('inventory_items').select('*');
  const { data: locations } = await invSupabase.from('locations').select('*');

  let updatedCount = 0;
  let insertedCount = 0;

  for (const oms of omsItems) {
    const omsEn = oms.nameEn.trim();
    const omsAr = oms.nameAr.trim();
    const omsUnit = oms.uom || 'Piece';
    const omsRate = oms.rate || 0;

    let matchCat = catItems.find(c => 
      c.name_ar.trim() === omsAr || 
      c.name_en.toLowerCase().trim() === omsEn.toLowerCase()
    );

    if (matchCat) {
      if (matchCat.name_en !== omsEn || matchCat.name_ar !== omsAr || matchCat.unit !== omsUnit || matchCat.default_price !== omsRate) {
        await invSupabase.from('product_catalog').update({
          name_en: omsEn,
          name_ar: omsAr,
          unit: omsUnit,
          default_price: omsRate
        }).eq('id', matchCat.id);

        const matchingInvItems = invItems.filter(i => 
          i.name_ar.trim() === matchCat.name_ar.trim() || 
          i.name_en.toLowerCase().trim() === matchCat.name_en.toLowerCase().trim()
        );
        for (const iItem of matchingInvItems) {
          await invSupabase.from('inventory_items').update({
            name_en: omsEn,
            name_ar: omsAr,
            unit: omsUnit
          }).eq('id', iItem.id);
        }
        updatedCount++;
        console.log(`Updated existing item: ${omsEn}`);
      }
    } else {
      console.log(`Inserting new item: ${omsEn}`);
      const category = determineCategory(omsEn, omsAr);
      const { data: newCat, error } = await invSupabase.from('product_catalog').insert({
        name_en: omsEn,
        name_ar: omsAr,
        category: category,
        unit: omsUnit,
        default_price: omsRate,
        min_threshold: 0
      }).select('*').single();

      if (error) {
        console.error("Error inserting catalog", error);
        continue;
      }

      insertedCount++;

      const seedItems = locations.map(loc => ({
        location_id: loc.id,
        name_en: omsEn,
        name_ar: omsAr,
        category: category,
        quantity: 0,
        unit: omsUnit,
        min_threshold: 0,
        last_updated: new Date().toISOString()
      }));

      for (let i = 0; i < seedItems.length; i += 50) {
        await invSupabase.from('inventory_items').insert(seedItems.slice(i, i + 50));
      }
    }
  }

  console.log(`Sync complete! Updated: ${updatedCount}, Inserted: ${insertedCount}`);
}

run().catch(console.error);
