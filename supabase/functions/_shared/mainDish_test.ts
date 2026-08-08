// Conformance suite for the canonical main-dish rule (UPGRADE plan, phase P2).
//
// WHAT THIS SUITE ESTABLISHES
//   * A reusable invariant verifier (`verifyInvariants`) that REPLAYS every
//     returned move from the original input and recomputes people counts, quotas,
//     willing counts and deficits itself. It never trusts a number the module
//     reported; it recomputes it and compares. It covers D5 guarantees
//     1-6, 8 and 9, and EVERY test below calls it, on the result and on each move.
//   * A table of boundary and adversarial fixtures (F1-F11): a table with no
//     willing carrier at all, one where everybody is willing, capacity exactly at
//     the limit, deficits in several tables at once, `+1`s on both sides of a
//     swap, a deficit that is provably unresolvable, and the Codex r2
//     counterexample (1×`+1` traded for 2×solo).
//
// WHAT THIS SUITE DOES NOT ESTABLISH
//   These are examples. A finite set of examples cannot prove a universal
//   "never", and this file does not claim to. In particular D5.6 — every applied
//   swap strictly reduces the total deficit — is established by reading the
//   acceptance condition in `findImprovingSwap`, not by test 12; test 12 only
//   witnesses that the property holds on the fixtures that actually swap.
//   The repo uses no property-based testing framework and P2 did not add one.
//
// Test names are Spanish because the plan wrote them that way. Everything else
// is English.

import { assert, assertEquals } from "@std/assert";

import {
  allocateAll,
  balanceMainDishCarriers,
  requiredMainDishes,
  SIDE_FOODS,
  tablePeopleCount,
} from "./mainDish.ts";
import type {
  AllocationResult,
  Carrier,
  Pick,
  SwapMove,
  TableAllocation,
  TableInput,
} from "./mainDish.ts";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const willing = (id: string, plusOne = false): Carrier => ({
  id,
  hasPlusOne: plusOne,
  canBringMainDish: true,
});

const excluded = (id: string, plusOne = false): Carrier => ({
  id,
  hasPlusOne: plusOne,
  canBringMainDish: false,
});

/**
 * Deterministic `pick` (D11): an LCG, so two runs seeded the same produce the
 * same sequence. Returns an integer in `[0, n)`.
 */
function makePick(seed: number): Pick {
  let state = seed >>> 0;
  return (n: number): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return n <= 0 ? 0 : (state >>> 16) % n;
  };
}

// ---------------------------------------------------------------------------
// Recomputation helpers — deliberately independent of the module's internals.
// They use only `requiredMainDishes` and `tablePeopleCount`, which tests 1 and 2
// pin on their own.
// ---------------------------------------------------------------------------

const carrierPeople = (carrier: Carrier): number => (carrier.hasPlusOne ? 2 : 1);

function willingOf(table: TableInput): number {
  return (table.host.canBringMainDish ? 1 : 0) +
    table.guests.filter((guest) => guest.canBringMainDish).length;
}

function deficitOf(table: TableInput): number {
  return Math.max(0, requiredMainDishes(tablePeopleCount(table)) - willingOf(table));
}

function totalDeficitOf(tables: TableInput[]): number {
  return tables.reduce((sum, table) => sum + deficitOf(table), 0);
}

function cloneTables(tables: TableInput[]): TableInput[] {
  return tables.map((table) => ({ ...table, guests: table.guests.slice() }));
}

function tableIndex(tables: TableInput[], id: string): number {
  const index = tables.findIndex((table) => table.id === id);
  assert(index !== -1, `move refers to unknown table ${id}`);
  return index;
}

/**
 * Removes `ids` from `table.guests`. Every id must be present exactly once — a
 * missing one means the move invented a guest, a repeated one means it moved the
 * same guest twice. Both are the D5.9 failure mode.
 */
function takeGuests(table: TableInput, ids: string[]): { rest: Carrier[]; taken: Carrier[] } {
  const rest = table.guests.slice();
  const taken: Carrier[] = [];
  for (const id of ids) {
    const at = rest.findIndex((guest) => guest.id === id);
    assert(at !== -1, `move takes guest ${id} that is not at table ${table.id}`);
    taken.push(rest.splice(at, 1)[0]);
  }
  return { rest, taken };
}

