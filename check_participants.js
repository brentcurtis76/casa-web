// Check if participants exist in the database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mulsqxfhxxdsadxsljss.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzQ3MTY4MCwiZXhwIjoyMDU5MDQ3NjgwfQ.z_sq53i6qIRWN5pHw6RNwRkOnaVQkeqOT-dfgvYHAP0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkParticipants() {
  try {
    // Get December 2024 month
    const { data: monthData, error: monthError } = await supabase
      .from('mesa_abierta_months')
      .select('*')
      .eq('month_date', '2024-12-01')
      .single();

    if (monthError) {
      console.error('Error fetching month:', monthError);
      return;
    }

    console.log('Month:', monthData);
    console.log('Month ID:', monthData.id);
    console.log('Status:', monthData.status);

    // Get participants for this month
    const { data: participants, error: participantsError } = await supabase
      .from('mesa_abierta_participants')
      .select('*')
      .eq('month_id', monthData.id);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return;
    }

    console.log('\n📊 Participants:', participants?.length || 0);

    if (participants && participants.length > 0) {
      const hosts = participants.filter(p => p.role_preference === 'host');
      const guests = participants.filter(p => p.role_preference === 'guest');

      console.log('  Hosts:', hosts.length);
      console.log('  Guests:', guests.length);
      console.log('\nSample participants:');
      participants.slice(0, 3).forEach(p => {
        console.log(`  - ${p.role_preference}, status: ${p.status}`);
      });
    } else {
      console.log('❌ No participants found! Need to recreate mock data.');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkParticipants();
