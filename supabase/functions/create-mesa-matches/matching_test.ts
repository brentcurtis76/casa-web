// Unit tests for the pure seating algorithm extracted in this phase.
//
// `matching.ts` performs no I/O, so these tests need no Supabase double, no
// `fetch` and no fixtures linked to `auth.users` (D12) — that is the point of
// extracting it. Everything is asserted on the returned `SeatingPlan`.
//
// Determinism comes from the injected `pick` (D11). `() => 0` is the same
// fixed pick the P3a goldens use, so a scenario traced here matches what the
// handler produces for the same participants.

import { assertEquals } from "@std/assert";

import {
  type HostSeat,
  type Participant,
  type Pick,
  planSeating,
  type SeatingPlan,
} from "./matching.ts";

// ---------------------------------------------------------------- fixtures

const MONTH_ID = "month-1";

/** The minimum the second pass enforces; `matching.ts` keeps it private. */
const MIN_PEOPLE_PER_DINNER = 5;

function host(id: string, maxGuests: number, plusOne = false): Participant {
  return {
    id,
    month_id: MONTH_ID,
    role_preference: "host",
    has_plus_one: plusOne,
    host_max_guests: maxGuests,
    status: "pending",
  };
}

function guest(id: string, plusOne = false): Participant {
  return {
    id,
    month_id: MONTH_ID,
    role_preference: "guest",
    has_plus_one: plusOne,
    host_max_guests: null,
    status: "pending",
  };
}

function guests(n: number): Participant[] {
  return Array.from({ length: n }, (_v, i) => guest(`g${i + 1}`));
}

/** The fixed pick the P3a goldens use. */
const pick0: Pick = () => 0;

/**
 * A deterministic stand-in for `Math.random` (Lehmer / minimal standard), so
 * "same input, same pick" can be tested with a non-constant sequence too.
 * Each call returns a fresh generator, which is what makes two runs comparable.
 */
function seededPick(seed: number): Pick {
  let state = seed;
  return (n: number): number => {
    state = (state * 48271) % 2147483647;
    return state % n;
  };
}

// ------------------------------------------------------------ read helpers

function seatOf(plan: SeatingPlan, id: string): HostSeat {
  const seat = plan.hostStatus.find((h) => h.id === id);
  if (!seat) throw new Error(`host ${id} is not in the plan`);
  return seat;
}

function guestIdsOf(seat: HostSeat): string[] {
  return seat.assignedGuests.map((g) => g.id);
}

function seatedIds(plan: SeatingPlan): string[] {
  return plan.hostStatus.flatMap(guestIdsOf);
}

function unassignedIds(plan: SeatingPlan): string[] {
  return plan.unassignedGuests.map((g) => g.id);
}

/** Everything a second run has to reproduce exactly. */
function summary(plan: SeatingPlan) {
  return {
    hosts: plan.hostStatus.map((h) => ({
      id: h.id,
      guests: guestIdsOf(h),
      currentGuests: h.currentGuests,
      currentGuestPeople: h.currentGuestPeople,
    })),
    unassigned: unassignedIds(plan),
    guestsAssignedCount: plan.guestsAssignedCount,
    converted: plan.hostsConvertedToGuests.map((h) => h.id),
  };
}

// ------------------------------------------------------------------- tests

Deno.test("determinista para pick fija", () => {
  // Fresh inputs and a fresh generator per run: nothing carries over, so any
  // difference would come from the algorithm itself.
  const run = (): SeatingPlan =>
    planSeating(
      [host("h1", 5), host("h2", 4), host("h3", 3)],
      [...guests(9), guest("gp", true)],
      seededPick(7),
    );

  assertEquals(summary(run()), summary(run()));

  const runFixed = (): SeatingPlan =>
    planSeating([host("h1", 5), host("h2", 4)], guests(7), pick0);

  assertEquals(summary(runFixed()), summary(runFixed()));
});

Deno.test("capacidad en unidades", () => {
  // Capacity 3 and three signups, one of them with a +1: four guest-side
  // people occupy three slots, because a slot is a signup and not a person.
  const plan = planSeating(
    [host("h1", 3)],
    [guest("g1", true), guest("g2"), guest("g3")],
    pick0,
  );

  const h1 = seatOf(plan, "h1");
  assertEquals(h1.maxGuests, 3);
  assertEquals(h1.currentGuests, 3);
  assertEquals(h1.currentGuestPeople, 4);
  assertEquals(h1.assignedGuests.length, 3);
  assertEquals(plan.unassignedGuests.length, 0);
});

