// BROWSER CONSOLE SCRIPT - Copy and paste this into browser console when on the admin page
// This will show you exactly what data each person will receive in their email

(async function previewEmailData() {
  const translateFood = (a) => ({
    main_course: "Plato Principal",
    salad: "Ensalada",
    drinks: "Bebidas",
    dessert: "Postre",
    none: "Ninguna"
  })[a] || a || "Sin asignar";

  // Get Supabase client from window (it's exposed by the app)
  const { supabase } = await import('/src/integrations/supabase/client.ts');

  // Get matched month
  const { data: month } = await supabase
    .from('mesa_abierta_months')
    .select('*')
    .eq('status', 'matched')
    .order('dinner_date', { ascending: false })
    .limit(1)
    .single();

  if (!month) {
    console.error("No matched month found");
    return;
  }

  console.log("%c=== LA MESA ABIERTA - EMAIL PREVIEW ===", "font-size: 18px; font-weight: bold; color: #0066cc;");
  console.log(`Month: ${month.dinner_date}, Status: ${month.status}`);

  // Get matches
  const { data: matches } = await supabase
    .from('mesa_abierta_matches')
    .select('*')
    .eq('month_id', month.id)
    .order('created_at', { ascending: true });

  // Get participants
  const { data: participants } = await supabase
    .from('mesa_abierta_participants')
    .select('*')
    .eq('month_id', month.id);

  const participantMap = new Map(participants.map(p => [p.id, p]));

  // Get profiles
  const userIds = participants.map(p => p.user_id).filter(Boolean);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Get assignments
  const { data: assignments } = await supabase
    .from('mesa_abierta_assignments')
    .select('*')
    .in('match_id', matches.map(m => m.id));

  const assignmentsByMatch = new Map();
  for (const a of assignments) {
    if (!assignmentsByMatch.has(a.match_id)) assignmentsByMatch.set(a.match_id, []);
    assignmentsByMatch.get(a.match_id).push(a);
  }

  // Build comparison table
  const comparisonData = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const hostP = participantMap.get(match.host_participant_id);
    const hostProfile = profileMap.get(hostP?.user_id);
    const matchAssignments = assignmentsByMatch.get(match.id) || [];

    // Calculate total people
    let totalPeople = 1 + (hostP?.has_plus_one ? 1 : 0);
    for (const a of matchAssignments) {
      const guestP = participantMap.get(a.guest_participant_id);
      totalPeople += 1 + (guestP?.has_plus_one ? 1 : 0);
    }

    console.log("%c\n=== CENA #" + (i+1) + " ===", "font-size: 14px; font-weight: bold; color: #006600;");

    // Host info
    console.log("%cHOST EMAIL:", "font-weight: bold; color: #cc6600;");
    console.table({
      "Recipient": hostP?.email || "NO EMAIL",
      "Name": hostProfile?.full_name || "Sin nombre",
      "Address": hostP?.host_address || "N/A",
      "Phone": hostP?.phone_number || "N/A",
      "Host Food": translateFood(match.host_food_assignment) + (match.host_food_assignment ? "" : " ⚠️ NOT IN EMAIL YET"),
      "Guest Count": matchAssignments.length
    });

    console.log("Guest List in Host Email (anonymous):");
    matchAssignments.forEach((a, idx) => {
      const guestP = participantMap.get(a.guest_participant_id);
      console.log(`  Invitado ${idx+1}${guestP?.has_plus_one ? " (+1)" : ""}: ${translateFood(a.food_assignment)}`);
    });

    // Guest emails
    console.log("%c\nGUEST EMAILS:", "font-weight: bold; color: #cc6600;");

    for (const a of matchAssignments) {
      const guestP = participantMap.get(a.guest_participant_id);
      const guestProfile = profileMap.get(guestP?.user_id);

      comparisonData.push({
        Dinner: `#${i+1}`,
        Role: "Guest",
        Name: guestProfile?.full_name || "Sin nombre",
        Email: guestP?.email || "NO EMAIL",
        Food: translateFood(a.food_assignment),
        "Food For": `${totalPeople} personas`,
        "+1": guestP?.has_plus_one ? "Sí" : "No",
        "Host Address": hostP?.host_address || "N/A"
      });
    }

    // Add host to comparison
    comparisonData.push({
      Dinner: `#${i+1}`,
      Role: "HOST",
      Name: hostProfile?.full_name || "Sin nombre",
      Email: hostP?.email || "NO EMAIL",
      Food: translateFood(match.host_food_assignment),
      "Food For": "-",
      "+1": hostP?.has_plus_one ? "Sí" : "No",
      "Host Address": hostP?.host_address || "N/A"
    });
  }

  console.log("%c\n=== FULL COMPARISON TABLE ===", "font-size: 14px; font-weight: bold; color: #0066cc;");
  console.table(comparisonData);

  console.log("%c\n⚠️ IMPORTANT: Host food assignment is NOT yet included in email notifications!",
    "font-size: 12px; font-weight: bold; color: #cc0000;");
  console.log("The send-mesa-notifications function needs to be updated to include host_food_assignment.");

  return comparisonData;
})();
