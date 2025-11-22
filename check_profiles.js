// Check if profiles exist for test users
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkProfiles() {
  try {
    // Get December 2024 month
    const { data: monthData } = await supabase
      .from('mesa_abierta_months')
      .select('id')
      .eq('month_date', '2024-12-01')
      .single();

    if (!monthData) {
      console.log('Month not found');
      return;
    }

    console.log('Month ID:', monthData.id);

    // Try the same query as the admin component
    const { data, error } = await supabase
      .from('mesa_abierta_participants')
      .select(`
        id,
        role_preference,
        assigned_role,
        has_plus_one,
        status,
        profiles (full_name)
      `)
      .eq('month_id', monthData.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('\n❌ Query error:', error);
      console.error('Code:', error.code);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
    } else {
      console.log('\n✅ Query successful!');
      console.log('Participants found:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('\nSample data:', JSON.stringify(data[0], null, 2));
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkProfiles();
