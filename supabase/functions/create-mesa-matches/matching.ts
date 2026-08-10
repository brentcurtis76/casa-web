/**
 * CASA La Mesa Abierta — the pure seating decision for create-mesa-matches.
 *
 * Extracted verbatim from `handler.ts` (the seam P3a cut) so that "how many
 * dinners do we hold and who sits at each one" can be exercised without a
 * Supabase client, a server or the environment. `handler.ts` keeps the HTTP
 * guards, the reads and the writes; this module reads nothing and writes
 * nothing.
 *
 * Randomness enters exclusively through the injected `pick` (D11) — this file
 * calls no random-number generator of its own, so the same input and the same
 * `pick` give the same plan (D13).
 *
 * Food IS decided here, as of P4, but not by this file: `_shared/mainDish.ts`
 * owns the canonical rule (D6) and this module only feeds it the tables and
 * folds the answer back into the seating. That is the single import; D1e
 * forbids `@supabase/supabase-js` and `Deno.env` here, not imports in general,
 * and `mainDish.ts` is itself a pure leaf.
 */

import {
  allocateAll,
  type Food,
  type SwapMove,
  type TableInput,
  type TableShortfall,
} from "../_shared/mainDish.ts";

/**
 * Injected source of randomness (D11). `pick(n)` returns an integer in `[0, n)`.
 */
export type Pick = (n: number) => number;

/**
 * A `mesa_abierta_participants` row, narrowed to what the seating actually
 * reads. Production rows carry more columns (the handler selects `*`); naming
 * only the ones used here is what keeps this module free of the client's
 * typing, and it is the same shape the P3a goldens feed in.
 */
export interface Participant {
  id: string;
  month_id: string;
  role_preference: "host" | "guest";
  has_plus_one: boolean;
  host_max_guests: number | null;
  status: string;
  /** D2 polarity is positive: `true` means "can bring the main dish". */
  can_bring_main_dish: boolean;
}

/** A host plus the running state the two seating passes mutate. */
export interface HostSeat extends Participant {
  /** Count of guest units (signups) assigned. */
  currentGuests: number;
  /** Count of guest-side people (guests + their +1s). */
  currentGuestPeople: number;
  maxGuests: number;
  /** How many people on the host side (1 or 2). */
  hostSidePeople: number;
  assignedGuests: Participant[];
}

/** One seated guest and the food they were allocated. */
export interface SeatedGuest {
  participant: Participant;
  food: Food;
}

/**
 * A dinner that will be written: one host, its food, and its guests with
 * theirs — all of it post-rebalance.
 *
 * Seating and food travel together on purpose. `allocateAll` moves guests
 * between tables, so a write path that read the guest list from one object and
 * the food from another would tell someone to bring the salad to a dinner they
 * are not sitting at, with every count still adding up.
 */
export interface Dinner {
  host: HostSeat;
  hostFood: Food;
  guests: SeatedGuest[];
}

/** Main-dish coverage for one seated table. Ids and numbers only — no PII. */
export interface TableCoverage {
  /** The table is its host: `mesa_abierta_participants.id`. */
  tableId: string;
  /** Host + host's `+1` + each guest + each guest's `+1` (D1). */
  peopleCount: number;
  /** `max(1, ceil(peopleCount / 5))` (D1). */
  requiredMainDishes: number;
  /** Carriers at this table willing to bring it, host included. */
  willingCarriers: number;
  /** How many were actually handed out. */
  mainDishCount: number;
  /** `requiredMainDishes - mainDishCount`. Never negative. */
  shortfall: number;
}

/** Everything the write path in `handler.ts` consumes from the decision. */
export interface SeatingPlan {
  /** Every host, active and waitlisted, after both passes and the rebalance. */
  hostStatus: HostSeat[];
  /** Guest units left without a seat; these go to the waitlist. */
  unassignedGuests: Participant[];
  /** Guest-side people seated, recomputed after redistribution. */
  guestsAssignedCount: number;
  /** Hosts beyond `hostsToUse`; they are seated as guests instead. */
  hostsConvertedToGuests: HostSeat[];
  /** The original guests plus the converted hosts. */
  allGuests: Participant[];
  /** The dinners to write, in the order they should be written. */
  dinners: Dinner[];
  /** One entry per dinner, in the same order. */
  mainDishCoverage: TableCoverage[];
  /** G10 / D4: every table under quota. A deficit is reported, never swallowed. */
  tablesWithShortfall: TableShortfall[];
  /** The swaps the rebalance applied, in order. Empty when none was needed. */
  mainDishMoves: SwapMove[];
}

/**
 * Decide the dinners. Pure: mutates neither `hosts` nor `guests`.
 *
 * `activeHosts` and `waitlistHosts` are views into the same objects as
 * `hostStatus` — `.slice()` copies the array, not the elements — and the
 * redistribution pass mutates through them. That aliasing is load-bearing.
 */