const peopleIn = (carriers: Carrier[]): number =>
  carriers.reduce((sum, carrier) => sum + carrierPeople(carrier), 0);

/**
 * Replays the moves from the original input and asserts D5.2-D5.6 at each step.
 * Returns every intermediate state: `states[0]` is the input, `states[k]` the
 * state after move `k - 1`.
 */
function replayStates(input: TableInput[], moves: SwapMove[]): TableInput[][] {
  const hostIds = new Set(input.map((table) => table.host.id));
  const states: TableInput[][] = [cloneTables(input)];

  for (const move of moves) {
    const current = states[states.length - 1];
    const r = tableIndex(current, move.receiverTableId);
    const d = tableIndex(current, move.donorTableId);
    assert(r !== d, "a move must involve two different tables");

    // Both sides are non-empty subsets of at most 2 guests (D5.3).
    for (const ids of [move.fromReceiver, move.fromDonor]) {
      assert(ids.length >= 1 && ids.length <= 2, `swap subset of size ${ids.length}`);
      assertEquals(new Set(ids).size, ids.length, "a swap subset repeats a guest");
    }

    // D5.2 — hosts never move.
    for (const id of move.fromReceiver.concat(move.fromDonor)) {
      assert(!hostIds.has(id), `move relocates host ${id}`);
    }

    const receiver = current[r];
    const donor = current[d];
    const fromReceiver = takeGuests(receiver, move.fromReceiver);
    const fromDonor = takeGuests(donor, move.fromDonor);

    // D5.3 — equal people-sums, and the reported number is the real one.
    const receiverPeople = peopleIn(fromReceiver.taken);
    const donorPeople = peopleIn(fromDonor.taken);
    assertEquals(receiverPeople, donorPeople, "swap moves different people counts");
    assertEquals(move.people, receiverPeople, "swap reports the wrong people count");

    const next = current.slice();
    next[r] = { ...receiver, guests: fromReceiver.rest.concat(fromDonor.taken) };
    next[d] = { ...donor, guests: fromDonor.rest.concat(fromReceiver.taken) };

    // D5.3 — neither table's people count changes, so neither quota changes.
    assertEquals(tablePeopleCount(next[r]), tablePeopleCount(receiver));
    assertEquals(tablePeopleCount(next[d]), tablePeopleCount(donor));

    // D5.4 — guest UNITS stay within capacity on both sides.
    assert(next[r].guests.length <= next[r].maxGuestUnits, `${next[r].id} over capacity`);
    assert(next[d].guests.length <= next[d].maxGuestUnits, `${next[d].id} over capacity`);

    // D5.5 — the donor is never left in deficit.
    assertEquals(deficitOf(next[d]), 0, `${next[d].id} left in deficit by a swap`);

    // D5.6 — the reported totals are the real ones and the swap strictly improves.
    const before = totalDeficitOf(current);
    const after = totalDeficitOf(next);
    assertEquals(move.totalDeficitBefore, before);
    assertEquals(move.totalDeficitAfter, after);
    assert(after <= before - 1, `swap did not reduce the total deficit (${before} -> ${after})`);

    states.push(next);
  }

  return states;
}

/** Every carrier of a table, host first — the order `allocateTableFood` reports. */
function carriersOf(table: TableInput): Carrier[] {
  return [table.host].concat(table.guests);
}

function allocatedIds(allocation: TableAllocation): string[] {
  return [allocation.host.carrierId].concat(allocation.guests.map((entry) => entry.carrierId));
}

/**
 * THE REUSABLE INVARIANT VERIFIER (criterion B6).
 *
 * Checks D5 guarantees 1-6, 8 and 9 on `result` and on every move it returned,
 * by replaying the moves from `input` and recomputing everything.
 */
