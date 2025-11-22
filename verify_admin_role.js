// Verify admin role exists
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyAdminRole() {
  try {
    const userId = '92d5dc7f-0a13-49b9-8b5b-9e5af7292ed6';
    const userEmail = 'sanandres@iach.cl';

    console.log('Checking admin role for:', userEmail);
    console.log('User ID:', userId);

    // Check if admin role exists
    const { data, error } = await supabase
      .from('mesa_abierta_admin_roles')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error querying admin roles:', error);

      // Try to insert it again
      console.log('\nAttempting to insert admin role...');
      const { data: insertData, error: insertError } = await supabase
        .from('mesa_abierta_admin_roles')
        .insert({
          user_id: userId,
          role: 'super_admin'
        })
        .select();

      if (insertError) {
        console.error('Error inserting admin role:', insertError);
      } else {
        console.log('✅ Admin role inserted:', insertData);
      }
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ No admin role found for this user');

      // Try to insert it
      console.log('\nAttempting to insert admin role...');
      const { data: insertData, error: insertError } = await supabase
        .from('mesa_abierta_admin_roles')
        .insert({
          user_id: userId,
          role: 'super_admin'
        })
        .select();

      if (insertError) {
        console.error('Error inserting admin role:', insertError);
      } else {
        console.log('✅ Admin role inserted:', insertData);
      }
    } else {
      console.log('✅ Admin role found:', data);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

verifyAdminRole();
