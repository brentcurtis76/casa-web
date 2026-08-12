// Integration tests for the create-mesa-matches request handler.
//
// P3a covers the seam cut in this phase:
//   * The guard chain (OPTIONS -> requireMesaAdmin -> req.json() -> monthId ->
//     month exists -> status open -> deadline -> idempotency) still returns
//     before the first write. Tests 1-4 and 10 assert zero write operations.
//   * The matching goldens — food, capacity in units, redistribution and the
//     waitlist — pin the moved algorithm's observable output.
//
// The Supabase double below is in-memory (D12). No test touches a real
// database and no synthetic row is ever linked to `auth.users`.
//
// Determinism comes from the injected `pick` (D11): with `pick = () => 0`
// every `shuffle` is a pure function of its input, so the goldens assert the
// rule (`referenceShuffle(...)[j % 4]`) rather than a magic string.

import { assertEquals } from "@std/assert";

import { createHandler } from "./handler.ts";

// ---------------------------------------------------------------- fixtures

const MONTH_ID = "month-1";
const AUTH_HEADER = "Bearer test-token";

interface Participant {
  id: string;
  month_id: string;
  role_preference: "host" | "guest";
  has_plus_one: boolean;
  host_max_guests: number | null;
  status: string;
  can_bring_main_dish: boolean;
}

interface Month {
  id: string;
  status: string;
  registration_deadline: string | null;
  dinner_date: string;
  dinner_time: string | null;
}

function makeMonth(overrides: Partial<Month> = {}): Month {
  return {
    id: MONTH_ID,
    status: "open",
    registration_deadline: "2020-01-01T00:00:00.000Z",
    dinner_date: "2026-09-12",
    dinner_time: "19:00:00",
    ...overrides,
  };
}

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

/**
 * Synthetic member columns (D12 — invented, never real). The handler selects
 * `*`, so these do reach it in production; a test that asserts a log line
 * carries no PII has to put PII within reach first.
 */
const PII = {
  full_name: "Ana Fulana",
  email: "ana.fulana@example.invalid",
  phone: "+56 9 8765 4321",
} as const;

/** The same row as the database returns it, PII columns included. */
function withPii(p: Participant): Participant {
  return { ...p, ...PII } as Participant;
}


// ----------------------------------------------------- the Supabase double

type Verb = "getUser" | "select" | "insert" | "update" | "delete";

interface Filter {
  op: "eq" | "in";
  column: string;
  value: unknown;
}

interface Operation {
  table: string;
  verb: Verb;
  filters: Filter[];
  payload?: unknown;
  single: boolean;
}

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

interface DoubleConfig {
  user?: { id: string } | null;
  getUserError?: { message: string } | null;
  adminRole?: { role: string } | null;
  month?: Month | null;
  existingMatches?: Array<{ id: string }>;
  participants?: Participant[];
}

/**
 * Chainable, awaitable stand-in for a supabase-js query builder. Every method
 * the handler calls returns `this`; the builder is a thenable, so awaiting it
 * records the operation and resolves the configured result.
 */
class QueryBuilder {
  private readonly db: FakeSupabase;
  private readonly op: Operation;
  private verbSet = false;

  constructor(db: FakeSupabase, table: string) {
    this.db = db;
    this.op = { table, verb: "select", filters: [], single: false };
  }

  select(_columns?: string): this {
    if (!this.verbSet) {
      this.op.verb = "select";
      this.verbSet = true;
    }
    return this;
  }

  insert(payload: unknown): this {
    this.op.verb = "insert";
    this.op.payload = payload;
    this.verbSet = true;
    return this;
  }

  update(payload: unknown): this {
    this.op.verb = "update";
    this.op.payload = payload;
    this.verbSet = true;
    return this;
  }

  delete(): this {
    this.op.verb = "delete";
    this.verbSet = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.op.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown): this {
    this.op.filters.push({ op: "in", column, value });
    return this;
  }

