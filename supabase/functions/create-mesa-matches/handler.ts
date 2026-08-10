/**
 * CASA La Mesa Abierta — create-mesa-matches request handler.
 *
 * Extracted from `index.ts` so it can be imported by tests without starting a
 * server or reading the environment. `index.ts` is the only place that
 * constructs production dependencies and starts the HTTP server.
 *
 * The matching logic is a verbatim move: the guard order (OPTIONS ->
 * requireMesaAdmin -> req.json() -> monthId -> month exists -> status open ->
 * deadline -> idempotency -> participants) and every write are unchanged.
 * The only injected seam is `pick`, which `shuffle` uses in place of
 * `Math.random` so tests can make the shuffles deterministic.
 *
 * The seating decision itself lives in `matching.ts` (D13): this file reads the
 * participants, calls `planSeating`, and writes the result. As of P4 the food
 * comes from there too — `matching.ts` delegates it to `_shared/mainDish.ts`,
 * the canonical rule (D6). Nothing here decides who brings what.
 */

import { requireMesaAdmin } from "../_shared/adminAuth.ts";
import { planSeating } from "./matching.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Use `any` for the client to stay compatible with multiple
// @supabase/supabase-js versions imported across edge functions.
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface HandlerDeps {
  supabase: SupabaseLike;
  /** Returns an integer in [0, n). Defaults to Math.random (D11). */
  pick?: (n: number) => number;
}

export function createHandler(
  deps: HandlerDeps,
): (req: Request) => Promise<Response> {
  const supabase = deps.supabase;
  const pick = deps.pick ?? ((n: number) => Math.floor(Math.random() * n));

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const authResult = await requireMesaAdmin(req, supabase, corsHeaders);
      if (!authResult.ok) return authResult.response;

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

      if (month.registration_deadline) {
        const deadlineMs = new Date(month.registration_deadline).getTime();
        if (deadlineMs > Date.now()) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `La inscripción aún está abierta hasta ${month.registration_deadline}. Baja la fecha límite primero si quieres cerrar antes.`,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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

      // Get all participants awaiting matching. Users sign up as 'pending', but
      // admins can manually set 'confirmed' in the edit dialog before matching runs.
      // Including 'confirmed' is safe: the idempotency check above guarantees no
      // matches exist for this month, so none of them are seated yet.
      const { data: participants, error: participantsError } = await supabase
        .from("mesa_abierta_participants")
        .select("*")
        .eq("month_id", monthId)
        .in("status", ["pending", "confirmed"]);

      if (participantsError) {
        throw new Error(`Failed to fetch participants: ${participantsError.message}`);
      }

      if (!participants || participants.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No participants available for matching this month (statuses 'pending' or 'confirmed')",
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

      // The seating decision — how many dinners, who sits where, who waits —
      // lives in `matching.ts` (D13). It is pure: the same participants and the
      // same `pick` give the same plan.
      const {
        hostStatus,
        unassignedGuests,
        guestsAssignedCount,
        hostsConvertedToGuests,
        allGuests,
        dinners,
        mainDishCoverage,
        tablesWithShortfall,
      } = planSeating(hosts, guests, pick);

      // D4 — a deficit is reported, never resolved in silence. Ids only: no
      // member PII reaches a log line.
      if (tablesWithShortfall.length > 0) {
        console.warn(
          `Main dish shortfall on ${tablesWithShortfall.length} table(s): ` +
            tablesWithShortfall
              .map((t) => `${t.tableId} short ${t.shortfall}`)
              .join(", "),
        );
      }

      // Track created matches for potential rollback
      const createdMatchIds: string[] = [];
      const matches: Array<{matchId: string; hostId: string; guestCount: number; totalPeople: number; guests: string[]}> = [];

      try {
        // Create DB records for matches and assignments. Every dinner carries
        // its own guests and their food in one object, so the row that says
        // who sits here and the row that says what they bring cannot drift.
        for (const dinner of dinners) {
          const host = dinner.host;

          const { data: match, error: matchError } = await supabase
            .from("mesa_abierta_matches")
            .insert({
              month_id: monthId,
              host_participant_id: host.id,
              dinner_date: month.dinner_date,
              dinner_time: month.dinner_time || "19:00:00",
              guest_count: dinner.guests.length,
              host_food_assignment: dinner.hostFood,
            })
            .select()
            .single();

          if (matchError) {
            throw new Error(`Failed to create match: ${matchError.message}`);
          }

          createdMatchIds.push(match.id);
          console.log(`Created match ${match.id} with host ${host.id} and ${dinner.guests.length} guest units (${host.currentGuestPeople} people)`);

          // Batch create assignments for this match
          const assignmentsToInsert = dinner.guests.map((seated) => ({
            match_id: match.id,
            guest_participant_id: seated.participant.id,
            food_assignment: seated.food,
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
            guestCount: dinner.guests.length,
            totalPeople: host.hostSidePeople + host.currentGuestPeople,
            guests: dinner.guests.map((seated) => seated.participant.id),
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
            unassignedGuests: unassignedGuests.map(g => g.id),
            // D4 / D14: coverage is reported, never persisted as an aggregate
            // column. P6, P7 and P8 read it from here.
            mainDishCoverage,
            tablesWithShortfall,
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
  };
}
