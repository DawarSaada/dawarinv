import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('suppliers').select('*');
console.log('Suppliers length:', data ? data.length : 0);
console.log('Error:', error);
process.exit(0);