  single(): this {
    this.op.single = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.db.run(this.op).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  readonly ops: Operation[] = [];
  private readonly cfg: DoubleConfig;
  private matchSeq = 0;

  constructor(cfg: DoubleConfig) {
    this.cfg = cfg;
  }

  readonly auth = {
    getUser: (token: string): Promise<QueryResult> => {
      this.ops.push({
        table: "auth",
        verb: "getUser",
        filters: [{ op: "eq", column: "token", value: token }],
        single: true,
      });
      return Promise.resolve({
        data: { user: this.cfg.user ?? null },
        error: this.cfg.getUserError ?? null,
      });
    },
  };

  from(table: string): QueryBuilder {
    return new QueryBuilder(this, table);
  }

  run(op: Operation): Promise<QueryResult> {
    this.ops.push(op);
    return Promise.resolve(this.resultFor(op));
  }

  /** Operations that mutate. Tests 1-4 and 10 require this to stay empty. */
  writes(): Operation[] {
    return this.ops.filter(
      (o) => o.verb === "insert" || o.verb === "update" || o.verb === "delete",
    );
  }

  private resultFor(op: Operation): QueryResult {
    if (op.verb === "select") {
      switch (op.table) {
        case "mesa_abierta_admin_roles":
          return { data: this.cfg.adminRole ?? null, error: null };
        case "mesa_abierta_months":
          return this.cfg.month
            ? { data: this.cfg.month, error: null }
            : { data: null, error: { message: "no rows" } };
        case "mesa_abierta_matches":
          return { data: this.cfg.existingMatches ?? [], error: null };
        case "mesa_abierta_participants":
          return { data: this.cfg.participants ?? [], error: null };
      }
    }
    if (op.verb === "insert" && op.table === "mesa_abierta_matches") {
      this.matchSeq += 1;
      return { data: { id: `match-${this.matchSeq}` }, error: null };
    }
    return { error: null, count: 1 };
  }
}

// ------------------------------------------------------------- test helpers

interface TableCoverage {
  tableId: string;
  peopleCount: number;
  requiredMainDishes: number;
  willingCarriers: number;
  mainDishCount: number;
  shortfall: number;
}

interface MatchResults {
  totalMatches: number;
  hostsConvertedToGuests: number;
  guestsAssigned: number;
  guestsUnassigned: number;
  unassignedGuests: string[];
  mainDishCoverage: TableCoverage[];
  tablesWithShortfall: Array<{ tableId: string; shortfall: number }>;
}

interface HandlerBody {
  success: boolean;
  error?: string;
  message?: string;
  results?: MatchResults;
}

function makeRequest(
  opts: { method?: string; auth?: boolean; body?: unknown } = {},
): { req: Request; jsonCalls: () => number } {
  const method = opts.method ?? "POST";
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.auth !== false) headers.set("Authorization", AUTH_HEADER);

  const payload = opts.body ?? { monthId: MONTH_ID };
  const req = new Request("http://localhost/create-mesa-matches", {
    method,
    headers,
    body: method === "OPTIONS" ? undefined : JSON.stringify(payload),
  });

  let calls = 0;
  Object.defineProperty(req, "json", {
    value: (): Promise<unknown> => {
      calls += 1;
      return Promise.resolve(payload);
    },
  });

  return { req, jsonCalls: () => calls };
}

/** An admin-authorized double with an open month whose deadline has passed. */
function adminDouble(cfg: DoubleConfig = {}): FakeSupabase {
  return new FakeSupabase({
    user: { id: "user-1" },
    adminRole: { role: "admin" },
    month: makeMonth(),
    ...cfg,
  });
}

function matchInserts(db: FakeSupabase): Array<Record<string, unknown>> {
  return db.ops
    .filter((o) => o.verb === "insert" && o.table === "mesa_abierta_matches")
    .map((o) => o.payload as Record<string, unknown>);
}

function assignmentInserts(db: FakeSupabase): Array<Record<string, unknown>> {
  return db.ops
    .filter((o) => o.verb === "insert" && o.table === "mesa_abierta_assignments")
    .flatMap((o) => o.payload as Array<Record<string, unknown>>);
}

/**
 * The rebalancing fixture, the same one `matching_test.ts` traces: two tables of
 * four guest units where every guest brings a `+1`, hA cannot bring the main
 * dish and neither can g3, g4 or g7. hA lands one main dish short of its quota
 * of two and the bounded search swaps its g3 for one of hB's willing guests.
 */
function swapFixture(): Participant[] {
  return [
    host("hA", 4, true, false),
    host("hB", 4, false, true),
    ...Array.from({ length: 8 }, (_v, i) => {
      const id = `g${i + 1}`;
      return guest(id, true, !["g3", "g4", "g7"].includes(id));
    }),
  ];
}

const EXCLUDED_IDS = ["hA", "g3", "g4", "g7"];

// -------------------------------------------------------- 1-4, 10: guards