function verifyInvariants(input: TableInput[], result: AllocationResult): void {
  // D5.2-D5.6, per move.
  const states = replayStates(input, result.moves);
  const finalState = states[states.length - 1];

  assertEquals(result.initialTotalDeficit, totalDeficitOf(input), "wrong Δ₀");
  assertEquals(result.tables.length, input.length, "tables appeared or vanished");

  const seen = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    const table = finalState[i];
    const allocation = result.tables[i];
    assertEquals(allocation.tableId, input[i].id, "table order changed");

    // D5.2 — the host of a table is still the host of that table.
    assertEquals(allocation.host.carrierId, input[i].host.id, "the host moved");

    // D5.9, per table — the allocation covers exactly the carriers now seated.
    assertEquals(allocatedIds(allocation), carriersOf(table).map((carrier) => carrier.id));

    const carriers = carriersOf(table);
    assertEquals(allocation.peopleCount, tablePeopleCount(table));
    assertEquals(allocation.requiredMainDishes, requiredMainDishes(tablePeopleCount(table)));
    assertEquals(allocation.willingCarriers, willingOf(table));

    // D5.8 — exactly min(required, willing) main dishes, no fewer.
    const expectedMains = Math.min(allocation.requiredMainDishes, allocation.willingCarriers);
    assertEquals(allocation.mainDishCount, expectedMains, `${table.id}: wrong main dish count`);
    const entries = [allocation.host].concat(allocation.guests);
    const mains = entries.filter((entry) => entry.food === "main_course");
    assertEquals(mains.length, expectedMains, `${table.id}: main dishes handed out ≠ count`);
    assertEquals(allocation.shortfall, allocation.requiredMainDishes - expectedMains);

    // D5.1 — never a main dish for an excluded carrier.
    for (const entry of mains) {
      const carrier = carriers.find((candidate) => candidate.id === entry.carrierId);
      assert(carrier !== undefined, `${entry.carrierId} is not seated at ${table.id}`);
      assert(carrier.canBringMainDish, `${entry.carrierId} was excluded but got the main dish`);
    }

    // D5.9, globally — no duplicates.
    for (const id of allocatedIds(allocation)) {
      assert(!seen.has(id), `${id} appears at two tables`);
      seen.add(id);
    }
  }

  // D5.9, globally — no losses.
  const inputIds = input.flatMap((table) => carriersOf(table).map((carrier) => carrier.id));
  assertEquals(seen.size, inputIds.length, "participants were lost or duplicated");
  for (const id of inputIds) {
    assert(seen.has(id), `${id} disappeared from the allocation`);
  }
}

// ---------------------------------------------------------------------------
// The boundary / adversarial fixture table (D5)
// ---------------------------------------------------------------------------

interface Fixture {
  id: string;
  what: string;
  tables: TableInput[];
}

