// Reset password using Supabase Admin API
// Run with: node reset_password.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  try {
    // User ID from SQL query result
    const userId = '2faa5ded-62fb-4460-928a-0e139cd6f42c';
    const userEmail = 'brentcurtis76@gmail.com';
    const newPassword = 'Oasis4770';

    console.log('Resetting password for:', userEmail);
    console.log('User ID:', userId);

    // Update the user's password using Admin API
    const { data: updateData, error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error('Error resetting password:', error);
      return;
    }

    console.log('✅ Password reset successful!');
    console.log('Email:', userEmail);
    console.log('Password:', newPassword);
    console.log('\nYou can now log in to the admin panel at:');
    console.log('http://localhost:8080/mesa-abierta/admin');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

resetPassword();
