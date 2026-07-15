import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCatalog() {
  const { data, error } = await supabase.from('product_catalog').select('*').order('name_en');
  if (error) {
    console.error('Error fetching catalog:', error);
    return;
  }
  
  // Format as markdown table
  let markdown = '# Inventory Product Catalog\n\n';
  markdown += 'This is the complete list of items currently available in the Dawar Saada Inventory Catalog.\n\n';
  markdown += '| Item No | Name (En) | Name (Ar) | Unit | Category |\n';
  markdown += '|---------|-----------|-----------|------|----------|\n';
  
  data.forEach(item => {
    markdown += `| ${item.item_no || '-'} | ${item.name_en || '-'} | ${item.name_ar || '-'} | ${item.unit || '-'} | ${item.category || '-'} |\n`;
  });
  
  const targetDir = 'C:\\Users\\Goku\\.gemini\\antigravity\\brain\\485bf563-5948-4a69-9bc4-5f8ad3b1853d';
  if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const destPath = path.join(targetDir, 'product_catalog.md');
  fs.writeFileSync(destPath, markdown, 'utf8');
  console.log('Catalog items saved to:', destPath);
}

fetchCatalog();
