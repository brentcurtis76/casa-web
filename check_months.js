const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mulsqxfhxxdsadxsljss.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTI2NTcwMCwiZXhwIjoyMDQ2ODQxNzAwfQ.6AtJfIpnhTVHbxuVdJ5y0MiO5V1B1Mm8pgVw5FgZ8_g'
);

async function checkMonths() {
  const { data, error } = await supabase
    .from('mesa_abierta_months')
    .select('*')
    .order('month_date', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('All months:');
  console.log(JSON.stringify(data, null, 2));
}

checkMonths();
