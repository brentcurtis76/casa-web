import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { monthId } = await req.json();

    if (!monthId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "monthId is required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting matching for month: ${monthId}`);

    // Get month details and verify status
    const { data: month, error: monthError } = await supabase
      .from("mesa_abierta_months")
      .select("*")
      .eq("id", monthId)
      .single();

    if (monthError || !month) {
      throw new Error(`Month not found: ${monthError?.message}`);
    }

    if (month.status !== "open") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Month must be in 'open' status to create matches. Current status: ${month.status}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all confirmed participants
    const { data: participants, error: participantsError } = await supabase
      .from("mesa_abierta_participants")
      .select("*")
      .eq("month_id", monthId)
      .eq("status", "confirmed");

    if (participantsError) {
      throw new Error(`Failed to fetch participants: ${participantsError.message}`);
    }

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No confirmed participants found for this month",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${participants.length} confirmed participants`);

    // Separate hosts and guests based on assigned_role
    // Separate hosts and guests based on assigned_role
    const hosts = participants.filter((p) => p.assigned_role === "host");
    const guests = participants.filter((p) => p.assigned_role === "guest");

    console.log(`Hosts: ${hosts.length}, Guests: ${guests.length}`);

    if (hosts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No hosts available for matching",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guests.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No guests available for matching",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Shuffle arrays for random assignment
    const shuffledHosts = shuffle([...hosts]);
    const shuffledGuests = shuffle([...guests]);

    // Calculate total capacity
    const totalCapacity = shuffledHosts.reduce((sum, host) => sum + (host.host_max_guests || 5), 0);
    
    // Calculate total guest count (including plus ones)
    const totalGuestCount = shuffledGuests.reduce((sum, guest) => sum + (guest.has_plus_one ? 2 : 1), 0);

    console.log(`Total Host Capacity: ${totalCapacity}, Total Guests (with +1s): ${totalGuestCount}`);

    if (totalCapacity < totalGuestCount) {
      console.warn("Warning: Not enough host capacity for all guests!");
    }

    // Create matches
    const matches = [];
    const assignments = [];
    const unassignedGuests = [];
    
    // Initialize host tracking
    const hostStatus = shuffledHosts.map(host => ({
      ...host,
      currentGuests: 0,
      maxGuests: host.host_max_guests || 5,
      assignedGuests: []
    }));

    // Greedy assignment: Fill hosts one by one (or round robin)
    // Let's do a modified round-robin to distribute evenly but respect limits
    
    let guestsAssignedCount = 0;
    
    // Sort guests: put those with +1 first to ensure they fit? 
    // Actually, random is better for fairness, but +1s are harder to fit at the end.
    // Let's try to fit them in order.
    
    for (const guest of shuffledGuests) {
      const guestSize = guest.has_plus_one ? 2 : 1;
      let assigned = false;

      // Find a host with space
      // We sort hosts by % full to distribute evenly
      hostStatus.sort((a, b) => (a.currentGuests / a.maxGuests) - (b.currentGuests / b.maxGuests));

      for (const host of hostStatus) {
        if (host.currentGuests + guestSize <= host.maxGuests) {
          host.assignedGuests.push(guest);
          host.currentGuests += guestSize;
          assigned = true;
          guestsAssignedCount += guestSize;
          break;
        }
      }

      if (!assigned) {
        unassignedGuests.push(guest);
      }
    }

    console.log(`Assigned ${guestsAssignedCount} guests. Unassigned: ${unassignedGuests.length} guests.`);

    // Create DB records for matches and assignments
    const foodAssignments = ["main_course", "salad", "drinks", "dessert"];

    for (const host of hostStatus) {
      if (host.assignedGuests.length === 0) continue;

      // Create match record
      const { data: match, error: matchError } = await supabase
        .from("mesa_abierta_matches")
        .insert({
          month_id: monthId,
          host_participant_id: host.id,
          dinner_date: month.dinner_date,
          dinner_time: "19:00:00",
          guest_count: host.assignedGuests.length, // This is count of guest units (families/couples), not total people? 
          // Wait, the schema says guest_count INTEGER. Usually means number of guest entries.
          // But for capacity we care about heads. 
          // Let's store number of guest ENTRIES here, but we know capacity was checked against heads.
        })
        .select()
        .single();

      if (matchError) {
        throw new Error(`Failed to create match: ${matchError.message}`);
      }

      console.log(`Created match ${match.id} with host ${host.id} and ${host.assignedGuests.length} guest units (${host.currentGuests} people)`);

      // Create assignments
      const shuffledFoodAssignments = shuffle([...foodAssignments]);

      for (let j = 0; j < host.assignedGuests.length; j++) {
        const guest = host.assignedGuests[j];
        const foodAssignment = shuffledFoodAssignments[j % shuffledFoodAssignments.length];

        const { error: assignmentError } = await supabase
          .from("mesa_abierta_assignments")
          .insert({
            match_id: match.id,
            guest_participant_id: guest.id,
            food_assignment: foodAssignment,
          });

        if (assignmentError) {
          throw new Error(`Failed to create assignment: ${assignmentError.message}`);
        }
      }

      matches.push({
        matchId: match.id,
        hostId: host.id,
        guestCount: host.assignedGuests.length,
        totalPeople: host.currentGuests,
        guests: host.assignedGuests.map(g => g.id),
      });
    }

    // Update month status to 'matched'
    const { error: updateError } = await supabase
      .from("mesa_abierta_months")
      .update({ status: "matched" })
      .eq("id", monthId);

    if (updateError) {
      throw new Error(`Failed to update month status: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully created ${matches.length} matches. Assigned ${guestsAssignedCount} people. Unassigned: ${unassignedGuests.length} guest units.`,
        results: {
          totalMatches: matches.length,
          hostsUsed: matches.length,
          hostsConverted: 0, 
          guestsAssigned: guests.length - unassignedGuests.length,
          guestsUnassigned: unassignedGuests.length,
          totalParticipants: hosts.length + guests.length,
          matches: matches,
          unassignedGuests: unassignedGuests.map(g => g.id)
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating matches:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fisher-Yates shuffle algorithm for random array shuffling
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