Deno.test("OPTIONS 200 sin tocar la base", async () => {
  const db = new FakeSupabase({});
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const { req } = makeRequest({ method: "OPTIONS" });
  const res = await handler(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(db.ops.length, 0);
});

Deno.test("sin admin rechaza antes de leer el body", async () => {
  const db = new FakeSupabase({});
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const { req, jsonCalls } = makeRequest({ auth: false });
  const res = await handler(req);
  const body = await res.json() as HandlerBody;

  assertEquals(res.status, 401);
  assertEquals(body.success, false);
  // The guard runs before the body is read and before any query is issued.
  assertEquals(jsonCalls(), 0);
  assertEquals(db.ops.length, 0);
});

Deno.test("mes fuera de open se rechaza sin escribir", async () => {
  const db = adminDouble({ month: makeMonth({ status: "closed" }) });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;

  assertEquals(res.status, 400);
  assertEquals(body.success, false);
  assertEquals(body.error?.includes("closed"), true);
  assertEquals(db.writes().length, 0);
});

Deno.test("plazo vigente se rechaza sin escribir", async () => {
  const db = adminDouble({
    month: makeMonth({ registration_deadline: "2099-01-01T00:00:00.000Z" }),
  });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;

  assertEquals(res.status, 400);
  assertEquals(body.success, false);
  assertEquals(body.error?.includes("La inscripción aún está abierta"), true);
  assertEquals(db.writes().length, 0);
});

Deno.test("golden: idempotencia sin escribir", async () => {
  const db = adminDouble({
    existingMatches: [{ id: "match-existing" }],
    participants: [host("h1", 5), ...guests(4)],
  });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;

  assertEquals(res.status, 400);
  assertEquals(body.success, false);
  assertEquals(body.error?.includes("Matches already exist"), true);
  assertEquals(db.writes().length, 0);
});

// ------------------------------------------------------------ 5-9: goldens

Deno.test("golden: comida de invitados = guarniciones rotadas desde el offset", async () => {
  // The rule these two goldens pin changed in P4, and only these two.
  //
  // One table of 5 people → `requiredMainDishes = max(1, ceil(5/5)) = 1`, and
  // D7 hands that one to the host, so every guest gets a side. `pick = () => 0`
  // puts the rotation offset at 0 and `SIDE_FOODS` is
  // ["salad","drinks","dessert"], so the four guests take them in order and
  // wrap around: salad, drinks, dessert, salad.
  const db = adminDouble({ participants: [host("h1", 5), ...guests(4)] });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const assignments = assignmentInserts(db);

  assertEquals(assignments.length, 4);
  assertEquals(
    assignments.map((a) => a.food_assignment),
    ["salad", "drinks", "dessert", "salad"],
  );
  // Under the old shuffle a guest drew the main dish here. The quota is 1 and
  // the host took it, so now none of them can.
  assertEquals(
    assignments.some((a) => a.food_assignment === "main_course"),
    false,
  );
});

Deno.test("golden: comida del anfitrión = main_course por D7", async () => {
  // Same table. The host is willing, so it is the first candidate for the
  // table's single main dish (D7) — not a shuffle draw.
  const db = adminDouble({ participants: [host("h1", 5), ...guests(4)] });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const inserts = matchInserts(db);

  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].host_food_assignment, "main_course");
});

Deno.test(
  "golden: capacidad en unidades; el +1 del anfitrión no consume cupo",
  async () => {
    // Host with +1 and capacity 3; one of the three guest signups brings a +1.
    // Guest-side people = 4 and the dinner seats 6, yet only 3 slots are used:
    // capacity counts signups, and the host's own +1 sits on the host side.
    const db = adminDouble({
      participants: [
        host("h1", 3, true),
        guest("g1", true),
        guest("g2"),
        guest("g3"),
      ],
    });
    const handler = createHandler({ supabase: db, pick: () => 0 });

    const res = await handler(makeRequest().req);
    const body = await res.json() as HandlerBody;

    assertEquals(res.status, 200);

    const inserts = matchInserts(db);
    assertEquals(inserts.length, 1);
    assertEquals(inserts[0].guest_count, 3);
    assertEquals(assignmentInserts(db).length, 3);
    assertEquals(body.results?.guestsAssigned, 3);
    assertEquals(body.results?.guestsUnassigned, 0);
  },
);

