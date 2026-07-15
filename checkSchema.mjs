import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: inv } = await supabase.from('inventory_items').select('id, name_en').limit(5);
  console.log("Inventory samples:");
  
  for (let item of inv) {
    const { data: cat } = await supabase.from('product_catalog').select('id, name_en').eq('name_en', item.name_en).single();
    console.log(`Inv item '${item.name_en}' ID: ${item.id}`);
    if (cat) {
      console.log(`Cat item '${cat.name_en}' ID: ${cat.id}`);
      console.log(`IDs match? ${item.id === cat.id}`);
    } else {
      console.log("Not found in catalog by name");
    }
  }
}

checkSchema();
