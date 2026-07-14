import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k,...v] = line.split('=');
  if(k) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("Invoking edge function manually...");
  const { data, error } = await supabase.functions.invoke('push-notifications', {
    body: {
      location_id: 'b02',
      title: 'Test Title',
      body: 'Test Body'
    }
  });
  console.log("Response data:", data);
  if (error) console.error("Response error:", await error.context?.text() || error);
}

check();