Deno.test("el +1 del anfitrión no consume cupo", () => {
  // Same capacity 3, but now the HOST brings the +1. All three guest signups
  // still fit: the host's companion sits on the host side.
  const plan = planSeating([host("h1", 3, true)], guests(3), pick0);

  const h1 = seatOf(plan, "h1");
  assertEquals(h1.hostSidePeople, 2);
  assertEquals(h1.maxGuests, 3);
  assertEquals(h1.currentGuests, 3);
  assertEquals(guestIdsOf(h1).sort(), ["g1", "g2", "g3"]);
  assertEquals(plan.unassignedGuests.length, 0);
});

Deno.test("anfitriones sobrantes → invitados", () => {
  // Three hosts, but only one dinner clears the minimum, so two hosts are
  // converted and take guest slots themselves.
  const plan = planSeating(
    [host("h1", 5), host("h2", 5), host("h3", 5)],
    guests(4),
    pick0,
  );

  assertEquals(plan.hostsConvertedToGuests.length, 2);
  assertEquals(plan.hostStatus.filter((h) => h.assignedGuests.length > 0).length, 1);

  const convertedIds = plan.hostsConvertedToGuests.map((h) => h.id);
  const seated = seatedIds(plan);

  // A converted host is a guest now: it is either seated or on the waitlist.
  for (const id of convertedIds) {
    assertEquals(
      seated.includes(id) || unassignedIds(plan).includes(id),
      true,
      `converted host ${id} vanished`,
    );
    // ...and it holds no dinner of its own.
    assertEquals(guestIdsOf(seatOf(plan, id)), []);
    assertEquals(seatOf(plan, id).currentGuests, 0);
  }

  assertEquals(convertedIds.some((id) => seated.includes(id)), true);
});

Deno.test("se elige el mayor número de anfitriones que cumple el mínimo", () => {
  // Nine guest units over three roomy hosts. Two dinners clear the minimum and
  // so does one; the loop must take TWO, the largest that fits, not the first
  // small number that would also work.
  const plan = planSeating(
    [host("h1", 10), host("h2", 10), host("h3", 10)],
    guests(8),
    pick0,
  );

  // hostsToUse is observable as "hosts that were not converted".
  assertEquals(plan.hostStatus.length - plan.hostsConvertedToGuests.length, 2);
  assertEquals(plan.hostsConvertedToGuests.length, 1);
  assertEquals(plan.hostStatus.filter((h) => h.assignedGuests.length > 0).length, 2);
  assertEquals(plan.unassignedGuests.length, 0);
});

Deno.test("el segundo pase redistribuye", () => {
  // hA(10) and hB(2) both stay active. The first pass leaves hB with 2 guests
  // (3 people, under the minimum) and hA with spare slots, so the second pass
  // empties hB completely.
  const plan = planSeating(
    [host("hA", 10), host("hB", 2)],
    guests(8),
    pick0,
  );

  const hA = seatOf(plan, "hA");
  const hB = seatOf(plan, "hB");

  // Read back through hostStatus, not through the pass's own working arrays:
  // this is what breaks if the extraction stops aliasing them.
  assertEquals(hB.assignedGuests.length, 0);
  assertEquals(hB.currentGuests, 0);
  assertEquals(hB.currentGuestPeople, 0);
  assertEquals(hA.assignedGuests.length, 8);
  assertEquals(hA.currentGuests, 8);

  const seated = seatedIds(plan);
  assertEquals(seated.length, 8);
  // No guest was dropped and none ended up in two dinners.
  assertEquals(new Set(seated).size, 8);
  assertEquals(plan.unassignedGuests.length, 0);
});

Deno.test("la última mesa puede quedar bajo el mínimo", () => {
  // Same shape, but hA(7) has only one free slot. One of hB's two guests moves
  // and the other cannot: hB keeps it and stays under the minimum. Intended.
  const plan = planSeating([host("hA", 7), host("hB", 2)], guests(8), pick0);

  const hA = seatOf(plan, "hA");
  const hB = seatOf(plan, "hB");

  assertEquals(hA.assignedGuests.length, 7);
  assertEquals(hB.assignedGuests.length, 1);
  assertEquals(hB.hostSidePeople + hB.currentGuestPeople < MIN_PEOPLE_PER_DINNER, true);

  const seated = seatedIds(plan);
  assertEquals(seated.length, 8);
  assertEquals(new Set(seated).size, 8);
});

Deno.test("el plan incluye la lista de espera", () => {
  // One host with two slots for six guest signups: four come back unassigned.
  const plan = planSeating([host("h1", 2)], guests(6), pick0);

  const seated = seatedIds(plan);
  const waiting = unassignedIds(plan);

  assertEquals(seated.length, 2);
  assertEquals(waiting.length, 4);
  // The two lists partition the six signups; nobody is in both.
  assertEquals(new Set([...seated, ...waiting]).size, 6);
  assertEquals(plan.allGuests.length, 6);
});
