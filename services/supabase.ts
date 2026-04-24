import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wmopyqckfwlfeepsappe.supabase.co';
const supabaseKey = 'sb_publishable_kvWaDNub2GJKx45xv0ol_Q_VbP4FfZF';

export const supabase = createClient(supabaseUrl, supabaseKey);