export function planSeating(
  hosts: Participant[],
  guests: Participant[],
  pick: Pick,
): SeatingPlan {
  // Shuffle arrays for random assignment
  const shuffledHosts = shuffle([...hosts], pick);
  const shuffledGuests = shuffle([...guests], pick);

  // Host capacity counts guest SIGNUPS (units), not people. The signup form
  // promises hosts "Con acompañantes, podrían ser hasta {maxGuests * 2} personas",
  // so a guest with +1 consumes one slot, not two.
  const totalCapacity = shuffledHosts.reduce((sum, host) => sum + (host.host_max_guests || 5), 0);

  // Calculate total guest count (including plus ones)
  const totalGuestCount = shuffledGuests.reduce((sum, guest) => sum + (guest.has_plus_one ? 2 : 1), 0);

  console.log(`Total Host Capacity: ${totalCapacity} guest slots, Total Guests: ${shuffledGuests.length} units (${totalGuestCount} people with +1s)`);

  if (totalCapacity < shuffledGuests.length) {
    console.warn("Warning: Not enough host capacity for all guests!");
  }

  // Minimum people per dinner (including host, host's +1, guests, and guest +1s)
  const MIN_PEOPLE_PER_DINNER = 5;
  // Target guest-side people per dinner for good dinner sizes
  // Aiming for 6 ensures dinners of 7-8 people (host + maybe +1 + 6 guests)
  // This creates fewer, fuller dinners rather than many small ones
  const TARGET_GUEST_SIDE_FOR_DINNER = 6;

  // Initialize host tracking. Capacity is in guest units (signups); the host's
  // own +1 sits on the host side and does not consume a guest slot.
  const hostStatus = shuffledHosts.map(host => {
    const hostPlusOne = host.has_plus_one ? 1 : 0;
    // Host side people = host (1) + host's +1 if applicable
    const hostSidePeople = 1 + hostPlusOne;
    return {
      ...host,
      currentGuests: 0, // Count of guest units (signups) assigned
      currentGuestPeople: 0, // Count of guest-side people (guests + their +1s)
      maxGuests: host.host_max_guests || 5,
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
    const converted = hostStatus.slice(numHosts);
    const convertedPeople = converted.reduce((sum, h) => sum + (h.has_plus_one ? 2 : 1), 0);
    const guestPeopleAvailable = totalGuestCount + convertedPeople;
    const guestUnitsAvailable = shuffledGuests.length + converted.length;
    const guestsNeededForMinimum = numHosts * MIN_GUESTS_PER_DINNER; // in people
    const activeHostCapacity = hostStatus.slice(0, numHosts).reduce((sum, h) => sum + h.maxGuests, 0); // in units

    console.log(`Testing ${numHosts} hosts: need ${guestsNeededForMinimum} guest-side people for minimum, have ${guestPeopleAvailable}; capacity ${activeHostCapacity} slots for ${guestUnitsAvailable} guest units`);

    // Check both: enough guest-side people for minimum AND enough slots for all guest units
    if (guestPeopleAvailable >= guestsNeededForMinimum && activeHostCapacity >= guestUnitsAvailable) {
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
    const guestPeople = guest.has_plus_one ? 2 : 1;
    let assigned = false;

    // Sort active hosts by % full to distribute evenly
    activeHosts.sort((a, b) => (a.currentGuests / a.maxGuests) - (b.currentGuests / b.maxGuests));

    for (const host of activeHosts) {
      // One signup = one slot, regardless of +1
      if (host.currentGuests + 1 <= host.maxGuests) {
        host.assignedGuests.push(guest);
        host.currentGuests += 1;
        host.currentGuestPeople += guestPeople;
        assigned = true;
        guestsAssignedCount += guestPeople;
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
    const totalPeople = host.hostSidePeople + host.currentGuestPeople;
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

    for (const guest of guestsToRedistribute) {
      const guestPeople = guest.has_plus_one ? 2 : 1;

      // Sort hosts with enough people by available slots (most free slots first)
      hostsWithEnough.sort((a, b) => (b.maxGuests - b.currentGuests) - (a.maxGuests - a.currentGuests));

      for (const targetHost of hostsWithEnough) {
        if (targetHost.currentGuests + 1 <= targetHost.maxGuests) {
          // Move guest to target host — and remove from the small host immediately,
          // so a partial redistribution never leaves a guest in two dinners
          targetHost.assignedGuests.push(guest);
          targetHost.currentGuests += 1;
          targetHost.currentGuestPeople += guestPeople;
          smallHost.assignedGuests = smallHost.assignedGuests.filter(g => g.id !== guest.id);
          smallHost.currentGuests -= 1;
          smallHost.currentGuestPeople -= guestPeople;
          break;
        }
      }
    }

    if (smallHost.assignedGuests.length === 0) {
      console.log(`Redistributed all guests from host ${smallHost.id} to other dinners`);
    } else {
      // Could not redistribute all guests - this becomes the "leftover" dinner
      // Keep the remaining assignments (allowed exception for last dinner)
      console.log(`Host ${smallHost.id} keeps ${smallHost.assignedGuests.length} guests as leftover dinner (${smallHost.hostSidePeople + smallHost.currentGuestPeople} total people)`);
    }
  }

  // Merge activeHosts back into hostStatus for the rest of the logic
  // Clear waitlist hosts' assignments (they shouldn't have any)
  for (const host of waitlistHosts) {
    host.assignedGuests = [];
    host.currentGuests = 0;
    host.currentGuestPeople = 0;
  }

  // Third pass: the main dish. `allocateAll` may move guests between tables to
  // cover a quota, so this has to run before the totals are read back — the
  // seating it returns is the seating that gets persisted.
  const { dinners, mainDishCoverage, tablesWithShortfall, mainDishMoves } =
    allocateMainDish(hostStatus, allGuests, pick);

  // Recalculate totals after redistribution
  guestsAssignedCount = activeHosts.reduce((sum, h) => sum + h.currentGuestPeople, 0);
  console.log(`After redistribution: Assigned ${guestsAssignedCount} guest-side people.`);

  return {
    hostStatus,
    unassignedGuests,
    guestsAssignedCount,
    hostsConvertedToGuests,
    allGuests,
    dinners,
    mainDishCoverage,
    tablesWithShortfall,
    mainDishMoves,
  };
}

/** The part of the plan `allocateMainDish` produces. */
interface MainDishOutcome {
  dinners: Dinner[];
  mainDishCoverage: TableCoverage[];
  tablesWithShortfall: TableShortfall[];
  mainDishMoves: SwapMove[];
}

/**
 * Hand the seated tables to `_shared/mainDish.ts` and fold its answer back in.
 *
 * A host with no guests is not a dinner — `handler.ts` has always skipped it —
 * so it is not a table either, and it neither draws from `pick` nor appears in
 * the coverage.
 *
 * `hostStatus` is MUTATED here, deliberately: the rebalance is the final word on
 * who sits where, and the participant updates downstream (`assigned_role`,
 * `status`) read the same guest lists the assignments were written from.
 */
function allocateMainDish(
  hostStatus: HostSeat[],
  allGuests: Participant[],
  pick: Pick,
): MainDishOutcome {
  const seatedHosts = hostStatus.filter((h) => h.assignedGuests.length > 0);

  const tables: TableInput[] = seatedHosts.map((host) => ({
    id: host.id,
    host: {
      id: host.id,
      hasPlusOne: host.has_plus_one,
      canBringMainDish: host.can_bring_main_dish,
    },
    guests: host.assignedGuests.map((guest) => ({
      id: guest.id,
      hasPlusOne: guest.has_plus_one,
      canBringMainDish: guest.can_bring_main_dish,
    })),
    maxGuestUnits: host.maxGuests,
  }));

  const allocation = allocateAll(tables, pick);

  // Guests can arrive from another table, so the lookup spans every seated
  // participant, not just this host's previous list.
  const byId = new Map<string, Participant>();
  for (const guest of allGuests) byId.set(guest.id, guest);

  const hostById = new Map<string, HostSeat>();
  for (const host of seatedHosts) hostById.set(host.id, host);

  const dinners: Dinner[] = [];

  for (const table of allocation.tables) {
    // A table IS its host (G2: hosts never move), so `tableId` is the host id.
    const host = hostById.get(table.tableId);
    if (!host) {
      throw new Error(`Allocator returned unknown table ${table.tableId}`);
    }

    const guests: SeatedGuest[] = table.guests.map((carrier) => {
      const participant = byId.get(carrier.carrierId);
      if (!participant) {
        throw new Error(`Allocator returned unknown guest ${carrier.carrierId}`);
      }
      return { participant, food: carrier.food };
    });

    host.assignedGuests = guests.map((g) => g.participant);
    host.currentGuests = guests.length;
    host.currentGuestPeople = guests.reduce(
      (sum, g) => sum + (g.participant.has_plus_one ? 2 : 1),
      0,
    );

    dinners.push({ host, hostFood: table.host.food, guests });
  }

  return {
    dinners,
    mainDishCoverage: allocation.tables.map((table) => ({
      tableId: table.tableId,
      peopleCount: table.peopleCount,
      requiredMainDishes: table.requiredMainDishes,
      willingCarriers: table.willingCarriers,
      mainDishCount: table.mainDishCount,
      shortfall: table.shortfall,
    })),
    tablesWithShortfall: allocation.tablesWithShortfall,
    mainDishMoves: allocation.moves,
  };
}

// Fisher-Yates shuffle algorithm for random array shuffling
export function shuffle<T>(array: T[], pick: (n: number) => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
