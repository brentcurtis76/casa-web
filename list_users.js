// List all users in the project
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listUsers() {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error listing users:', error);
      return;
    }

    console.log(`\nFound ${data.users.length} users:\n`);

    // Find brent's email
    const brentUser = data.users.find(u => u.email?.includes('brent'));

    if (brentUser) {
      console.log('✅ Found Brent Curtis:');
      console.log('  Email:', brentUser.email);
      console.log('  ID:', brentUser.id);
      console.log('  Created:', brentUser.created_at);
    } else {
      console.log('❌ No user with "brent" in email found');
      console.log('\nAll emails:');
      data.users.forEach(u => console.log('  -', u.email));
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

listUsers();
