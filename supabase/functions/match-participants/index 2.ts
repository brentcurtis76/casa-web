import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Participant {
  id: string;
  user_id: string;
  role_preference: "host" | "guest";
  has_plus_one: boolean;
  host_max_guests: number | null;
  mesa_abierta_dietary_restrictions: Array<{
    restriction_type: string;
    severity: string;
    is_plus_one: boolean;
  }>;
}

interface MatchRequest {
  monthId: string;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate dietary restriction compatibility score (lower is better)
function calculateDietaryScore(restrictions: Participant["mesa_abierta_dietary_restrictions"]): number {
  if (!restrictions || restrictions.length === 0) return 0;

  let score = 0;
  for (const restriction of restrictions) {
    // Allergies are most important
    if (restriction.severity === "allergy") score += 10;
    // Preferences are less critical
    else score += 1;
  }
  return score;
}

// Group participants by dietary complexity for better distribution
function sortByDietaryComplexity(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    const scoreA = calculateDietaryScore(a.mesa_abierta_dietary_restrictions);
    const scoreB = calculateDietaryScore(b.mesa_abierta_dietary_restrictions);
    return scoreB - scoreA; // Higher scores (more complex) first
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { monthId }: MatchRequest = await req.json();

    if (!monthId) {
      throw new Error("Se requiere el ID del mes");
    }

    console.log(`Iniciando matching para el mes: ${monthId}`);

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Configuración de Supabase no disponible");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===================================
    // STEP 1: Fetch month and validate
    // ===================================
    const { data: monthData, error: monthError } = await supabase
      .from("mesa_abierta_months")
      .select("id, month_date, dinner_date, dinner_time, status")
      .eq("id", monthId)
      .single();

    if (monthError || !monthData) {
      throw new Error(`Mes no encontrado: ${monthError?.message || "desconocido"}`);
    }

    if (monthData.status !== "open") {
      throw new Error(`El mes ya fue procesado (estado: ${monthData.status})`);
    }

    console.log(`Mes encontrado: ${monthData.month_date}, cena el ${monthData.dinner_date}`);

    // ===================================
    // STEP 2: Fetch all pending participants
    // ===================================
    const { data: participants, error: participantsError } = await supabase
      .from("mesa_abierta_participants")
      .select(`
        id,
        user_id,
        role_preference,
        has_plus_one,
        host_max_guests,
        mesa_abierta_dietary_restrictions (
          restriction_type,
          severity,
          is_plus_one
        )
      `)
      .eq("month_id", monthId)
      .eq("status", "pending");

    if (participantsError) {
      throw new Error(`Error al obtener participantes: ${participantsError.message}`);
    }

    if (!participants || participants.length === 0) {
      throw new Error("No hay participantes pendientes para este mes");
    }

    console.log(`Total participantes: ${participants.length}`);

    // ===================================
    // STEP 2.5: Fetch historical matches to avoid repeats
    // ===================================
    const participantUserIds = participants.map((p) => p.user_id);

    // Fetch all past matches involving current participants (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: historicalMatches, error: historyError } = await supabase
      .from("mesa_abierta_matches")
      .select(`
        id,
        host_participant_id,
        mesa_abierta_participants!mesa_abierta_matches_host_participant_id_fkey (
          user_id
        ),
        mesa_abierta_assignments (
          guest_participant_id,
          mesa_abierta_participants!mesa_abierta_assignments_guest_participant_id_fkey (
            user_id
          )
        ),
        mesa_abierta_months!inner (
          dinner_date
        )
      `)
      .gte("mesa_abierta_months.dinner_date", sixMonthsAgo.toISOString());

    // Build connection history map: Set of "userId1-userId2" pairs
    const connectionHistory = new Set<string>();

    if (historicalMatches && !historyError) {
      for (const match of historicalMatches) {
        const hostUserId = match.mesa_abierta_participants?.user_id;
        if (!hostUserId) continue;

        // Record connections between host and all guests
        for (const assignment of match.mesa_abierta_assignments || []) {
          const guestUserId = assignment.mesa_abierta_participants?.user_id;
          if (!guestUserId) continue;

          // Create bidirectional connection key (sorted to ensure consistency)
          const pair = [hostUserId, guestUserId].sort().join("-");
          connectionHistory.add(pair);
        }

        // Record connections between all guests in the same dinner
        const guestUserIds = (match.mesa_abierta_assignments || [])
          .map((a) => a.mesa_abierta_participants?.user_id)
          .filter((id): id is string => !!id);

        for (let i = 0; i < guestUserIds.length; i++) {
          for (let j = i + 1; j < guestUserIds.length; j++) {
            const pair = [guestUserIds[i], guestUserIds[j]].sort().join("-");
            connectionHistory.add(pair);
          }
        }
      }

      console.log(`Conexiones históricas encontradas: ${connectionHistory.size}`);
    }

    // Helper function to check if two users have dined together before
    const haveDinedTogether = (userId1: string, userId2: string): boolean => {
      const pair = [userId1, userId2].sort().join("-");
      return connectionHistory.has(pair);
    };

    // ===================================
    // STEP 3: Separate hosts and guests
    // ===================================
    let hosts = participants.filter((p) => p.role_preference === "host");
    let guests = participants.filter((p) => p.role_preference === "guest");

    console.log(`Anfitriones: ${hosts.length}, Invitados: ${guests.length}`);

    if (hosts.length === 0) {
      throw new Error("No hay anfitriones disponibles");
    }

    if (guests.length === 0) {
      throw new Error("No hay invitados disponibles");
    }

    // ===================================
    // STEP 3.5: Balance host/guest ratio for optimal group sizes
    // ===================================
    // Calculate total people including plus-ones
    const totalPeople = participants.reduce((sum, p) => {
      return sum + (p.has_plus_one ? 2 : 1);
    }, 0);

    // Calculate optimal number of hosts (target: 7 people per dinner group)
    const optimalHostCount = Math.max(1, Math.ceil(totalPeople / 7));

    let hostsConverted = 0;
    if (hosts.length > optimalHostCount) {
      // Too many hosts! Randomly select who hosts this month
      console.log(`⚡ Demasiados anfitriones: ${hosts.length} disponibles, ${optimalHostCount} necesarios`);

      // Shuffle hosts to randomize who gets selected
      const shuffledHosts = shuffleArray(hosts);

      // Select only the needed hosts
      const selectedHosts = shuffledHosts.slice(0, optimalHostCount);
      const excessHosts = shuffledHosts.slice(optimalHostCount);

      // Convert excess hosts to guests for this month
      guests.push(...excessHosts);
      hosts = selectedHosts;
      hostsConverted = excessHosts.length;

      console.log(`✅ Convertidos ${hostsConverted} anfitriones a invitados para grupos balanceados`);
      console.log(`📊 Nuevos totales: ${hosts.length} anfitriones, ${guests.length} invitados`);
    }

    // ===================================
    // STEP 4: Calculate total capacity
    // ===================================
    const totalHostCapacity = hosts.reduce((sum, host) => {
      const capacity = host.host_max_guests || 5;
      return sum + capacity;
    }, 0);

    const totalGuestsNeeded = guests.reduce((sum, guest) => {
      return sum + (guest.has_plus_one ? 2 : 1);
    }, 0);

    console.log(`Capacidad total de anfitriones: ${totalHostCapacity}`);
    console.log(`Total de invitados (con +1): ${totalGuestsNeeded}`);

    if (totalGuestsNeeded > totalHostCapacity) {
      throw new Error(
        `Insuficiente capacidad de anfitriones. Capacidad: ${totalHostCapacity}, Invitados: ${totalGuestsNeeded}`
      );
    }

    // ===================================
    // STEP 5: Shuffle guests for randomness
    // ===================================
    const shuffledGuests = shuffleArray(guests);

    // Sort guests by dietary complexity to distribute evenly
    const sortedGuests = sortByDietaryComplexity(shuffledGuests);

    console.log("Invitados mezclados y ordenados por complejidad dietética");

    // ===================================
    // STEP 6: Assign guests to hosts (with history awareness)
    // ===================================
    const matches: Array<{
      hostId: string;
      guestIds: string[];
    }> = [];

    // Track which guests have been assigned
    const assignedGuestIds = new Set<string>();

    for (const host of hosts) {
      const maxGuests = host.host_max_guests || 5;
      const assignedGuests: string[] = [];

      let remainingCapacity = maxGuests;
      if (host.has_plus_one) {
        remainingCapacity -= 1; // Reserve space for host's plus-one
      }

      // Get available guests (not yet assigned)
      const availableGuests = sortedGuests.filter((g) => !assignedGuestIds.has(g.id));

      // Sort available guests by novelty (prefer guests who haven't dined with this host)
      const guestsWithNoveltyScore = availableGuests.map((guest) => {
        const hasHistoryWithHost = haveDinedTogether(host.user_id, guest.user_id);

        // Calculate how many of the already-assigned guests in this group
        // this guest has dined with before
        let repeatConnections = 0;
        for (const assignedGuestId of assignedGuests) {
          const assignedGuest = participants.find((p) => p.id === assignedGuestId);
          if (assignedGuest && haveDinedTogether(guest.user_id, assignedGuest.user_id)) {
            repeatConnections++;
          }
        }

        return {
          guest,
          noveltyScore: (hasHistoryWithHost ? -10 : 10) - repeatConnections,
        };
      });

      // Sort by novelty score (higher = more novel connections)
      guestsWithNoveltyScore.sort((a, b) => b.noveltyScore - a.noveltyScore);

      // Assign guests to this host, prioritizing new connections
      for (const { guest } of guestsWithNoveltyScore) {
        if (remainingCapacity <= 0) break;

        const guestSize = guest.has_plus_one ? 2 : 1;

        // Check if guest fits
        if (guestSize <= remainingCapacity) {
          assignedGuests.push(guest.id);
          assignedGuestIds.add(guest.id);
          remainingCapacity -= guestSize;
        }

        // Safety check to prevent overfilling
        if (assignedGuests.length >= maxGuests) {
          break;
        }
      }

      if (assignedGuests.length > 0) {
        matches.push({
          hostId: host.id,
          guestIds: assignedGuests,
        });
        console.log(`Anfitrión ${host.id}: ${assignedGuests.length} invitados asignados`);
      }
    }

    // Check if all guests were assigned
    const unassignedCount = guests.length - assignedGuestIds.size;
    if (unassignedCount > 0) {
      console.warn(`⚠️  ${unassignedCount} invitados no pudieron ser asignados`);
    } else {
      console.log(`✅ Todos los invitados fueron asignados`);
    }

    console.log(`Total de cenas creadas: ${matches.length}`);

    // ===================================
    // STEP 7: Create matches and assignments
    // ===================================
    const matchRecords = [];
    const assignmentRecords = [];

    for (const match of matches) {
      // Create match record
      const { data: matchRecord, error: matchError } = await supabase
        .from("mesa_abierta_matches")
        .insert({
          month_id: monthId,
          host_participant_id: match.hostId,
          dinner_date: monthData.dinner_date,
          dinner_time: monthData.dinner_time,
          guest_count: match.guestIds.length,
        })
        .select()
        .single();

      if (matchError || !matchRecord) {
        console.error(`Error creando match para anfitrión ${match.hostId}:`, matchError);
        continue;
      }

      matchRecords.push(matchRecord);

      // ===================================
      // STEP 8: Assign food responsibilities
      // ===================================
      // Build food assignment list: at least 2 main courses, then salad, drinks, dessert
      const foodAssignments: Array<"main_course" | "salad" | "drinks" | "dessert"> = [];

      // Always assign at least 2 guests to bring main courses
      const numGuests = match.guestIds.length;
      const mainCoursesNeeded = Math.max(2, Math.ceil(numGuests / 3)); // At least 2, or ~1/3 of guests

      for (let i = 0; i < mainCoursesNeeded; i++) {
        foodAssignments.push("main_course");
      }

      // Fill remaining slots with salad, drinks, dessert
      const otherOptions: Array<"salad" | "drinks" | "dessert"> = ["salad", "drinks", "dessert"];
      const shuffledOtherOptions = shuffleArray(otherOptions);

      let otherIndex = 0;
      while (foodAssignments.length < numGuests) {
        foodAssignments.push(shuffledOtherOptions[otherIndex % 3]);
        otherIndex++;
      }

      // Shuffle all food assignments to randomize who gets what
      const shuffledFoodAssignments = shuffleArray(foodAssignments);

      console.log(`Asignaciones de comida para grupo: ${shuffledFoodAssignments.join(", ")}`);

      for (let i = 0; i < match.guestIds.length; i++) {
        const guestId = match.guestIds[i];
        const foodAssignment = shuffledFoodAssignments[i];

        const { data: assignmentRecord, error: assignmentError } = await supabase
          .from("mesa_abierta_assignments")
          .insert({
            match_id: matchRecord.id,
            guest_participant_id: guestId,
            food_assignment: foodAssignment,
          })
          .select()
          .single();

        if (assignmentError) {
          console.error(`Error creando asignación para invitado ${guestId}:`, assignmentError);
          continue;
        }

        assignmentRecords.push(assignmentRecord);
      }

      // Update host participant status to confirmed
      await supabase
        .from("mesa_abierta_participants")
        .update({ status: "confirmed", assigned_role: "host" })
        .eq("id", match.hostId);

      // Update guest participants status to confirmed
      await supabase
        .from("mesa_abierta_participants")
        .update({ status: "confirmed", assigned_role: "guest" })
        .in("id", match.guestIds);
    }

    // ===================================
    // STEP 9: Update month status
    // ===================================
    await supabase
      .from("mesa_abierta_months")
      .update({ status: "matched" })
      .eq("id", monthId);

    console.log("✅ Matching completado exitosamente");

    // ===================================
    // STEP 10: Return results
    // ===================================
    return new Response(
      JSON.stringify({
        success: true,
        message: "Matching completado exitosamente",
        results: {
          totalMatches: matches.length,
          totalParticipants: participants.length,
          hostsUsed: hosts.length,
          hostsConverted: hostsConverted,
          guestsAssigned: assignedGuestIds.size,
          guestsUnassigned: unassignedCount,
          newConnectionsCreated: true, // Historical match avoidance was applied
          matchDetails: matches.map((m, idx) => ({
            matchNumber: idx + 1,
            hostId: m.hostId,
            guestCount: m.guestIds.length,
          })),
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error en match-participants:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error desconocido",
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
