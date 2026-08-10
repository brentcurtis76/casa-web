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
  type Dinner,
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

function host(
  id: string,
  maxGuests: number,
  plusOne = false,
  canBringMainDish = true,
): Participant {
  return {
    id,
    month_id: MONTH_ID,
    role_preference: "host",
    has_plus_one: plusOne,
    host_max_guests: maxGuests,
    status: "pending",
    can_bring_main_dish: canBringMainDish,
  };
}

function guest(id: string, plusOne = false, canBringMainDish = true): Participant {
  return {
    id,
    month_id: MONTH_ID,
    role_preference: "guest",
    has_plus_one: plusOne,
    host_max_guests: null,
    status: "pending",
    can_bring_main_dish: canBringMainDish,
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

/** Everything a second run has to reproduce exactly, food included. */
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
    dinners: plan.dinners.map((d) => ({
      host: d.host.id,
      hostFood: d.hostFood,
      guests: d.guests.map((g) => [g.participant.id, g.food]),
    })),
    coverage: plan.mainDishCoverage,
    shortfall: plan.tablesWithShortfall,
    moves: plan.mainDishMoves,
  };
}

/** Every carrier at a dinner — the host first, then its guests — with its food. */
function carriersOf(dinner: Dinner): Array<{ participant: Participant; food: string }> {
  return [
    { participant: dinner.host, food: dinner.hostFood },
    ...dinner.guests.map((g) => ({ participant: g.participant, food: g.food as string })),
  ];
}

function coverageOf(plan: SeatingPlan, tableId: string) {
  const entry = plan.mainDishCoverage.find((c) => c.tableId === tableId);
  if (!entry) throw new Error(`table ${tableId} is not in the coverage`);
  return entry;
}

/**
 * The fixture the two rebalancing tests share, traced against `mainDish.ts`
 * before it was asserted on.
 *
 * Two tables of four guest units, every guest with a `+1`. The first pass gives
 * hA {g4*, g7*, g8, g3*} and hB {g5, g6, g1, g2} (`*` = excluded). hA is ten
 * people — quota 2 — with a single willing carrier, so it starts one main dish
 * short; hB is nine people with five willing carriers and can spare one. The
 * bounded search swaps hA's g3* for hB's g2, both worth two people (G3), and
 * the total deficit goes 1 → 0.
 */
const SWAP_HOSTS = (): Participant[] => [
  host("hA", 4, true, false),
  host("hB", 4, false, true),
];

const SWAP_GUESTS = (): Participant[] =>
  Array.from({ length: 8 }, (_v, i) => {
    const id = `g${i + 1}`;
    return guest(id, true, !["g3", "g4", "g7"].includes(id));
  });

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

// ------------------------------------------------- P4: el plato principal

Deno.test("cuota por mesa", () => {
  // One table of six people — host plus five guest units, everybody willing.
  // D1: max(1, ceil(6 / 5)) = 2, and with six willing carriers both get handed
  // out. The old rule gave this table one main course by accident of a shuffle.
  const plan = planSeating([host("h1", 6)], guests(5), pick0);

  const coverage = coverageOf(plan, "h1");
  assertEquals(coverage.peopleCount, 6);
  assertEquals(coverage.requiredMainDishes, 2);
  assertEquals(coverage.willingCarriers, 6);
  assertEquals(coverage.mainDishCount, 2);
  assertEquals(coverage.shortfall, 0);

  assertEquals(plan.dinners.length, 1);
  const mains = carriersOf(plan.dinners[0]).filter((c) => c.food === "main_course");
  assertEquals(mains.length, 2);
  assertEquals(plan.tablesWithShortfall, []);
});

Deno.test("nunca a un excluido", () => {
  // Three of the eight guests cannot bring it, and neither can hA. D3: the
  // algorithm never assigns them the main dish, whatever the quota says.
  const plan = planSeating(SWAP_HOSTS(), SWAP_GUESTS(), pick0);

  const excluded = plan.dinners
    .flatMap(carriersOf)
    .filter((c) => !c.participant.can_bring_main_dish);

  // The fixture would be vacuous if nobody were excluded.
  assertEquals(excluded.length, 4);
  for (const carrier of excluded) {
    assertEquals(
      carrier.food === "main_course",
      false,
      `${carrier.participant.id} está excluido y recibió el plato principal`,
    );
  }
});

