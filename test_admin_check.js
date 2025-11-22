// Test if the admin check works with the logged-in user
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminCheck() {
  try {
    console.log('Testing admin check as logged-in user...\n');

    // Sign in as the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'sanandres@iach.cl',
      password: 'Oasis4770'
    });

    if (authError) {
      console.error('Login failed:', authError);
      return;
    }

    console.log('✅ Logged in successfully');
    console.log('User ID:', authData.user.id);
    console.log('User email:', authData.user.email);

    // Try to fetch admin role (like the component does)
    const { data: adminData, error: adminError } = await supabase
      .from('mesa_abierta_admin_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();

    if (adminError) {
      console.error('\n❌ Error fetching admin role:', adminError);
      console.error('Code:', adminError.code);
      console.error('Details:', adminError.details);
      console.error('Hint:', adminError.hint);
      console.error('Message:', adminError.message);
    } else {
      console.log('\n✅ Admin role found:', adminData);
    }

    // Sign out
    await supabase.auth.signOut();

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testAdminCheck();
