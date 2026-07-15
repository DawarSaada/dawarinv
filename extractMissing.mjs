import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function extractMissing() {
  const { data: catalog } = await supabase.from('product_catalog').select('*');
  let missing = [];
  catalog.forEach(c => {
    if (!c.name_en || /[\u0600-\u06FF]/.test(c.name_en) || c.name_en === c.name_ar) missing.push(c);
  });
  
  fs.writeFileSync('missing_translations.json', JSON.stringify(missing, null, 2));
  console.log("Missing translations saved");
}
extractMissing();
