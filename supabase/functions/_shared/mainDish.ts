// Canonical main-dish allocation rule for La Mesa Abierta (UPGRADE plan: D1, D5,
// D6, D7, D11).
//
// What this module IS: the single place that decides, for tables that are already
// formed, who brings the main dish and who brings a side. It is a LEAF — zero
// imports, no Deno API, no browser API, no framework — because both the edge
// functions and the front end import it (D6).
//
// What this module is NOT: a matcher. It never decides who sits with whom. The
// only movement it performs is a bounded local search that swaps guests between
// tables when that is the way to cover a main-dish quota (D5).
//
// Randomness enters exclusively through the injected `pick` (D11). This file
// calls no random-number generator of its own, by design: the same input and the
// same `pick` must give the same result (D5.11). Criterion B2 greps for that.
//
// The eleven guarantees of D5 are named G1…G11 at the places that establish them.

/**
 * A food assignment as stored in `mesa_abierta_assignments.food_assignment` and
 * `mesa_abierta_matches.host_food_assignment`. `"none"` exists in the database
 * enum and is therefore part of the type, but this module never produces it:
 * every carrier gets either the main dish or a side.
 */
export type Food = "main_course" | "salad" | "drinks" | "dessert" | "none";

/** Everything that is not the main dish. */
export type SideFood = "salad" | "drinks" | "dessert";

/**
 * The sides, in the rotation order this module uses. D5 leaves the order to P2;
 * this is the order of the database enum with `main_course` removed. It never
 * contains `main_course` — that is the point of the constant.
 */
export const SIDE_FOODS: readonly SideFood[] = ["salad", "drinks", "dessert"];

/** Someone who signed up and may carry food: a table's host, or one of its guests. */
export interface Carrier {
  /** `mesa_abierta_participants.id`. Unique across the whole allocation. */
  id: string;
  /** Brings a companion: counts as 2 people, but still 1 guest unit. */
  hasPlusOne: boolean;
  /** D2 polarity is positive: `true` means "can bring the main dish". */
  canBringMainDish: boolean;
}

/** One dinner table, already matched: a fixed host plus the guests assigned to it. */
export interface TableInput {
  id: string;
  /** G2: hosts never move between tables. */
  host: Carrier;
  guests: Carrier[];
  /** Capacity in guest UNITS — one signup is one unit, `+1` included. Never people. */
  maxGuestUnits: number;
}

/**
 * Injected source of randomness (D11). `pick(n)` returns an integer in `[0, n)`.
 * It is never called with `n <= 0`.
 */
export type Pick = (n: number) => number;

/** One applied swap. Every field is what the swap actually did, for verification. */
export interface SwapMove {
  /** The table in deficit the swap was meant to help. */
  receiverTableId: string;
  /** The counterpart. G5 forbids leaving it in deficit. */
  donorTableId: string;
  /** Guest ids leaving the receiver: 1 or 2 of them. */
  fromReceiver: string[];
  /** Guest ids leaving the donor: 1 or 2 of them. */
  fromDonor: string[];
  /** People each side carries. Equal by G3 — that is why it is one number. */
  people: number;
  totalDeficitBefore: number;
  totalDeficitAfter: number;
}

export interface BalanceResult {
  /** The tables after rebalancing, in the input's order. */
  tables: TableInput[];
  moves: SwapMove[];
  /** Δ₀, the total deficit before any swap. G7 bounds `moves.length` by it. */
  initialTotalDeficit: number;
}

export interface CarrierFood {
  carrierId: string;
  food: Food;
}

export interface TableAllocation {
  tableId: string;
  /** Host + host's `+1` + each guest + each guest's `+1` (D1). */
  peopleCount: number;
  /** `max(1, ceil(peopleCount / 5))` (D1). */
  requiredMainDishes: number;
  /** Carriers at this table with `canBringMainDish === true`, host included. */
  willingCarriers: number;
  host: CarrierFood;
  guests: CarrierFood[];
  /** `min(requiredMainDishes, willingCarriers)` — G8. */
  mainDishCount: number;
  /** `requiredMainDishes - mainDishCount`. Never negative. */
  shortfall: number;
}

