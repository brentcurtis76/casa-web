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

    // IDEMPOTENCY CHECK: Verify no matches already exist for this month
    const { data: existingMatches, error: existingMatchesError } = await supabase
      .from("mesa_abierta_matches")
      .select("id")
      .eq("month_id", monthId);

    if (existingMatchesError) {
      throw new Error(`Failed to check existing matches: ${existingMatchesError.message}`);
    }

    if (existingMatches && existingMatches.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Matches already exist for this month (${existingMatches.length} found). Delete existing matches first or reset the month status.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all pending participants (users sign up with 'pending' status)
    const { data: participants, error: participantsError } = await supabase
      .from("mesa_abierta_participants")
      .select("*")
      .eq("month_id", monthId)
      .eq("status", "pending");

    if (participantsError) {
      throw new Error(`Failed to fetch participants: ${participantsError.message}`);
    }

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No pending participants found for this month",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${participants.length} pending participants`);

    // Separate hosts and guests based on role_preference (what they signed up as)
    const hosts = participants.filter((p) => p.role_preference === "host");
    const guests = participants.filter((p) => p.role_preference === "guest");

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

    // Calculate total capacity (accounting for host's own +1 if applicable)
    const totalCapacity = shuffledHosts.reduce((sum, host) => {
      const maxGuests = host.host_max_guests || 5;
      const hostPlusOne = host.has_plus_one ? 1 : 0;
      return sum + Math.max(0, maxGuests - hostPlusOne);
    }, 0);

    // Calculate total guest count (including plus ones)
    const totalGuestCount = shuffledGuests.reduce((sum, guest) => sum + (guest.has_plus_one ? 2 : 1), 0);

    console.log(`Total Host Capacity: ${totalCapacity}, Total Guests (with +1s): ${totalGuestCount}`);

    if (totalCapacity < totalGuestCount) {
      console.warn("Warning: Not enough host capacity for all guests!");
    }

    // Minimum people per dinner (including host, host's +1, guests, and guest +1s)
    const MIN_PEOPLE_PER_DINNER = 5;
    // Target guest-side people per dinner for good dinner sizes
    // Aiming for 6 ensures dinners of 7-8 people (host + maybe +1 + 6 guests)
    // This creates fewer, fuller dinners rather than many small ones
    const TARGET_GUEST_SIDE_FOR_DINNER = 6;

    // Initialize host tracking (account for host's +1 in capacity)
    const hostStatus = shuffledHosts.map(host => {
      const maxGuests = host.host_max_guests || 5;
      const hostPlusOne = host.has_plus_one ? 1 : 0;
      // Host side people = host (1) + host's +1 if applicable
      const hostSidePeople = 1 + hostPlusOne;
      return {
        ...host,
        currentGuests: 0, // Count of guest-side people (guests + their +1s)
        maxGuests: Math.max(0, maxGuests - hostPlusOne),
        hostSidePeople, // How many people on the host side (1 or 2)
        assignedGuests: [] as typeof guests
      };
    });

    // Calculate total people across ALL participants (hosts + guests + all +1s)
    const totalHostSidePeople = shuffledHosts.reduce((sum, h) => sum + (h.has_plus_one ? 2 : 1), 0);
    const totalAllPeople = totalHostSidePeople + totalGuestCount;

    console.log(`Total people: ${totalAllPeople} (${totalHostSidePeople} host-side + ${totalGuestCount} guest-side)`);

    // Sort hosts by capacity (largest first) for greedy selection
    hostStatus.sort((a, b) => b.maxGuests - a.maxGuests);

    // Calculate minimum guest-side people needed per dinner to meet MIN_PEOPLE_PER_DINNER
    // A host with +1 needs fewer guests (5 - 2 = 3 guest-side people)
    // A host without +1 needs more guests (5 - 1 = 4 guest-side people)
    const MIN_GUESTS_PER_DINNER = MIN_PEOPLE_PER_DINNER - 1; // Assuming host has no +1 (worst case = 4)

    // Greedy algorithm: Find the maximum number of dinners where each can have MIN_GUESTS_PER_DINNER
    // Formula: numHosts dinners need (numHosts * MIN_GUESTS_PER_DINNER) guest-side people
    // Available guest-side people = original guests + converted hosts
    let hostsToUse = 1;

    for (let numHosts = hostStatus.length; numHosts >= 1; numHosts--) {
      // If we use numHosts hosts, the remaining hosts become guests
      const convertedHostsAsGuests = hostStatus.slice(numHosts).reduce((sum, h) => sum + (h.has_plus_one ? 2 : 1), 0);
      const totalGuestsAvailable = totalGuestCount + convertedHostsAsGuests;
      const guestsNeededForMinimum = numHosts * MIN_GUESTS_PER_DINNER;
      const activeHostCapacity = hostStatus.slice(0, numHosts).reduce((sum, h) => sum + h.maxGuests, 0);

      console.log(`Testing ${numHosts} hosts: need ${guestsNeededForMinimum} guests for minimum, have ${totalGuestsAvailable}, capacity=${activeHostCapacity}`);

      // Check both: enough guests for minimum AND enough capacity
      if (totalGuestsAvailable >= guestsNeededForMinimum && activeHostCapacity >= totalGuestsAvailable) {
        hostsToUse = numHosts;
        break;
      }
    }

    console.log(`Optimal hosts to use: ${hostsToUse}`);

    // Sort hosts by capacity (largest first) and only use the top N hosts
    hostStatus.sort((a, b) => b.maxGuests - a.maxGuests);
    const activeHosts = hostStatus.slice(0, hostsToUse);
    const waitlistHosts = hostStatus.slice(hostsToUse);

    console.log(`Active hosts: ${activeHosts.length}, Hosts converted to guests: ${waitlistHosts.length}`);

    // Convert excess hosts to guests - they'll be assigned to dinners as guests
    const hostsConvertedToGuests = waitlistHosts.map(h => ({
      ...h,
      originalRole: 'host' as const, // Track that they were originally hosts
    }));

    // Combine original guests with converted hosts
    const allGuests = [...shuffledGuests, ...hostsConvertedToGuests];

    // Recalculate total guest count with converted hosts
    const totalGuestCountWithConverted = allGuests.reduce((sum, guest) => sum + (guest.has_plus_one ? 2 : 1), 0);
    console.log(`Total guests after host conversion: ${allGuests.length} units (${totalGuestCountWithConverted} people)`);

    // First pass: Assign guests to active hosts with even distribution
    const unassignedGuests: typeof allGuests = [];
    let guestsAssignedCount = 0;

    for (const guest of allGuests) {
      const guestSize = guest.has_plus_one ? 2 : 1;
      let assigned = false;

      // Sort active hosts by % full to distribute evenly
      activeHosts.sort((a, b) => (a.currentGuests / a.maxGuests) - (b.currentGuests / b.maxGuests));

      for (const host of activeHosts) {
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

    console.log(`First pass: Assigned ${guestsAssignedCount} guest-side people. Unassigned: ${unassignedGuests.length} guest units.`);

    // Second pass: Enforce minimum people per dinner
    // Check each active host and redistribute guests from hosts with too few people
    const hostsWithTooFew: typeof activeHosts = [];
    const hostsWithEnough: typeof activeHosts = [];

    for (const host of activeHosts) {
      const totalPeople = host.hostSidePeople + host.currentGuests;
      if (host.assignedGuests.length > 0 && totalPeople < MIN_PEOPLE_PER_DINNER) {
        hostsWithTooFew.push(host);
      } else if (host.assignedGuests.length > 0) {
        hostsWithEnough.push(host);
      }
    }

    console.log(`Hosts with enough people: ${hostsWithEnough.length}, Hosts with too few: ${hostsWithTooFew.length}`);

    // Try to redistribute guests from hosts with too few to hosts with enough capacity
    for (const smallHost of hostsWithTooFew) {
      // Try to move all guests from this small dinner to other dinners
      const guestsToRedistribute = [...smallHost.assignedGuests];
      let allRedistributed = true;

      for (const guest of guestsToRedistribute) {
        const guestSize = guest.has_plus_one ? 2 : 1;
        let redistributed = false;

        // Sort hosts with enough people by available capacity (most capacity first)
        hostsWithEnough.sort((a, b) => (b.maxGuests - b.currentGuests) - (a.maxGuests - a.currentGuests));

        for (const targetHost of hostsWithEnough) {
          if (targetHost.currentGuests + guestSize <= targetHost.maxGuests) {
            // Move guest to target host
            targetHost.assignedGuests.push(guest);
            targetHost.currentGuests += guestSize;
            redistributed = true;
            break;
          }
        }

        if (!redistributed) {
          allRedistributed = false;
        }
      }

      if (allRedistributed) {
        // Successfully moved all guests, clear this host
        smallHost.assignedGuests = [];
        smallHost.currentGuests = 0;
        console.log(`Redistributed all guests from host ${smallHost.id} to other dinners`);
      } else {
        // Could not redistribute all guests - this becomes the "leftover" dinner
        // Keep the original assignments (allowed exception for last dinner)
        console.log(`Host ${smallHost.id} keeps ${smallHost.assignedGuests.length} guests as leftover dinner (${smallHost.hostSidePeople + smallHost.currentGuests} total people)`);
      }
    }

    // Merge activeHosts back into hostStatus for the rest of the logic
    // Clear waitlist hosts' assignments (they shouldn't have any)
    for (const host of waitlistHosts) {
      host.assignedGuests = [];
      host.currentGuests = 0;
    }

    // Recalculate totals after redistribution
    guestsAssignedCount = activeHosts.reduce((sum, h) => sum + h.currentGuests, 0);
    console.log(`After redistribution: Assigned ${guestsAssignedCount} guest-side people.`);

    // Track created matches for potential rollback
    const createdMatchIds: string[] = [];
    const matches: Array<{matchId: string; hostId: string; guestCount: number; totalPeople: number; guests: string[]}> = [];

    try {
      // Create DB records for matches and assignments
      const foodAssignments = ["main_course", "salad", "drinks", "dessert"];

      for (const host of hostStatus) {
        if (host.assignedGuests.length === 0) continue;

        // Create match record with host food assignment
        // Shuffle food options and assign one to the host
        const hostFoodOptions = shuffle([...foodAssignments]);
        const hostFoodAssignment = hostFoodOptions[0];

        const { data: match, error: matchError } = await supabase
          .from("mesa_abierta_matches")
          .insert({
            month_id: monthId,
            host_participant_id: host.id,
            dinner_date: month.dinner_date,
            dinner_time: month.dinner_time || "19:00:00",
            guest_count: host.assignedGuests.length,
            host_food_assignment: hostFoodAssignment,
          })
          .select()
          .single();

        if (matchError) {
          throw new Error(`Failed to create match: ${matchError.message}`);
        }

        createdMatchIds.push(match.id);
        console.log(`Created match ${match.id} with host ${host.id} and ${host.assignedGuests.length} guest units (${host.currentGuests} people)`);

        // Batch create assignments for this match
        const shuffledFoodAssignments = shuffle([...foodAssignments]);
        const assignmentsToInsert = host.assignedGuests.map((guest, j) => ({
          match_id: match.id,
          guest_participant_id: guest.id,
          food_assignment: shuffledFoodAssignments[j % shuffledFoodAssignments.length],
        }));

        const { error: assignmentError } = await supabase
          .from("mesa_abierta_assignments")
          .insert(assignmentsToInsert);

        if (assignmentError) {
          throw new Error(`Failed to create assignments: ${assignmentError.message}`);
        }

        matches.push({
          matchId: match.id,
          hostId: host.id,
          guestCount: host.assignedGuests.length,
          totalPeople: host.currentGuests,
          guests: host.assignedGuests.map(g => g.id),
        });
      }

      // Update all matched participants: set assigned_role and status to 'confirmed'
      // Update hosts that have guests assigned
      const assignedHostIds = hostStatus.filter(h => h.assignedGuests.length > 0).map(h => h.id);
      if (assignedHostIds.length > 0) {
        const { error: hostUpdateError } = await supabase
          .from("mesa_abierta_participants")
          .update({ assigned_role: "host", status: "confirmed" })
          .in("id", assignedHostIds);

        if (hostUpdateError) {
          throw new Error(`Failed to update host participants: ${hostUpdateError.message}`);
        }
      }

      // Note: Hosts that weren't needed are converted to guests and assigned to dinners
      // They will be updated in the guest update below with assigned_role: "guest"

      // Update assigned guests (including hosts converted to guests)
      const assignedGuestIds = hostStatus.flatMap(h => h.assignedGuests.map(g => g.id));
      if (assignedGuestIds.length > 0) {
        const { error: guestUpdateError } = await supabase
          .from("mesa_abierta_participants")
          .update({ assigned_role: "guest", status: "confirmed" })
          .in("id", assignedGuestIds);

        if (guestUpdateError) {
          throw new Error(`Failed to update guest participants: ${guestUpdateError.message}`);
        }
      }

      // Update unassigned guests to waitlist
      const unassignedGuestIds = unassignedGuests.map(g => g.id);
      if (unassignedGuestIds.length > 0) {
        const { error: waitlistError } = await supabase
          .from("mesa_abierta_participants")
          .update({ status: "waitlist" })
          .in("id", unassignedGuestIds);

        if (waitlistError) {
          throw new Error(`Failed to update waitlist participants: ${waitlistError.message}`);
        }
      }

      // Update month status to 'matched' with optimistic locking
      const { error: updateError, count } = await supabase
        .from("mesa_abierta_months")
        .update({ status: "matched" })
        .eq("id", monthId)
        .eq("status", "open"); // Only update if still open (optimistic lock)

      if (updateError) {
        throw new Error(`Failed to update month status: ${updateError.message}`);
      }

      // Note: Supabase JS client doesn't return count by default, so we check separately if needed
      // The status check above provides the locking mechanism

    } catch (innerError) {
      // Rollback: Delete any created matches (cascades to assignments)
      console.error("Error during matching, rolling back:", innerError);
      if (createdMatchIds.length > 0) {
        console.log(`Rolling back ${createdMatchIds.length} created matches...`);
        await supabase
          .from("mesa_abierta_matches")
          .delete()
          .in("id", createdMatchIds);
      }
      throw innerError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully created ${matches.length} matches. Assigned ${guestsAssignedCount} people. ${hostsConvertedToGuests.length} hosts converted to guests. Unassigned: ${unassignedGuests.length} guest units.`,
        results: {
          totalMatches: matches.length,
          hostsUsed: matches.length,
          hostsConvertedToGuests: hostsConvertedToGuests.length,
          originalGuests: guests.length,
          guestsAssigned: allGuests.length - unassignedGuests.length,
          guestsUnassigned: unassignedGuests.length,
          totalParticipants: hosts.length + guests.length,
          matchDetails: matches.map(m => ({
            matchNumber: matches.indexOf(m) + 1,
            hostId: m.hostId,
            guestCount: m.guestCount,
          })),
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
