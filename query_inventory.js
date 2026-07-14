import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'dummy'
);

async function run() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .limit(1);
    
  console.log(error || data);
}

run();