export interface TableShortfall {
  tableId: string;
  shortfall: number;
}

export interface AllocationResult {
  tables: TableAllocation[];
  moves: SwapMove[];
  initialTotalDeficit: number;
  /** G10: every table under quota, with its shortfall. Never silently dropped (D4). */
  tablesWithShortfall: TableShortfall[];
}

/**
 * D1 — the quota, chosen by Brent and identical in P2, P4, P6, P7 and P8.
 * `1-5 => 1`, `6-10 => 2`, `11-15 => 3`.
 */
export function requiredMainDishes(peopleCount: number): number {
  return Math.max(1, Math.ceil(peopleCount / 5));
}

/** D1 — the host, the host's `+1`, every guest and every guest's `+1`. */
export function tablePeopleCount(table: TableInput): number {
  let people = carrierPeople(table.host);
  for (const guest of table.guests) {
    people += carrierPeople(guest);
  }
  return people;
}

function carrierPeople(carrier: Carrier): number {
  return carrier.hasPlusOne ? 2 : 1;
}

function willingCarrierCount(table: TableInput): number {
  let willing = table.host.canBringMainDish ? 1 : 0;
  for (const guest of table.guests) {
    if (guest.canBringMainDish) willing += 1;
  }
  return willing;
}

/** How many main dishes this table is short of its quota. Never negative. */
function tableDeficit(table: TableInput): number {
  return Math.max(0, requiredMainDishes(tablePeopleCount(table)) - willingCarrierCount(table));
}

function totalDeficit(tables: TableInput[]): number {
  let total = 0;
  for (const table of tables) {
    total += tableDeficit(table);
  }
  return total;
}

/**
 * Guest index subsets of size 1 and 2, in a fixed order: every single index
 * ascending, then every pair in lexicographic order. D5 leaves this order to P2;
 * fixing it here is what makes the search deterministic (G11).
 */
function guestSubsets(guestCount: number): number[][] {
  const subsets: number[][] = [];
  for (let i = 0; i < guestCount; i++) {
    subsets.push([i]);
  }
  for (let i = 0; i < guestCount; i++) {
    for (let j = i + 1; j < guestCount; j++) {
      subsets.push([i, j]);
    }
  }
  return subsets;
}

function subsetPeople(guests: Carrier[], indices: number[]): number {
  let people = 0;
  for (const index of indices) {
    people += carrierPeople(guests[index]);
  }
  return people;
}

/**
 * A copy of `table` with `leavingIndices` removed and the guests at
 * `incomingIndices` of `incomingPool` appended. Stayers keep their relative
 * order and arrivals go at the end — deterministic, and the host is untouched
 * because it is not part of `guests` at all (G2).
 */
function swappedTable(
  table: TableInput,
  leavingIndices: number[],
  incomingPool: Carrier[],
  incomingIndices: number[],
): TableInput {
  const guests: Carrier[] = [];
  for (let i = 0; i < table.guests.length; i++) {
    if (leavingIndices.indexOf(i) === -1) guests.push(table.guests[i]);
  }
  for (const index of incomingIndices) {
    guests.push(incomingPool[index]);
  }
  return { ...table, guests };
}

interface SwapCandidate {
  receiverIndex: number;
  donorIndex: number;
  receiverGuestIndices: number[];
  donorGuestIndices: number[];
  record: SwapMove;
}

/**
 * The first swap the traversal accepts, or `null` if the whole scan finds none.
 *
 * Traversal order, all of it P2's choice (D5 leaves it open): deficit tables in
 * input order, counterpart tables in input order, then the subset orders of
 * `guestSubsets`. First acceptable candidate wins; the caller then rescans from
 * the top because the deficits have changed.
 *
 * The acceptance condition is the conjunction of the five `continue`s below and
 * the final comparison. Read together they are exactly G3, G4, G5 and G6.
 */
