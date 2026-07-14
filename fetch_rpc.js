import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Query to get function definition in postgres
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT pg_get_functiondef(oid)
      FROM pg_proc
      WHERE proname = 'receive_purchase_order';
    `
  });
  
  if (error) {
    console.log("No exec_sql RPC, let me try something else.");
  } else {
    console.log(data);
  }
}
run();