const FIXTURES: Fixture[] = [
  {
    id: "F1",
    what: "una mesa sin ningún dispuesto — déficit irresoluble, sin otra mesa",
    tables: [{
      id: "F1-T1",
      host: excluded("F1-h1"),
      guests: [excluded("F1-g1"), excluded("F1-g2"), excluded("F1-g3")],
      maxGuestUnits: 4,
    }],
  },
  {
    id: "F2",
    what: "una mesa con todos dispuestos — sobran portadores",
    tables: [{
      id: "F2-T1",
      host: willing("F2-h1"),
      guests: [willing("F2-g1"), willing("F2-g2"), willing("F2-g3"), willing("F2-g4")],
      maxGuestUnits: 6,
    }],
  },
  {
    id: "F3",
    what: "capacidad exactamente al límite en ambas mesas — el intercambio 1×1 cabe justo",
    tables: [
      {
        id: "F3-T1",
        host: excluded("F3-h1"),
        guests: [excluded("F3-g1"), excluded("F3-g2")],
        maxGuestUnits: 2,
      },
      {
        id: "F3-T2",
        host: willing("F3-h2"),
        guests: [willing("F3-g3"), willing("F3-g4")],
        maxGuestUnits: 2,
      },
    ],
  },
  {
    id: "F4",
    what: "déficit simultáneo en dos mesas, una sola mesa donante",
    tables: [
      {
        id: "F4-T1",
        host: excluded("F4-h1"),
        guests: [excluded("F4-g1"), excluded("F4-g2"), excluded("F4-g3")],
        maxGuestUnits: 5,
      },
      {
        id: "F4-T2",
        host: excluded("F4-h2"),
        guests: [excluded("F4-g4"), excluded("F4-g5"), excluded("F4-g6")],
        maxGuestUnits: 5,
      },
      {
        id: "F4-T3",
        host: willing("F4-h3"),
        guests: [willing("F4-g7"), willing("F4-g8"), willing("F4-g9")],
        maxGuestUnits: 5,
      },
    ],
  },
  {
    id: "F5",
    what: "`+1` en ambos lados del intercambio",
    tables: [
      {
        id: "F5-T1",
        host: excluded("F5-h1", true),
        guests: [excluded("F5-g1", true), excluded("F5-g2")],
        maxGuestUnits: 3,
      },
      {
        id: "F5-T2",
        host: willing("F5-h2", true),
        guests: [willing("F5-g3", true), willing("F5-g4")],
        maxGuestUnits: 3,
      },
    ],
  },
  {
    id: "F6",
    what: "contraejemplo de Codex r2: 1×(+1) por 2×solo, con hueco de capacidad",
    tables: [
      {
        id: "F6-T1",
        host: excluded("F6-h1"),
        guests: [excluded("F6-g1", true)],
        maxGuestUnits: 2,
      },
      {
        id: "F6-T2",
        host: willing("F6-h2"),
        guests: [willing("F6-g2"), willing("F6-g3")],
        maxGuestUnits: 2,
      },
    ],
  },
  {
    id: "F7",
    what: "el mismo intercambio 1×(+1) por 2×solo, bloqueado por maxGuestUnits",
    tables: [
      {
        id: "F7-T1",
        host: excluded("F7-h1"),
        guests: [excluded("F7-g1", true)],
        maxGuestUnits: 1,
      },
      {
        id: "F7-T2",
        host: willing("F7-h2"),
        guests: [willing("F7-g2"), willing("F7-g3")],
        maxGuestUnits: 2,
      },
    ],
  },
  {
    id: "F8",
    what: "una mesa con el anfitrión solo",
    tables: [{ id: "F8-T1", host: willing("F8-h1"), guests: [], maxGuestUnits: 4 }],
  },
  {
    id: "F9",
    what: "el anfitrión se excluyó, los invitados no",
    tables: [{
      id: "F9-T1",
      host: excluded("F9-h1"),
      guests: [willing("F9-g1"), willing("F9-g2")],
      maxGuestUnits: 4,
    }],
  },
  {
    id: "F10",
    what: "mesa grande con `+1` en todos — la cuota pide dos platos principales",
    tables: [{
      id: "F10-T1",
      host: willing("F10-h1", true),
      guests: [
        willing("F10-g1", true),
        willing("F10-g2", true),
        willing("F10-g3", true),
        willing("F10-g4", true),
      ],
      maxGuestUnits: 6,
    }],
  },
  {
    id: "F11",
    what: "dos mesas y ningún dispuesto en todo el mes — déficit total irresoluble",
    tables: [
      {
        id: "F11-T1",
        host: excluded("F11-h1"),
        guests: [excluded("F11-g1")],
        maxGuestUnits: 3,
      },
      {
        id: "F11-T2",
        host: excluded("F11-h2"),
        guests: [excluded("F11-g2")],
        maxGuestUnits: 3,
      },
    ],
  },
];

/** Runs every fixture through the whole rule and verifies it before handing it over. */
function eachFixture(visit: (fixture: Fixture, result: AllocationResult) => void): void {
  for (const fixture of FIXTURES) {
    const result = allocateAll(fixture.tables, makePick(20260808));
    verifyInvariants(fixture.tables, result);
    visit(fixture, result);
  }
}

const fixture = (id: string): Fixture => {
  const found = FIXTURES.find((candidate) => candidate.id === id);
  assert(found !== undefined, `unknown fixture ${id}`);
  return found;
};

// ---------------------------------------------------------------------------
// 1-3 — the frozen contract
// ---------------------------------------------------------------------------

Deno.test("[P2 t1] requiredMainDishes: 1-5 => 1, 6-10 => 2, 11-15 => 3", () => {
  for (let people = 1; people <= 5; people++) assertEquals(requiredMainDishes(people), 1);
  for (let people = 6; people <= 10; people++) assertEquals(requiredMainDishes(people), 2);
  for (let people = 11; people <= 15; people++) assertEquals(requiredMainDishes(people), 3);
});

