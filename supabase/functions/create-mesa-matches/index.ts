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

    // Calculate guests per host
    const guestsPerHost = Math.floor(guests.length / hosts.length);
    const remainingGuests = guests.length % hosts.length;

    console.log(
      `Distribution: ${guestsPerHost} guests per host, with ${remainingGuests} hosts getting an extra guest`
    );

    // Create matches
    const matches = [];
    let guestIndex = 0;

    for (let i = 0; i < shuffledHosts.length; i++) {
      const host = shuffledHosts[i];
      // Some hosts get an extra guest to distribute remainder
      const numGuests = guestsPerHost + (i < remainingGuests ? 1 : 0);

      // Get guests for this match
      const matchGuests = shuffledGuests.slice(guestIndex, guestIndex + numGuests);
      guestIndex += numGuests;

      // Create match record
      const { data: match, error: matchError } = await supabase
        .from("mesa_abierta_matches")
        .insert({
          month_id: monthId,
          host_participant_id: host.id,
          dinner_date: month.dinner_date,
          dinner_time: "19:00:00",
          guest_count: matchGuests.length,
        })
        .select()
        .single();

      if (matchError) {
        throw new Error(`Failed to create match: ${matchError.message}`);
      }

      console.log(`Created match ${match.id} with host ${host.id} and ${matchGuests.length} guests`);

      // Create assignments for each guest
      const foodAssignments = ["main_course", "salad", "drinks", "dessert"];
      const shuffledFoodAssignments = shuffle([...foodAssignments]);

      for (let j = 0; j < matchGuests.length; j++) {
        const guest = matchGuests[j];
        // Cycle through food assignments if we have more guests than food types
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

        console.log(`Assigned ${guest.id} to bring ${foodAssignment}`);
      }

      matches.push({
        matchId: match.id,
        hostId: host.id,
        guestCount: matchGuests.length,
        guests: matchGuests.map((g) => g.id),
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

    console.log(`Successfully created ${matches.length} matches`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully created ${matches.length} matches with ${guests.length} guests`,
        results: {
          totalMatches: matches.length,
          hostsUsed: hosts.length,
          hostsConverted: 0, // No conversion logic in basic algorithm
          guestsAssigned: guests.length,
          guestsUnassigned: 0, // All guests are assigned in basic algorithm
          totalParticipants: hosts.length + guests.length,
          matches: matches,
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