Deno.test(
  "golden: el segundo pase redistribuye y la mesa parcial se conserva",
  async () => {
    // hA(7) and hB(2) both stay active. The first pass leaves hB with 2 guests
    // (3 people, under MIN_PEOPLE_PER_DINNER) and hA with 6 of its 7 slots
    // used. The second pass moves ONE guest into hA's last free slot; the
    // other cannot be placed and stays as the leftover dinner.
    const db = adminDouble({
      participants: [host("hA", 7), host("hB", 2), ...guests(8)],
    });
    const handler = createHandler({ supabase: db, pick: () => 0 });

    const res = await handler(makeRequest().req);
    assertEquals(res.status, 200);

    const counts = matchInserts(db)
      .map((m) => m.guest_count as number)
      .sort((a, b) => a - b);
    // guest_count is written from assignedGuests.length AFTER redistribution.
    assertEquals(counts, [1, 7]);

    const seated = assignmentInserts(db).map(
      (a) => a.guest_participant_id as string,
    );
    assertEquals(seated.length, 8);
    // No guest was dropped and none ended up in two dinners.
    assertEquals(new Set(seated).size, 8);
  },
);

// ------------------------------------------ 11-14: el plato principal (P4)

Deno.test("la comida proviene del allocator", async () => {
  // Six people at one table → quota 2 (D1), and six willing carriers, so two
  // main dishes are persisted. The old rule could only ever persist one per
  // table: the host drew `shuffle[0]` and the guests `shuffle[j % 4]`.
  const db = adminDouble({ participants: [host("h1", 6), ...guests(5)] });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;
  assertEquals(res.status, 200);

  const persistedFoods = [
    ...matchInserts(db).map((m) => m.host_food_assignment as string),
    ...assignmentInserts(db).map((a) => a.food_assignment as string),
  ];
  assertEquals(persistedFoods.length, 6);
  assertEquals(persistedFoods.filter((f) => f === "main_course").length, 2);
  // Nothing is left without food: `allocateAll` never returns "none".
  assertEquals(persistedFoods.includes("none"), false);

  // ...and the response reports the same numbers it wrote (E2).
  const coverage = body.results?.mainDishCoverage ?? [];
  assertEquals(coverage.length, 1);
  assertEquals(coverage[0].tableId, "h1");
  assertEquals(coverage[0].peopleCount, 6);
  assertEquals(coverage[0].requiredMainDishes, 2);
  assertEquals(coverage[0].mainDishCount, 2);
  assertEquals(body.results?.tablesWithShortfall, []);
});

Deno.test("se persiste el asiento reequilibrado", async () => {
  const db = adminDouble({ participants: swapFixture() });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;
  assertEquals(res.status, 200);

  // The swap did fire: both tables end up covered, and the only way hA gets a
  // second willing carrier is by receiving one.
  assertEquals(body.results?.tablesWithShortfall, []);
  for (const table of body.results?.mainDishCoverage ?? []) {
    assertEquals(table.requiredMainDishes, 2);
    assertEquals(table.mainDishCount, 2);
  }

  // What is persisted is the post-swap seating: g3 sits with hB, not with hA,
  // and the guest that came back the other way sits with hA.
  const assignments = assignmentInserts(db);
  const matchIdOf = (guestId: string): string => {
    const row = assignments.find((a) => a.guest_participant_id === guestId);
    if (!row) throw new Error(`${guestId} no quedó sentado`);
    return row.match_id as string;
  };
  const inserts = matchInserts(db);
  assertEquals(inserts.length, 2);
  // FakeSupabase hands out match ids in insertion order.
  const matchIdByHost = new Map(
    inserts.map((m, i) => [m.host_participant_id as string, `match-${i + 1}`]),
  );
  assertEquals(matchIdOf("g3"), matchIdByHost.get("hB"));
  assertEquals(matchIdOf("g4"), matchIdByHost.get("hA"));

  // Nobody duplicated, nobody lost (G9).
  const seated = assignments.map((a) => a.guest_participant_id as string);
  assertEquals(seated.length, 8);
  assertEquals(new Set(seated).size, 8);
});

Deno.test("guest_count coincide", async () => {
  const db = adminDouble({ participants: swapFixture() });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const inserts = matchInserts(db);
  const assignments = assignmentInserts(db);
  assertEquals(inserts.length, 2);

  // Every match declares as many guests as assignment rows were written for it.
  inserts.forEach((m, i) => {
    const matchId = `match-${i + 1}`;
    const rows = assignments.filter((a) => a.match_id === matchId);
    assertEquals(m.guest_count, rows.length, `${m.host_participant_id}`);
    assertEquals(m.guest_count, 4);
  });
  assertEquals(assignments.length, 8);
});

