import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient('https://wmopyqckfwlfeepsappe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtb3B5cWNrZndsZmVlcHNhcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjQ0OTAsImV4cCI6MjA4Njg0MDQ5MH0.uFfsN0PFJgoJv7CiVuhgJUWOobYzUmseEXrW8YKLQhM');

async function testRPC() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1;' });
  console.log(data || error);
}
testRPC();