Deno.test("reporta shortfall", () => {
  // One table, ten people (host + four guest units, all with a +1) so the quota
  // is 2, and a single willing carrier among them. Nothing to swap with, so the
  // deficit is real — and D4 says it is reported, not silently resolved.
  const plan = planSeating(
    [host("h1", 5, true, false)],
    [
      guest("g1", true, false),
      guest("g2", true, false),
      guest("g3", true, false),
      guest("g4", true, true),
    ],
    pick0,
  );

  const coverage = coverageOf(plan, "h1");
  assertEquals(coverage.peopleCount, 10);
  assertEquals(coverage.requiredMainDishes, 2);
  assertEquals(coverage.willingCarriers, 1);
  assertEquals(coverage.mainDishCount, 1);
  assertEquals(coverage.shortfall, 1);

  assertEquals(plan.tablesWithShortfall, [{ tableId: "h1", shortfall: 1 }]);
  // The one main dish that could be handed out was handed out: a shortfall is
  // not an excuse to under-assign (G8).
  const mains = carriersOf(plan.dinners[0]).filter((c) => c.food === "main_course");
  assertEquals(mains.length, 1);
  assertEquals(mains[0].participant.id, "g4");
});

Deno.test("el reequilibrio se refleja en los invitados", () => {
  const inputGuests = SWAP_GUESTS();
  const plan = planSeating(SWAP_HOSTS(), inputGuests, pick0);

  // A swap actually fired — without this the rest of the test is vacuous.
  assertEquals(plan.mainDishMoves.length, 1);
  const move = plan.mainDishMoves[0];
  assertEquals(move.totalDeficitAfter < move.totalDeficitBefore, true);

  // `hostStatus` carries the POST-swap lists, not the ones the second pass left.
  for (const dinner of plan.dinners) {
    assertEquals(guestIdsOf(seatOf(plan, dinner.host.id)), dinner.guests.map((g) => g.participant.id));
    assertEquals(seatOf(plan, dinner.host.id).currentGuests, dinner.guests.length);
  }
  // The swapped-in guest sits where the move says, and the swapped-out one left.
  const receiver = seatOf(plan, move.receiverTableId);
  const receiverIds = guestIdsOf(receiver);
  assertEquals(receiverIds.includes(move.fromDonor[0]), true);
  assertEquals(receiverIds.includes(move.fromReceiver[0]), false);

  // G9 — the global guest set is conserved: nobody duplicated, nobody lost.
  const seated = seatedIds(plan);
  assertEquals(seated.length, 8);
  assertEquals(new Set(seated).size, 8);
  assertEquals([...seated].sort(), inputGuests.map((g) => g.id).sort());
  assertEquals(plan.unassignedGuests.length, 0);

  // G2 — hosts never move: each still holds its own table and sits at no other.
  assertEquals(plan.dinners.map((d) => d.host.id).sort(), ["hA", "hB"]);
  assertEquals(seated.some((id) => id === "hA" || id === "hB"), false);
});

Deno.test("se respeta el mínimo tras el reequilibrio", () => {
  const plan = planSeating(SWAP_HOSTS(), SWAP_GUESTS(), pick0);

  assertEquals(plan.mainDishMoves.length, 1);

  // G3 keeps each table's people count exactly, so a dinner that cleared
  // MIN_PEOPLE_PER_DINNER before the swap still clears it afterwards.
  for (const dinner of plan.dinners) {
    const seat = seatOf(plan, dinner.host.id);
    const people = seat.hostSidePeople + seat.currentGuestPeople;
    assertEquals(people >= MIN_PEOPLE_PER_DINNER, true, `${dinner.host.id} quedó bajo el mínimo`);
    // The allocator counted the same people the seating did.
    assertEquals(coverageOf(plan, dinner.host.id).peopleCount, people);
  }
  assertEquals(plan.guestsAssignedCount, 16);
});

Deno.test("determinista con comida", () => {
  // Same participants and same `pick` ⇒ same plan, food and coverage included.
  const runFixed = (): SeatingPlan => planSeating(SWAP_HOSTS(), SWAP_GUESTS(), pick0);
  assertEquals(summary(runFixed()), summary(runFixed()));

  const runSeeded = (): SeatingPlan =>
    planSeating(
      [host("h1", 5), host("h2", 4, false, false), host("h3", 3)],
      [...guests(9), guest("gp", true, false)],
      seededPick(7),
    );
  assertEquals(summary(runSeeded()), summary(runSeeded()));
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
