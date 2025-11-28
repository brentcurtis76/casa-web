
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyData() {
    console.log("Checking Mesa Abierta data...");

    try {
        // 1. Check for Open Months
        console.log("\n1. Querying 'mesa_abierta_months' for open months...");
        const { data: months, error: monthsError } = await supabase
            .from('mesa_abierta_months')
            .select('*')
            .eq('status', 'open')
            .gte('registration_deadline', new Date().toISOString())
            .order('month_date', { ascending: true })
            .limit(1);

        if (monthsError) {
            console.error("Error fetching months:", monthsError);
        } else {
            console.log("Open Months found:", months?.length);
            if (months && months.length > 0) {
                console.log("Next Month:", months[0]);
            } else {
                console.log("No open months found with future deadline.");
            }
        }

        // 2. Check for Testimonials
        console.log("\n2. Querying 'mesa_abierta_testimonials'...");
        const { data: testimonials, error: testimonialsError } = await supabase
            .from('mesa_abierta_testimonials')
            .select(`
        id,
        testimonial_text,
        rating,
        mesa_abierta_participants!inner(
          profiles!inner(full_name)
        ),
        mesa_abierta_months!inner(month_date)
      `)
            .eq('is_approved', true)
            .eq('is_featured', true)
            .limit(5);

        if (testimonialsError) {
            console.error("Error fetching testimonials:", testimonialsError);
        } else {
            console.log("Testimonials found:", testimonials?.length);
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

verifyData();
