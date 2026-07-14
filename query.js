import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function check() {
  const { data: tx, error: txError } = await supabase.from('transactions').select('*').order('date', {ascending: false}).limit(5);
  console.log("Recent Transactions:", JSON.stringify(tx, null, 2));

  const { data: push, error: pushError } = await supabase.from('push_subscriptions').select('*');
  console.log("Push Subscriptions count:", push?.length);
  if (push?.length > 0) console.log("Push endpoints:", push.map(p => p.endpoint));
}

check();