Deno.test("[P2 t2] tablePeopleCount: anfitrión, su +1, invitados y sus +1", () => {
  assertEquals(
    tablePeopleCount({ id: "t", host: willing("h"), guests: [], maxGuestUnits: 4 }),
    1,
  );
  assertEquals(
    tablePeopleCount({ id: "t", host: willing("h", true), guests: [], maxGuestUnits: 4 }),
    2,
  );
  assertEquals(
    tablePeopleCount({
      id: "t",
      host: willing("h", true),
      guests: [willing("g1", true), willing("g2")],
      maxGuestUnits: 4,
    }),
    5,
  );
  // The fixtures are the real cross-check: 4 people at F1, 10 at F10.
  assertEquals(tablePeopleCount(fixture("F1").tables[0]), 4);
  assertEquals(tablePeopleCount(fixture("F10").tables[0]), 10);
});

Deno.test("[P2 t3] SIDE_FOODS no contiene main_course", () => {
  const sides: readonly string[] = SIDE_FOODS;
  assertEquals(sides.includes("main_course"), false);
  assertEquals(sides.length, 3);
  assertEquals([...sides].sort(), ["dessert", "drinks", "salad"]);
});

// ---------------------------------------------------------------------------
// 4-19 — over the fixture table, all invoking the invariant verifier
// ---------------------------------------------------------------------------

Deno.test("[P2 t4][D5.1] nunca asigna main_course a un excluido", () => {
  let excludedCarriersSeen = 0;
  eachFixture((fx, result) => {
    const byId = new Map<string, Carrier>();
    for (const table of fx.tables) {
      for (const carrier of carriersOf(table)) byId.set(carrier.id, carrier);
    }
    for (const allocation of result.tables) {
      for (const entry of [allocation.host].concat(allocation.guests)) {
        const carrier = byId.get(entry.carrierId);
        assert(carrier !== undefined, `${entry.carrierId} is not an input carrier`);
        if (!carrier.canBringMainDish) {
          excludedCarriersSeen += 1;
          assert(
            entry.food !== "main_course",
            `${fx.id}: excluded ${entry.carrierId} got the main dish`,
          );
        }
      }
    }
  });
  // Not vacuous: the fixtures really do contain excluded carriers.
  assert(excludedCarriersSeen > 0, "no excluded carrier in the fixture table");
});

Deno.test("[P2 t5][D5.1] no elige al anfitrión si se excluyó", () => {
  let excludedHostsSeen = 0;
  eachFixture((fx, result) => {
    for (let i = 0; i < fx.tables.length; i++) {
      if (fx.tables[i].host.canBringMainDish) continue;
      excludedHostsSeen += 1;
      assertEquals(result.tables[i].host.carrierId, fx.tables[i].host.id);
      assert(
        result.tables[i].host.food !== "main_course",
        `${fx.id}: excluded host ${fx.tables[i].host.id} got the main dish`,
      );
    }
  });
  assert(excludedHostsSeen > 0, "no excluded host in the fixture table");
  // F9 pins the interesting shape: host excluded, guests willing, quota still met.
  const f9 = allocateAll(fixture("F9").tables, makePick(1));
  verifyInvariants(fixture("F9").tables, f9);
  assertEquals(f9.tables[0].host.food !== "main_course", true);
  assertEquals(f9.tables[0].mainDishCount, 1);
  assertEquals(f9.tablesWithShortfall, []);
});

Deno.test("[P2 t6] prefiere al anfitrión cuando puede (D7)", () => {
  let willingHostsSeen = 0;
  eachFixture((fx, result) => {
    for (let i = 0; i < fx.tables.length; i++) {
      // Hosts never move (D5.2), so the input host is still this table's host.
      if (!fx.tables[i].host.canBringMainDish) continue;
      willingHostsSeen += 1;
      assertEquals(
        result.tables[i].host.food,
        "main_course",
        `${fx.id}: willing host ${fx.tables[i].host.id} was passed over`,
      );
    }
  });
  assert(willingHostsSeen > 0, "no willing host in the fixture table");
});

Deno.test("[P2 t7] todo portador sin main_course recibe acompañamiento, nunca none", () => {
  const sides: readonly string[] = SIDE_FOODS;
  let sidesSeen = 0;
  eachFixture((fx, result) => {
    for (const allocation of result.tables) {
      for (const entry of [allocation.host].concat(allocation.guests)) {
        if (entry.food === "main_course") continue;
        sidesSeen += 1;
        assert(entry.food !== "none", `${fx.id}: ${entry.carrierId} got "none"`);
        assert(sides.includes(entry.food), `${fx.id}: ${entry.carrierId} got ${entry.food}`);
      }
    }
  });
  assert(sidesSeen > 0, "no side dish handed out in the fixture table");
});