Deno.test("ningún excluido con main_course persistido", async () => {
  const db = adminDouble({ participants: swapFixture() });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const persisted = [
    ...matchInserts(db).map((m) => ({
      id: m.host_participant_id as string,
      food: m.host_food_assignment as string,
    })),
    ...assignmentInserts(db).map((a) => ({
      id: a.guest_participant_id as string,
      food: a.food_assignment as string,
    })),
  ];

  const excluded = persisted.filter((p) => EXCLUDED_IDS.includes(p.id));
  // The fixture would be vacuous if none of them made it into a dinner.
  assertEquals(excluded.length, EXCLUDED_IDS.length);
  for (const carrier of excluded) {
    assertEquals(
      carrier.food === "main_course",
      false,
      `${carrier.id} está excluido y se persistió con el plato principal`,
    );
  }
});

Deno.test("el déficit real cruza el borde HTTP", async () => {
  // One table of six people → quota 2 (D1), and nobody is willing, so the
  // deficit is 2. With a single table there is no donor to swap with: the
  // shortfall is structural and has to survive all the way to the response,
  // because P6, P7 and P8 read `tablesWithShortfall` from there (D4).
  //
  // The rows carry the PII columns the handler really receives — it selects
  // `*` (`handler.ts:129`) — so the D12 assertion below is not vacuous.
  const db = adminDouble({
    participants: [
      withPii(host("h1", 6, false, false)),
      ...Array.from({ length: 5 }, (_v, i) =>
        withPii(guest(`g${i + 1}`, false, false))),
    ],
  });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  // Los argumentos se guardan CRUDOS. Aplicarles `String()` al capturarlos
  // convertiría un participante en `"[object Object]"` y borraría justo la PII
  // que este test dice vigilar — el agujero que Codex encontró en la r1.
  const warnCalls: unknown[][] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    warnCalls.push(args);
  };

  let body: HandlerBody;
  let status: number;
  try {
    const res = await handler(makeRequest().req);
    status = res.status;
    body = await res.json() as HandlerBody;
  } finally {
    console.warn = realWarn;
  }

  assertEquals(status, 200);

  // The deficit is reported, not swallowed (D4) — the shape P6/P7/P8 consume.
  assertEquals(body.results?.tablesWithShortfall, [{ tableId: "h1", shortfall: 2 }]);

  // ...and the coverage entry agrees with it.
  const coverage = body.results?.mainDishCoverage ?? [];
  assertEquals(coverage.length, 1);
  assertEquals(coverage[0].tableId, "h1");
  assertEquals(coverage[0].peopleCount, 6);
  assertEquals(coverage[0].requiredMainDishes, 2);
  assertEquals(coverage[0].willingCarriers, 0);
  assertEquals(coverage[0].mainDishCount, 0);
  assertEquals(coverage[0].shortfall, 2);

  // D4 avisa exactamente una vez...
  assertEquals(warnCalls.length, 1);

  // ...con UN SOLO argumento y de tipo string. Pasar un participante al logger
  // es precisamente la fuga que D12 prohíbe, así que la forma de la llamada es
  // parte de la garantía, no un detalle.
  assertEquals(warnCalls[0].length, 1);
  assertEquals(typeof warnCalls[0][0], "string");

  // El mensaje ENTERO, no un `includes`: ids y números, y el 2 es el déficit
  // exacto, no un dígito que aparece por casualidad.
  //
  // Esta igualdad es lo que hace cumplir D12, y por eso es exacta y no laxa: las
  // filas del doble llevan PII sintética (`withPii`), así que cualquier fuga
  // —la fila como segundo argumento, o embebida en el propio string— cambia esta
  // llamada y cae aquí. Si algún día hay que relajarla, hay que reemplazar la
  // garantía, no sólo el literal.
  assertEquals(
    warnCalls[0][0],
    "Main dish shortfall on 1 table(s): h1 short 2",
  );
});

Deno.test("golden: sin cupo → lista de espera", async () => {
  const db = adminDouble({ participants: [host("h1", 2), ...guests(6)] });
  const handler = createHandler({ supabase: db, pick: () => 0 });

  const res = await handler(makeRequest().req);
  const body = await res.json() as HandlerBody;

  assertEquals(res.status, 200);
  assertEquals(body.results?.guestsUnassigned, 4);

  const waitlistUpdates = db.ops.filter(
    (o) =>
      o.verb === "update" &&
      o.table === "mesa_abierta_participants" &&
      (o.payload as Record<string, unknown>).status === "waitlist",
  );
  assertEquals(waitlistUpdates.length, 1);

  const filter = waitlistUpdates[0].filters.find((f) => f.column === "id");
  assertEquals((filter?.value as string[]).length, 4);
  assertEquals(body.results?.unassignedGuests.length, 4);
});
