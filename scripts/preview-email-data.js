// Preview Email Data Script
// Run with: node scripts/preview-email-data.js
// This shows exactly what data will be sent in emails for the current matched month

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mulsqxfhxxdsadxsljss.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const translateFoodAssignment = (assignment) => {
  const translations = {
    main_course: "Plato Principal",
    salad: "Ensalada",
    drinks: "Bebidas",
    dessert: "Postre",
    none: "Ninguna",
  };
  return translations[assignment] || assignment || "Sin asignar";
};

async function previewEmailData() {
  console.log("=".repeat(80));
  console.log("PREVIEW: Email Data for La Mesa Abierta");
  console.log("=".repeat(80));
  console.log("");

  // Get the matched month
  const { data: month, error: monthError } = await supabase
    .from('mesa_abierta_months')
    .select('*')
    .eq('status', 'matched')
    .order('dinner_date', { ascending: false })
    .limit(1)
    .single();

  if (monthError || !month) {
    console.error("No matched month found:", monthError?.message);
    return;
  }

  console.log(`Month: ${month.dinner_date}`);
  console.log(`Status: ${month.status}`);
  console.log(`Dinner Time: ${month.dinner_time}`);
  console.log("");

  // Get all matches for this month
  const { data: matches, error: matchesError } = await supabase
    .from('mesa_abierta_matches')
    .select('*')
    .eq('month_id', month.id)
    .order('created_at', { ascending: true });

  if (matchesError || !matches) {
    console.error("Failed to fetch matches:", matchesError?.message);
    return;
  }

  console.log(`Found ${matches.length} dinners`);
  console.log("");

  // Get all participants
  const { data: participants, error: participantsError } = await supabase
    .from('mesa_abierta_participants')
    .select('*')
    .eq('month_id', month.id);

  if (participantsError) {
    console.error("Failed to fetch participants:", participantsError.message);
    return;
  }

  // Create participant map
  const participantMap = new Map();
  for (const p of participants) {
    participantMap.set(p.id, p);
  }

  // Get all user IDs to fetch profiles
  const userIds = participants.map(p => p.user_id).filter(Boolean);

  // Get profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  const profileMap = new Map();
  for (const p of profiles || []) {
    profileMap.set(p.id, p);
  }

  // Get all assignments
  const matchIds = matches.map(m => m.id);
  const { data: assignments, error: assignmentsError } = await supabase
    .from('mesa_abierta_assignments')
    .select('*')
    .in('match_id', matchIds);

  if (assignmentsError) {
    console.error("Failed to fetch assignments:", assignmentsError.message);
    return;
  }

  // Group assignments by match
  const assignmentsByMatch = new Map();
  for (const a of assignments || []) {
    if (!assignmentsByMatch.has(a.match_id)) {
      assignmentsByMatch.set(a.match_id, []);
    }
    assignmentsByMatch.get(a.match_id).push(a);
  }

  // Process each dinner
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const hostParticipant = participantMap.get(match.host_participant_id);
    const hostProfile = profileMap.get(hostParticipant?.user_id);
    const matchAssignments = assignmentsByMatch.get(match.id) || [];

    console.log("=".repeat(80));
    console.log(`CENA #${i + 1}`);
    console.log("=".repeat(80));
    console.log("");

    // HOST EMAIL INFO
    console.log("-".repeat(40));
    console.log("HOST EMAIL WILL CONTAIN:");
    console.log("-".repeat(40));
    console.log(`  To: ${hostParticipant?.email || 'NO EMAIL'}`);
    console.log(`  Name: ${hostProfile?.full_name || 'Sin nombre'}`);
    console.log(`  Subject: Tu asignación como Anfitrión - La Mesa Abierta`);
    console.log(`  Fecha: ${new Date(match.dinner_date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`  Hora: ${match.dinner_time}`);
    console.log(`  Guest Count: ${matchAssignments.length}`);
    console.log(`  Host Food Assignment: ${translateFoodAssignment(match.host_food_assignment)} ${match.host_food_assignment ? '' : '⚠️  NOT IN EMAIL YET!'}`);
    console.log(`  Guest List (anonymous):`);
    matchAssignments.forEach((a, idx) => {
      const guestP = participantMap.get(a.guest_participant_id);
      const plusOne = guestP?.has_plus_one ? " (+1 acompañante)" : "";
      console.log(`    - Invitado ${idx + 1}${plusOne}: ${translateFoodAssignment(a.food_assignment)}`);
    });
    console.log("");

    // Calculate total people for guest emails
    let totalPeople = 1; // host
    if (hostParticipant?.has_plus_one) totalPeople++;
    for (const a of matchAssignments) {
      const guestP = participantMap.get(a.guest_participant_id);
      totalPeople++;
      if (guestP?.has_plus_one) totalPeople++;
    }

    // GUEST EMAILS
    console.log("-".repeat(40));
    console.log("GUEST EMAILS WILL CONTAIN:");
    console.log("-".repeat(40));

    for (const assignment of matchAssignments) {
      const guestParticipant = participantMap.get(assignment.guest_participant_id);
      const guestProfile = profileMap.get(guestParticipant?.user_id);

      console.log(`  Guest: ${guestProfile?.full_name || 'Sin nombre'}`);
      console.log(`    To: ${guestParticipant?.email || 'NO EMAIL'}`);
      console.log(`    Subject: Tu asignación como Invitado - La Mesa Abierta`);
      console.log(`    Fecha: ${new Date(match.dinner_date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
      console.log(`    Hora: ${match.dinner_time}`);
      console.log(`    Dirección: ${hostParticipant?.host_address || 'Por confirmar'}`);
      console.log(`    Food Assignment: ${translateFoodAssignment(assignment.food_assignment)} para ${totalPeople} personas`);
      console.log(`    Has +1: ${guestParticipant?.has_plus_one ? 'Sí' : 'No'}`);
      console.log("");
    }
    console.log("");
  }

  // Summary comparison
  console.log("=".repeat(80));
  console.log("SUMMARY FOR UI COMPARISON");
  console.log("=".repeat(80));
  console.log("");

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const hostParticipant = participantMap.get(match.host_participant_id);
    const hostProfile = profileMap.get(hostParticipant?.user_id);
    const matchAssignments = assignmentsByMatch.get(match.id) || [];

    console.log(`Cena #${i + 1}:`);
    console.log(`  Host: ${hostProfile?.full_name || 'Sin nombre'}`);
    console.log(`  Host Address: ${hostParticipant?.host_address || 'N/A'}`);
    console.log(`  Host Phone: ${hostParticipant?.phone_number || 'N/A'}`);
    console.log(`  Host Food: ${translateFoodAssignment(match.host_food_assignment)}`);
    console.log(`  Guests:`);

    for (const a of matchAssignments) {
      const guestP = participantMap.get(a.guest_participant_id);
      const guestProfile = profileMap.get(guestP?.user_id);
      console.log(`    - ${guestProfile?.full_name || 'Sin nombre'}${guestP?.has_plus_one ? ' (+1)' : ''}: ${translateFoodAssignment(a.food_assignment)}`);
    }
    console.log("");
  }
}

previewEmailData().catch(console.error);
