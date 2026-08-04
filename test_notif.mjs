import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Apps/dawarsaada-inventory/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const { data: n, error: e1 } = await supabase.from('notifications').select('*').eq('is_read', false).limit(1);
  console.log("Unread notifications:", n);
  
  if (n && n.length > 0) {
    const locId = n[0].location_id;
    console.log("Updating for location:", locId);
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('location_id', locId)
      .eq('is_read', false)
      .select();
      
    console.log("Updated data:", data);
    console.log("Update error:", error);
  }
}

test();
