import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const { data: catalog } = await supabase.from('product_catalog').select('*');
  const { data: inventory } = await supabase.from('inventory_items').select('*');
  const { data: locations } = await supabase.from('locations').select('*');
  
  let missingEn = [];
  let missingAr = [];
  let weirdCategories = new Set();
  let nameCounts = {};
  
  catalog.forEach(c => {
    if (!c.name_en || /[\u0600-\u06FF]/.test(c.name_en) || c.name_en === c.name_ar) missingEn.push(c);
    if (!c.name_ar) missingAr.push(c);
    
    let key = (c.name_en || '').toLowerCase().trim();
    nameCounts[key] = (nameCounts[key] || 0) + 1;
    
    if (['Received', 'Produce', 'ABC', 'Packets', 'اغراض مطعم', 'اغراض مستودع'].includes(c.category)) {
      weirdCategories.add(c.category);
    }
  });
  
  let duplicates = Object.keys(nameCounts).filter(k => nameCounts[k] > 1 && k !== '');
  
  // Check inventory presence
  let totalCatalogItems = catalog.length;
  let locCount = locations.length;
  let invByLoc = {};
  
  inventory.forEach(inv => {
    if (!invByLoc[inv.location_id]) invByLoc[inv.location_id] = new Set();
    invByLoc[inv.location_id].add(inv.name_en?.toLowerCase() || inv.name_ar);
  });
  
  console.log("=== CATALOG ANALYSIS ===");
  console.log(`Total items in catalog: ${totalCatalogItems}`);
  console.log(`Items with missing or Arabic-only English names: ${missingEn.length}`);
  console.log(`Items with missing Arabic names: ${missingAr.length}`);
  console.log(`Duplicates detected (by En name): ${duplicates.length}`);
  console.log(`Strange categories found: ${Array.from(weirdCategories).join(', ')}`);
  
  console.log("\\n=== INVENTORY DISTRIBUTION ===");
  locations.forEach(loc => {
    let itemsInLoc = invByLoc[loc.id] ? invByLoc[loc.id].size : 0;
    console.log(`${loc.name_en}: ${itemsInLoc} / ${totalCatalogItems} catalog items present.`);
  });
}

analyze();
