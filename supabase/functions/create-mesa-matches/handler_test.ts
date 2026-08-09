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
const FOODS = ["main_course", "salad", "drinks", "dessert"];

interface Participant {
  id: string;
  month_id: string;
  role_preference: "host" | "guest";
  has_plus_one: boolean;
  host_max_guests: number | null;
  status: string;
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

/**
 * The rule tests 5 and 6 assert against, implemented independently of the
 * handler so a change to the handler's own `shuffle` makes them diverge.
 */
function referenceShuffle<T>(array: T[], pick: (n: number) => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

interface MatchResults {
  totalMatches: number;
  hostsConvertedToGuests: number;
  guestsAssigned: number;
  guestsUnassigned: number;
  unassignedGuests: string[];
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

Deno.test("golden: comida de invitados = shuffle([...4])[j % 4]", async () => {
  const pick = () => 0;
  const db = adminDouble({ participants: [host("h1", 5), ...guests(4)] });
  const handler = createHandler({ supabase: db, pick });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const expected = referenceShuffle(FOODS, pick);
  const assignments = assignmentInserts(db);

  assertEquals(assignments.length, 4);
  assignments.forEach((a, j) => {
    assertEquals(a.food_assignment, expected[j % FOODS.length]);
  });
});

Deno.test("golden: comida del anfitrión = shuffle([...4])[0]", async () => {
  const pick = () => 0;
  const db = adminDouble({ participants: [host("h1", 5), ...guests(4)] });
  const handler = createHandler({ supabase: db, pick });

  const res = await handler(makeRequest().req);
  assertEquals(res.status, 200);

  const expected = referenceShuffle(FOODS, pick);
  const inserts = matchInserts(db);

  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].host_food_assignment, expected[0]);
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
