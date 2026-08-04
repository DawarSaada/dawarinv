import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanUp() {
  console.log("Deleting all read notifications...");
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('is_read', true);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Successfully deleted read notifications.");
  }
}

cleanUp();