Deno.test("[P2 t8][D5.2] nunca mueve a un anfitrión", () => {
  eachFixture((fx, result) => {
    const hostIds = new Set(fx.tables.map((table) => table.host.id));
    for (const move of result.moves) {
      for (const id of move.fromReceiver.concat(move.fromDonor)) {
        assert(!hostIds.has(id), `${fx.id}: move relocates host ${id}`);
      }
    }
    for (let i = 0; i < fx.tables.length; i++) {
      assertEquals(result.tables[i].host.carrierId, fx.tables[i].host.id);
    }
  });
});

Deno.test("[P2 t9][D5.3] todo intercambio conserva el número de personas de ambas mesas", () => {
  let movesSeen = 0;
  eachFixture((fx, result) => {
    const states = replayStates(fx.tables, result.moves);
    for (let k = 0; k < result.moves.length; k++) {
      movesSeen += 1;
      const move = result.moves[k];
      const before = states[k];
      const after = states[k + 1];
      for (const id of [move.receiverTableId, move.donorTableId]) {
        assertEquals(
          tablePeopleCount(after[tableIndex(after, id)]),
          tablePeopleCount(before[tableIndex(before, id)]),
          `${fx.id}: ${id} changed people count`,
        );
      }
      // Equal people-sums on both sides is what makes that possible.
      assert(move.people >= 1);
    }
  });
  assert(movesSeen > 0, "no swap was applied over the whole fixture table");
});

Deno.test("[P2 t10][D5.4] todo intercambio respeta maxGuestUnits en ambas mesas", () => {
  eachFixture((fx, result) => {
    const states = replayStates(fx.tables, result.moves);
    for (const state of states) {
      for (const table of state) {
        assert(
          table.guests.length <= table.maxGuestUnits,
          `${fx.id}: ${table.id} holds ${table.guests.length} units, max ${table.maxGuestUnits}`,
        );
      }
    }
    for (const table of balanceMainDishCarriers(fx.tables).tables) {
      assert(table.guests.length <= table.maxGuestUnits);
    }
  });
  // F7 is F6 with one unit less of headroom: the only improving swap is refused,
  // so the deficit stands rather than the capacity being broken.
  const f7 = allocateAll(fixture("F7").tables, makePick(7));
  verifyInvariants(fixture("F7").tables, f7);
  assertEquals(f7.moves, []);
  assertEquals(f7.tablesWithShortfall, [{ tableId: "F7-T1", shortfall: 1 }]);
});

Deno.test("[P2 t11][D5.5] ningún intercambio deja a la donante en déficit", () => {
  let movesSeen = 0;
  eachFixture((fx, result) => {
    const states = replayStates(fx.tables, result.moves);
    for (let k = 0; k < result.moves.length; k++) {
      movesSeen += 1;
      const after = states[k + 1];
      const donor = after[tableIndex(after, result.moves[k].donorTableId)];
      assertEquals(deficitOf(donor), 0, `${fx.id}: donor ${donor.id} left in deficit`);
    }
  });
  assert(movesSeen > 0, "no swap was applied over the whole fixture table");
  // F11 is the fixture that shows the rule biting: two deficit tables and no
  // willing carrier anywhere, so no swap can leave a donor at zero.
  const f11 = allocateAll(fixture("F11").tables, makePick(11));
  verifyInvariants(fixture("F11").tables, f11);
  assertEquals(f11.moves, []);
  assertEquals(f11.initialTotalDeficit, 2);
});

Deno.test("[P2 t12][D5.6] todo intercambio aplicado reduce el déficit total en al menos 1", () => {
  let movesSeen = 0;
  eachFixture((fx, result) => {
    const states = replayStates(fx.tables, result.moves);
    for (let k = 0; k < result.moves.length; k++) {
      movesSeen += 1;
      const before = totalDeficitOf(states[k]);
      const after = totalDeficitOf(states[k + 1]);
      assert(after <= before - 1, `${fx.id}: swap ${k} went ${before} -> ${after}`);
      assertEquals(result.moves[k].totalDeficitBefore, before);
      assertEquals(result.moves[k].totalDeficitAfter, after);
    }
  });
  // The universal is established by reading the acceptance condition, not here;
  // this only records that the fixtures exercise it at all.
  assert(movesSeen > 0, "no swap was applied over the whole fixture table");
});

