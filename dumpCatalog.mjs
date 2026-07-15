import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const invSupabase = createClient('https://wmopyqckfwlfeepsappe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM');

async function dumpCatalog() {
  const { data: catItems } = await invSupabase.from('product_catalog').select('id, name_en, name_ar, category');
  
  let map = {};
  catItems.forEach(c => {
    map[c.id] = {
      ar: c.name_ar,
      en: c.name_en,
      cat: c.category
    };
  });
  
  fs.writeFileSync('catalog_dump.json', JSON.stringify(map, null, 2));
  console.log("Dumped catalog to catalog_dump.json");
}

dumpCatalog();
