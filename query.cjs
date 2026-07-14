require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: tx } = await supabase.from('transactions').select('*').order('date', {ascending: false}).limit(5);
  console.log("Recent Transactions:", JSON.stringify(tx, null, 2));

  const { data: push } = await supabase.from('push_subscriptions').select('*');
  console.log("Push Subscriptions count:", push?.length);
}

check();