Deno.test("[P2 t13][D5.7] termina: nunca aplica más de Δ₀ intercambios", () => {
  eachFixture((fx, result) => {
    assertEquals(result.initialTotalDeficit, totalDeficitOf(fx.tables));
    assert(
      result.moves.length <= result.initialTotalDeficit,
      `${fx.id}: ${result.moves.length} swaps for Δ₀ = ${result.initialTotalDeficit}`,
    );
  });
  // F4 is the fixture that reaches the bound: Δ₀ = 2, two swaps, deficit cleared.
  const f4 = allocateAll(fixture("F4").tables, makePick(4));
  verifyInvariants(fixture("F4").tables, f4);
  assertEquals(f4.initialTotalDeficit, 2);
  assertEquals(f4.moves.length, 2);
  assertEquals(f4.tablesWithShortfall, []);
});

Deno.test("[P2 t14][D5.8] cada mesa asigna exactamente min(requeridos, dispuestos) platos principales", () => {
  eachFixture((fx, result) => {
    const balanced = balanceMainDishCarriers(fx.tables).tables;
    for (let i = 0; i < balanced.length; i++) {
      const expected = Math.min(
        requiredMainDishes(tablePeopleCount(balanced[i])),
        willingOf(balanced[i]),
      );
      assertEquals(result.tables[i].mainDishCount, expected, `${fx.id}: ${balanced[i].id}`);
      const entries = [result.tables[i].host].concat(result.tables[i].guests);
      assertEquals(entries.filter((entry) => entry.food === "main_course").length, expected);
    }
  });
});

Deno.test("[P2 t15][D5.8] una mesa con dispuestos de sobra no deja platos sin asignar", () => {
  const f2 = allocateAll(fixture("F2").tables, makePick(2));
  verifyInvariants(fixture("F2").tables, f2);
  assertEquals(f2.tables[0].willingCarriers, 5);
  assertEquals(f2.tables[0].requiredMainDishes, 1);
  assertEquals(f2.tables[0].mainDishCount, 1);
  assertEquals(f2.tablesWithShortfall, []);

  // F10 is the same shape one quota step up: 10 people, 5 willing, 2 main dishes.
  const f10 = allocateAll(fixture("F10").tables, makePick(10));
  verifyInvariants(fixture("F10").tables, f10);
  assertEquals(f10.tables[0].requiredMainDishes, 2);
  assertEquals(f10.tables[0].willingCarriers, 5);
  assertEquals(f10.tables[0].mainDishCount, 2);
  assertEquals(f10.tablesWithShortfall, []);

  eachFixture((fx, result) => {
    for (const allocation of result.tables) {
      if (allocation.willingCarriers < allocation.requiredMainDishes) continue;
      assertEquals(allocation.shortfall, 0, `${fx.id}: ${allocation.tableId}`);
      assertEquals(allocation.mainDishCount, allocation.requiredMainDishes);
    }
  });
});

Deno.test("[P2 t16][D5.9] el conjunto de invitados se conserva: sin duplicados", () => {
  eachFixture((fx, result) => {
    const seen = new Set<string>();
    for (const allocation of result.tables) {
      for (const id of allocatedIds(allocation)) {
        assert(!seen.has(id), `${fx.id}: ${id} appears twice`);
        seen.add(id);
      }
    }
    const balanced = balanceMainDishCarriers(fx.tables).tables;
    const guestIds = balanced.flatMap((table) => table.guests.map((guest) => guest.id));
    assertEquals(new Set(guestIds).size, guestIds.length, `${fx.id}: a guest sits twice`);
  });
});

Deno.test("[P2 t17][D5.9] el conjunto de invitados se conserva: sin pérdidas", () => {
  eachFixture((fx, result) => {
    const before = fx.tables.flatMap((table) => table.guests.map((guest) => guest.id)).sort();
    const balanced = balanceMainDishCarriers(fx.tables).tables;
    const after = balanced.flatMap((table) => table.guests.map((guest) => guest.id)).sort();
    assertEquals(after, before, `${fx.id}: the guest set changed`);

    const allocated = result.tables.flatMap((allocation) => allocatedIds(allocation)).sort();
    const everyone = fx.tables
      .flatMap((table) => carriersOf(table).map((carrier) => carrier.id))
      .sort();
    assertEquals(allocated, everyone, `${fx.id}: somebody is missing from the allocation`);
  });
});