function findImprovingSwap(tables: TableInput[]): SwapCandidate | null {
  const before = totalDeficit(tables);

  for (let r = 0; r < tables.length; r++) {
    const receiver = tables[r];
    if (tableDeficit(receiver) === 0) continue;
    const receiverSubsets = guestSubsets(receiver.guests.length);

    for (let d = 0; d < tables.length; d++) {
      if (d === r) continue;
      const donor = tables[d];
      const donorSubsets = guestSubsets(donor.guests.length);

      for (const receiverIndices of receiverSubsets) {
        const people = subsetPeople(receiver.guests, receiverIndices);

        for (const donorIndices of donorSubsets) {
          // G3 — equal people-sums, so neither table's people count changes and
          // therefore neither table's quota changes.
          if (subsetPeople(donor.guests, donorIndices) !== people) continue;

          const nextReceiver = swappedTable(receiver, receiverIndices, donor.guests, donorIndices);
          const nextDonor = swappedTable(donor, donorIndices, receiver.guests, receiverIndices);

          // G4 — capacity is in guest units, and a swap of equal people-sums can
          // still change the unit count (1×`+1` for 2×solo is the standing
          // counterexample), so both sides are re-checked.
          if (nextReceiver.guests.length > nextReceiver.maxGuestUnits) continue;
          if (nextDonor.guests.length > nextDonor.maxGuestUnits) continue;

          // G5 — never solve one table's deficit by creating another's.
          if (tableDeficit(nextDonor) !== 0) continue;

          // G6 — only these two tables changed, so the new total is the old one
          // with their two contributions replaced.
          const after = before
            - tableDeficit(receiver) - tableDeficit(donor)
            + tableDeficit(nextReceiver) + tableDeficit(nextDonor);
          if (after > before - 1) continue;

          return {
            receiverIndex: r,
            donorIndex: d,
            receiverGuestIndices: receiverIndices,
            donorGuestIndices: donorIndices,
            record: {
              receiverTableId: receiver.id,
              donorTableId: donor.id,
              fromReceiver: receiverIndices.map((i) => receiver.guests[i].id),
              fromDonor: donorIndices.map((i) => donor.guests[i].id),
              people,
              totalDeficitBefore: before,
              totalDeficitAfter: after,
            },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Bounded local search over guest swaps, to cover as much of the main-dish quota
 * as the acceptance condition allows.
 *
 * This is not exhaustive and does not claim to be: D5 requires that an
 * unresolved deficit be reported (G10), not that every resolvable one be found.
 * The input is never mutated — every table and every guest list is rebuilt.
 */
export function balanceMainDishCarriers(tables: TableInput[]): BalanceResult {
  const working: TableInput[] = tables.map((table) => ({ ...table, guests: table.guests.slice() }));
  const moves: SwapMove[] = [];
  const initialTotalDeficit = totalDeficit(working);

  // G7 — termination. Each accepted swap drops the total deficit by at least 1
  // (G6) and the total is a non-negative integer, so at most Δ₀ swaps can ever
  // be accepted. `budget` states that bound in the loop instead of leaving it as
  // a comment; the scan below already stops on its own the first time it finds
  // nothing acceptable.
  let budget = initialTotalDeficit;
  while (budget > 0) {
    const candidate = findImprovingSwap(working);
    if (candidate === null) break;

    const receiver = working[candidate.receiverIndex];
    const donor = working[candidate.donorIndex];
    working[candidate.receiverIndex] = swappedTable(
      receiver,
      candidate.receiverGuestIndices,
      donor.guests,
      candidate.donorGuestIndices,
    );
    working[candidate.donorIndex] = swappedTable(
      donor,
      candidate.donorGuestIndices,
      receiver.guests,
      candidate.receiverGuestIndices,
    );

    moves.push(candidate.record);
    budget -= 1;
  }

  return { tables: working, moves, initialTotalDeficit };
}

/**
 * D11 says `pick(n)` returns an integer in `[0, n)`, but `pick` is injected by
 * the caller, so a broken one must not make this module index out of range.
 * Never called with `length <= 0`.
 */
function boundedIndex(value: number, length: number): number {
  if (!(value >= 0)) return 0; // also catches NaN
  const index = Math.floor(value);
  return index >= length ? length - 1 : index;
}

/**
 * Food for one table, taking its guest list as final. Assigns exactly
 * `min(requiredMainDishes, willingCarriers)` main dishes (G8) and a side to
 * everyone else — never `"none"`.
 *
 * `pick` is called in this order, and only this order: zero or more draws from
 * the willing-guest pool, then exactly one draw for the side rotation offset.
 */
export function allocateTableFood(table: TableInput, pick: Pick): TableAllocation {
  const peopleCount = tablePeopleCount(table);
  const required = requiredMainDishes(peopleCount);
  const willing = willingCarrierCount(table);
  const mainDishCount = Math.min(required, willing); // G8

  const mainDishIds: string[] = [];
  let remaining = mainDishCount;

  // D7 — the host is the first candidate when able. G1 holds here because the
  // condition is the carrier's own flag.
  if (remaining > 0 && table.host.canBringMainDish) {
    mainDishIds.push(table.host.id);
    remaining -= 1;
  }

  // G1 — the pool is built from willing guests only, so an excluded carrier can
  // never be drawn, whatever `pick` returns.
  const pool: Carrier[] = table.guests.filter((guest) => guest.canBringMainDish);
  while (remaining > 0 && pool.length > 0) {
    const chosen = pool.splice(boundedIndex(pick(pool.length), pool.length), 1)[0];
    mainDishIds.push(chosen.id);
    remaining -= 1;
  }

  // Sides rotate from a `pick`-chosen offset. This is what
  // create-mesa-matches/index.ts already does with a shuffle plus `j % n`, minus
  // the shuffle.
  const offset = boundedIndex(pick(SIDE_FOODS.length), SIDE_FOODS.length);
  let sidesHandedOut = 0;
  const foodFor = (carrier: Carrier): Food => {
    if (mainDishIds.indexOf(carrier.id) !== -1) return "main_course";
    const side = SIDE_FOODS[(offset + sidesHandedOut) % SIDE_FOODS.length];
    sidesHandedOut += 1;
    return side;
  };

  const host: CarrierFood = { carrierId: table.host.id, food: foodFor(table.host) };
  const guests: CarrierFood[] = [];
  for (const guest of table.guests) {
    guests.push({ carrierId: guest.id, food: foodFor(guest) });
  }

  return {
    tableId: table.id,
    peopleCount,
    requiredMainDishes: required,
    willingCarriers: willing,
    host,
    guests,
    mainDishCount,
    shortfall: required - mainDishCount,
  };
}

/**
 * The whole rule: rebalance, then allocate food table by table, then report
 * whatever deficit is left (G10, D4).
 *
 * `pick` is consumed table by table in the order of `tables`.
 */
export function allocateAll(tables: TableInput[], pick: Pick): AllocationResult {
  const balanced = balanceMainDishCarriers(tables);
  const allocations: TableAllocation[] = [];
  const tablesWithShortfall: TableShortfall[] = [];

  for (const table of balanced.tables) {
    const allocation = allocateTableFood(table, pick);
    allocations.push(allocation);
    if (allocation.shortfall > 0) {
      tablesWithShortfall.push({ tableId: allocation.tableId, shortfall: allocation.shortfall });
    }
  }

  return {
    tables: allocations,
    moves: balanced.moves,
    initialTotalDeficit: balanced.initialTotalDeficit,
    tablesWithShortfall,
  };
}
