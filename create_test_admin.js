// Create a new test admin user
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestAdmin() {
  try {
    const testEmail = 'sanandres@iach.cl';
    const testPassword = 'Oasis4770';

    console.log('Creating admin user...');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);

    // Create user via Admin API
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }

    console.log('✅ User created successfully!');
    console.log('User ID:', createData.user.id);

    // Make them admin
    const { error: adminError } = await supabase
      .from('mesa_abierta_admin_roles')
      .insert({
        user_id: createData.user.id,
        role: 'super_admin'
      });

    if (adminError) {
      console.error('Error creating admin role:', adminError);
      return;
    }

    console.log('✅ Admin role granted!');
    console.log('\nYou can now log in with:');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('\nAdmin panel: http://localhost:8080/mesa-abierta/admin');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createTestAdmin();