Deno.test("[P2 t18][D5.10] toda mesa bajo cuota aparece en tablesWithShortfall con su shortfall", () => {
  eachFixture((fx, result) => {
    const expected = result.tables
      .filter((allocation) => allocation.shortfall > 0)
      .map((allocation) => ({ tableId: allocation.tableId, shortfall: allocation.shortfall }));
    assertEquals(result.tablesWithShortfall, expected, `${fx.id}: shortfall report mismatch`);
    for (const entry of result.tablesWithShortfall) {
      assert(entry.shortfall > 0, `${fx.id}: ${entry.tableId} reported a shortfall of 0`);
    }
  });
  // The three fixtures whose deficit is genuinely unresolvable report it.
  const f1 = allocateAll(fixture("F1").tables, makePick(1));
  verifyInvariants(fixture("F1").tables, f1);
  assertEquals(f1.tablesWithShortfall, [{ tableId: "F1-T1", shortfall: 1 }]);

  const f11 = allocateAll(fixture("F11").tables, makePick(11));
  verifyInvariants(fixture("F11").tables, f11);
  assertEquals(f11.tablesWithShortfall, [
    { tableId: "F11-T1", shortfall: 1 },
    { tableId: "F11-T2", shortfall: 1 },
  ]);

  const f7 = allocateAll(fixture("F7").tables, makePick(7));
  verifyInvariants(fixture("F7").tables, f7);
  assertEquals(f7.tablesWithShortfall, [{ tableId: "F7-T1", shortfall: 1 }]);
});

Deno.test("[P2 t19][D5.11] misma entrada y misma pick ⇒ mismo resultado · y resuelve el contraejemplo de Codex r2 (1×(+1) ↔ 2×solo)", () => {
  for (const fx of FIXTURES) {
    const first = allocateAll(fx.tables, makePick(20260808));
    const second = allocateAll(fx.tables, makePick(20260808));
    verifyInvariants(fx.tables, first);
    verifyInvariants(fx.tables, second);
    assertEquals(first, second, `${fx.id}: two identical runs diverged`);
  }
  // A different `pick` may legitimately choose different carriers, but the
  // structural outcome — how many main dishes, and the shortfall — must not move.
  for (const fx of FIXTURES) {
    const a = allocateAll(fx.tables, makePick(1));
    const b = allocateAll(fx.tables, makePick(999));
    verifyInvariants(fx.tables, a);
    verifyInvariants(fx.tables, b);
    assertEquals(
      a.tables.map((allocation) => allocation.mainDishCount),
      b.tables.map((allocation) => allocation.mainDishCount),
    );
    assertEquals(a.tablesWithShortfall, b.tablesWithShortfall);
  }

  // Codex r2's counterexample. Equal people-sums do NOT imply equal guest units:
  // one guest with a `+1` (2 people, 1 unit) trades for two solo guests
  // (2 people, 2 units). The swap is only legal because F6-T1 has the spare unit.
  const f6 = allocateAll(fixture("F6").tables, makePick(6));
  verifyInvariants(fixture("F6").tables, f6);
  assertEquals(f6.moves.length, 1);
  const move = f6.moves[0];
  assertEquals(move.receiverTableId, "F6-T1");
  assertEquals(move.donorTableId, "F6-T2");
  assertEquals(move.fromReceiver, ["F6-g1"]);
  assertEquals(move.fromDonor, ["F6-g2", "F6-g3"]);
  assertEquals(move.people, 2);
  assertEquals(move.totalDeficitBefore, 1);
  assertEquals(move.totalDeficitAfter, 0);
  assertEquals(f6.tablesWithShortfall, []);

  const balanced = balanceMainDishCarriers(fixture("F6").tables).tables;
  assertEquals(balanced[0].guests.map((guest) => guest.id), ["F6-g2", "F6-g3"]);
  assertEquals(balanced[1].guests.map((guest) => guest.id), ["F6-g1"]);
  assertEquals(balanced[0].guests.length, 2);
  assertEquals(balanced[0].maxGuestUnits, 2);
});
