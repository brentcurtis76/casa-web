/**
 * ChildrenActivityDialog — "materiales disponibles" wiring (Phase M3b).
 *
 * TOPOLOGY ([A10]). The plan ALLOWS UI-state scenarios to stub the collaborator
 * service modules; this suite does not need that permission and does not use
 * it. The ONLY mocked modules in the whole file are
 * `@/integrations/supabase/client` and `@/hooks/use-toast`, so every test — not
 * just the [A4] equality proof — drives the REAL `publishChildrenActivities`,
 * the REAL `materialsList`, the REAL `lessonService` / `calendarService` /
 * `childrenPublicationStateService` / `ageGroupService` / `inventoryService`
 * chain. The "persisted" content asserted below is therefore the JSON the real
 * `lessonService` handed to the database client, and the insert payload in the
 * quick-add tests is the row the real `inventoryService` built — neither is an
 * argument intercepted from a stub.
 *
 * The chain dispatcher is the one from the M2 materials suite, extended with
 * the shapes this component adds: `.order()`, `.limit()` and a thenable
 * terminal (the dialog awaits the builder directly), plus the age-group and
 * inventory tables. A table it does not model throws rather than quietly
 * resolving, so an unmodelled call shape fails the suite instead of passing
 * vacuously.
 *
 * Covers [A2]–[A9] of the M3b spec (PLAN-MATERIALES §Phase M3b).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ChildrenInventoryRow, InventoryCategory } from '@/types/childrenMinistry';

// ─── The single mock boundary: the Supabase client ──────────────────────────

type MockError = { message: string } | null;

interface MockResult {
  data: unknown;
  error: MockError;
}

type MockResponder = () => MockResult | Promise<MockResult>;

/** One terminal query as the real services actually issued it. */
interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update';
  columns: string | null;
  payload: Record<string, unknown> | null;
  filters: Array<{ column: string; value: unknown }>;
  limitCount: number | null;
  /** `list` = the builder was awaited directly (no .single()/.maybeSingle()). */
  terminal: 'single' | 'maybeSingle' | 'list';
}

interface ChainQuery extends PromiseLike<MockResult> {
  select: (columns: string) => ChainQuery;
  insert: (payload: Record<string, unknown>) => ChainQuery;
  update: (payload: Record<string, unknown>) => ChainQuery;
  eq: (column: string, value: unknown) => ChainQuery;
  order: (column: string, options?: { ascending?: boolean }) => ChainQuery;
  limit: (count: number) => ChainQuery;
  single: () => Promise<MockResult>;
  maybeSingle: () => Promise<MockResult>;
}

interface MockDbState {
  ageGroupRows: Array<Record<string, unknown>>;
  /** Rows the dialog's own `church_children_lessons` list queries return. */
  lessonRows: Array<Record<string, unknown>>;
  /** `getLessonByLiturgyAndAgeGroup` (maybeSingle) — null ⇒ the create path. */
  existingLesson: { id: string } | null;
  inventorySelect: MockResponder;
  inventoryInsert: MockResponder;
}

const queries: RecordedQuery[] = [];

const dbState: MockDbState = {
  ageGroupRows: [],
  lessonRows: [],
  existingLesson: null,
  inventorySelect: () => ({ data: [], error: null }),
  inventoryInsert: () => ({ data: null, error: { message: 'not configured' } }),
};

function filterValue(query: RecordedQuery, column: string): unknown {
  return query.filters.find((filter) => filter.column === column)?.value;
}

function resolveQuery(query: RecordedQuery): MockResult | Promise<MockResult> {
  switch (query.table) {
    case 'liturgias':
      return { data: { id: filterValue(query, 'id') }, error: null };

    case 'church_children_age_groups':
      return { data: dbState.ageGroupRows, error: null };

    case 'church_children_inventory':
      return query.op === 'insert' ? dbState.inventoryInsert() : dbState.inventorySelect();

    case 'church_children_lessons': {
      if (query.op === 'insert') {
        return {
          data: { id: `lesson-${String(query.payload?.age_group_id ?? 'new')}` },
          error: null,
        };
      }
      if (query.op === 'update') {
        return { data: { id: filterValue(query, 'id') }, error: null };
      }
      if (query.terminal === 'list') {
        // The dialog's own reads: all lessons for a liturgy, or the single
        // most-recent row for one age group after a Regenerar.
        const ageGroupId = filterValue(query, 'age_group_id');
        let rows = dbState.lessonRows;
        if (ageGroupId !== undefined) {
          rows = rows.filter((row) => row.age_group_id === ageGroupId);
        }
        if (query.limitCount !== null) rows = rows.slice(0, query.limitCount);
        return { data: rows, error: null };
      }
      // maybeSingle = the (liturgy_id, age_group_id) idempotency lookup.
      return { data: dbState.existingLesson, error: null };
    }

    case 'church_children_lesson_materials':
      return query.op === 'select'
        ? { data: null, error: null }
        : { data: { id: 'mat-1' }, error: null };

    case 'church_children_calendar':
      if (query.op === 'select') return { data: null, error: null };
      if (query.op === 'insert') return { data: { id: 'cal-1' }, error: null };
      return { data: { id: filterValue(query, 'id') }, error: null };

    case 'church_children_publication_state':
      if (query.op === 'select') return { data: null, error: null };
      if (query.op === 'insert') return { data: { id: 'pub-1' }, error: null };
      return { data: { id: filterValue(query, 'id') }, error: null };

    default:
      throw new Error(
        `Unstubbed Supabase table reached by the real services: "${query.table}"`,
      );
  }
}

// A function declaration, so the hoisted `vi.mock` factory below can reference
// it safely; the consts it closes over are only read once a test runs.
function createTableQuery(table: string): ChainQuery {
  const query: RecordedQuery = {
    table,
    op: 'select',
    columns: null,
    payload: null,
    filters: [],
    limitCount: null,
    terminal: 'single',
  };

  function finish(terminal: RecordedQuery['terminal']): Promise<MockResult> {
    query.terminal = terminal;
    queries.push(query);
    return Promise.resolve(resolveQuery(query));
  }

  const chain: ChainQuery = {
    select: (columns) => {
      query.columns = columns;
      return chain;
    },
    insert: (payload) => {
      query.op = 'insert';
      query.payload = payload;
      return chain;
    },
    update: (payload) => {
      query.op = 'update';
      query.payload = payload;
      return chain;
    },
    eq: (column, value) => {
      query.filters.push({ column, value });
      return chain;
    },
    order: () => chain,
    limit: (count) => {
      query.limitCount = count;
      return chain;
    },
    single: () => finish('single'),
    maybeSingle: () => finish('maybeSingle'),
    // The dialog and `getInventory`/`getAgeGroups` await the builder itself.
    then: (onFulfilled, onRejected) => finish('list').then(onFulfilled, onRejected),
  };

  return chain;
}

const invokeMock =
  vi.fn<(name: string, options: { body: Record<string, unknown> }) => Promise<unknown>>();
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const toastMock = vi.fn();

// The arrow wrappers are load-bearing: `vi.mock` factories are hoisted above
// these consts, so the factory may only READ them when it is finally invoked.
// This override replaces the global supabase mock from src/test/setup.ts.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => getUserMock(),
      getSession: () => getSessionMock(),
      refreshSession: () => refreshSessionMock(),
    },
    functions: {
      invoke: (name: string, options: { body: Record<string, unknown> }) =>
        invokeMock(name, options),
    },
    from: (table: string) => createTableQuery(table),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { ChildrenActivityDialog } from '../ChildrenActivityDialog';
import {
  buildEffectiveMaterialsList,
  MAX_AVAILABLE_MATERIALS,
} from '@/lib/children-ministry/materialsList';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const AGE_GROUPS = [
  {
    id: 'ag-peq',
    name: 'Pequenos',
    min_age: 0,
    max_age: 4,
    display_order: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ag-med',
    name: 'Medianos',
    min_age: 5,
    max_age: 8,
    display_order: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const makeInventoryRow = (
  id: string,
  name: string,
  category: InventoryCategory = 'craft',
  quantity = 0,
): ChildrenInventoryRow => ({
  id,
  name,
  category,
  quantity,
  min_quantity: 0,
  location: 'Sala Infantil',
  notes: null,
  last_restocked_at: null,
  created_by: null,
  created_at: '2026-07-31T00:00:00.000Z',
  updated_at: '2026-07-31T00:00:00.000Z',
});

/**
 * A raw inventory whose canonical form provably differs from it (V4 dedupe +
 * V5 whitespace collapse): if anything downstream forwarded the displayed
 * names instead of the canonical list, the [A4] assertions could not pass.
 */
const NONCANONICAL_ROWS: ChildrenInventoryRow[] = [
  makeInventoryRow('inv-1', '  Papel   Lustre  '),
  makeInventoryRow('inv-2', 'papel lustre'),
  makeInventoryRow('inv-3', 'Tijeras', 'supply'),
];
const NONCANONICAL_CANONICAL = ['Papel Lustre', 'Tijeras'];

const m = (n: number) => `m${String(n).padStart(2, '0')}`;
/** 61 distinct names — one more than the cap can hold. */
const OVER_CAP_ROWS: ChildrenInventoryRow[] = Array.from({ length: 61 }, (_, i) =>
  makeInventoryRow(`inv-${m(i + 1)}`, m(i + 1)),
);

function makeGeneratedResponse() {
  return {
    success: true,
    activityName: 'Actividad generada',
    materials: ['semillas', 'macetas'],
    sequence: [
      { phase: 'movimiento', title: 'Mover', description: 'Mover', minutes: 8 },
      {
        phase: 'expresion_conversacion',
        title: 'Hablar',
        description: 'Hablar',
        minutes: 10,
      },
      {
        phase: 'reflexion_metaprendizaje',
        title: 'Reflexionar',
        description: 'Reflexionar',
        minutes: 8,
      },
    ],
    adaptations: { small: 's', medium: 'm', large: 'l', mixed: 'x' },
    volunteerPlan: { leader: 'L', support: 'S' },
    estimatedTotalMinutes: 26,
  };
}

const makeLessonRow = (ageGroupId: string) => ({
  id: `lesson-${ageGroupId}`,
  title: 'Actividad previa',
  age_group_id: ageGroupId,
  liturgy_id: 'lit-1',
  duration_minutes: 30,
  materials_needed: null,
  content: null,
  status: 'ready',
  updated_at: '2026-07-31T00:00:00.000Z',
});

type DialogProps = React.ComponentProps<typeof ChildrenActivityDialog>;

const dialogProps = (overrides: Partial<DialogProps> = {}): DialogProps => ({
  isOpen: true,
  onClose: vi.fn(),
  liturgyId: 'lit-1',
  liturgyTitle: 'Domingo de Ramos',
  liturgySummary: 'Resumen',
  bibleText: 'Mateo 21',
  liturgyDate: '2026-03-29',
  storyData: {
    title: 'El Sembrador',
    summary: 'Una semilla',
    spiritualConnection: 'La fe',
    scenes: [{ text: 'Sembrador sale' }],
  },
  ...overrides,
});

// ─── Capture helpers — all at the Supabase boundary ─────────────────────────

function invokeBody(index = 0): Record<string, unknown> {
  const call = invokeMock.mock.calls[index];
  if (!call) throw new Error(`No functions.invoke call at index ${index}`);
  return call[1].body;
}

function queriesFor(table: string, op: RecordedQuery['op']): RecordedQuery[] {
  return queries.filter((query) => query.table === table && query.op === op);
}

/** The lesson row the REAL lessonService sent to the client, INSERT path. */
function lessonInsertPayload(index = 0): Record<string, unknown> {
  const payload = queriesFor('church_children_lessons', 'insert')[index]?.payload;
  if (!payload) throw new Error(`No church_children_lessons INSERT at index ${index}`);
  return payload;
}

/** The content JSON persisted by the real create path. */
function persistedContent(index = 0): Record<string, unknown> {
  return JSON.parse(String(lessonInsertPayload(index).content));
}

/** The row the REAL inventoryService sent to the client. */
function inventoryInsertPayloads(): Array<Record<string, unknown> | null> {
  return queriesFor('church_children_inventory', 'insert').map((query) => query.payload);
}

const toastDescriptions = () =>
  toastMock.mock.calls.map((call) => (call[0] as { description?: string })?.description);

// ─── DOM helpers ────────────────────────────────────────────────────────────

/**
 * Accessible names of the CHECKED checkboxes, in document order. Inside the
 * materials step the only checkboxes on screen are the inventory rows followed
 * by the extras, so this is exactly the M-D12 construction order — an
 * independent reading of the UI's own effective list.
 */
const checkedNamesFromUi = (): string[] =>
  screen
    .getAllByRole('checkbox')
    .filter((node) => node.getAttribute('aria-checked') === 'true')
    .map((node) => node.getAttribute('aria-label') ?? '');

const uiEffectiveList = (): string[] => buildEffectiveMaterialsList(checkedNamesFromUi());

const continuarButton = () => screen.getByRole('button', { name: 'Continuar' });
const generarButton = () => screen.getByRole('button', { name: /Generar|Generando/ });
const materialsStepIsVisible = () =>
  screen.queryByText(
    'Selecciona los materiales con los que cuenta la iglesia. La actividad se diseñará usando solo estos materiales.',
  ) !== null;

/** A promise the test settles by hand — the [B2] deferred-fetch control flow. */
function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const waitForGroupCheckbox = async (name: string) => {
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name })).toBeInTheDocument(),
  );
};

/**
 * Open the materials step from the select view for one group. The group tick is
 * idempotent on purpose: a liturgy change resets the materials step but leaves
 * the pre-existing group selection alone, and a second click would untick it.
 */
const goToMaterials = async (groupName = 'Pequenos') => {
  await waitForGroupCheckbox(groupName);
  const groupCheckbox = screen.getByRole('checkbox', { name: groupName });
  if (groupCheckbox.getAttribute('aria-checked') !== 'true') {
    fireEvent.click(groupCheckbox);
  }
  fireEvent.click(continuarButton());
  await waitFor(() => expect(materialsStepIsVisible()).toBe(true));
};

const waitForInventorySettled = async () => {
  await waitFor(() => expect(generarButton()).toBeEnabled());
};

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;

  dbState.ageGroupRows = AGE_GROUPS;
  dbState.lessonRows = [];
  dbState.existingLesson = null;
  dbState.inventorySelect = () => ({ data: [], error: null });
  dbState.inventoryInsert = () => ({ data: null, error: { message: 'not configured' } });

  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  getSessionMock.mockResolvedValue({
    data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    error: null,
  });
  refreshSessionMock.mockResolvedValue({ error: null });
  invokeMock.mockResolvedValue({ data: makeGeneratedResponse(), error: null });

  // The publish service logs a structured line per step and the dialog warns on
  // degraded paths; both are production behaviour, silenced here for readable
  // output only.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── [A2] routing: Continuar and Regenerar both pass through the step ───────

describe('[A2] el paso de materiales intercepta TODA generación', () => {
  it('"Continuar" navega al paso sin invocar ninguna generación', async () => {
    dbState.inventorySelect = () => ({
      data: [makeInventoryRow('inv-1', 'Papel')],
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();

    // The step is on screen with its context line for the staged group…
    expect(screen.getByText('Generarás para: Pequenos')).toBeInTheDocument();
    // …and nothing has been generated or persisted.
    expect(invokeMock).not.toHaveBeenCalled();
    expect(queriesFor('church_children_lessons', 'insert')).toHaveLength(0);
    expect(queriesFor('church_children_lessons', 'update')).toHaveLength(0);
  });

  it('"Regenerar" pasa por el mismo paso y luego genera SOLO ese grupo (M-D7)', async () => {
    dbState.lessonRows = [makeLessonRow('ag-med')];
    dbState.inventorySelect = () => ({
      data: [makeInventoryRow('inv-1', 'Papel')],
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Regenerar/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Regenerar/ }));

    // It routes through the step — no invoke yet — and stages only its group.
    await waitFor(() => expect(materialsStepIsVisible()).toBe(true));
    expect(screen.getByText('Generarás para: Medianos')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();

    await waitForInventorySettled();
    fireEvent.click(generarButton());

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeBody().ageGroupLabel).toBe('Medianos');
    expect(invokeBody().availableMaterials).toEqual(['Papel']);
  });
});

// ─── [A3] M-D10 gating on the first inventory fetch ─────────────────────────

describe('[A3] compuerta M-D10 sobre la primera carga del inventario', () => {
  it('mantiene Generar deshabilitado mientras la primera carga no se resuelve', async () => {
    const gate = defer<MockResult>();
    dbState.inventorySelect = () => gate.promise;

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();

    // Pending: the step shows its loading copy and generation is impossible.
    expect(screen.getByText('Cargando materiales disponibles…')).toBeInTheDocument();
    expect(generarButton()).toBeDisabled();
    fireEvent.click(generarButton());
    expect(invokeMock).not.toHaveBeenCalled();

    gate.resolve({
      data: [makeInventoryRow('inv-1', 'Papel'), makeInventoryRow('inv-2', 'Tijeras', 'supply')],
      error: null,
    });

    // Settled: every row is pre-checked and Generar is live.
    await waitForInventorySettled();
    expect(screen.getByRole('checkbox', { name: 'Papel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tijeras' })).toBeChecked();
    expect(screen.getByText(`2/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`)).toBeInTheDocument();
  });

  it('habilita Generar tras una carga vacía (inventario sin materiales)', async () => {
    dbState.inventorySelect = () => ({ data: [], error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    expect(
      screen.getByText(
        'El inventario de materiales está vacío. Agrega materiales aquí o genera sin restricción.',
      ),
    ).toBeInTheDocument();
  });

  it('con más de 60 materiales preselecciona los primeros 60 y lo avisa', async () => {
    dbState.inventorySelect = () => ({ data: OVER_CAP_ROWS, error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    expect(screen.getByRole('checkbox', { name: 'm01' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'm60' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'm61' })).not.toBeChecked();
    expect(checkedNamesFromUi()).toHaveLength(MAX_AVAILABLE_MATERIALS);
    expect(
      screen.getByText(`${MAX_AVAILABLE_MATERIALS}/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `El inventario tiene 61 materiales; se preseleccionaron los primeros ${MAX_AVAILABLE_MATERIALS}.`,
      ),
    ).toBeInTheDocument();
  });

  it('cuenta nombres canónicamente distintos, no filas: una colisión no desaprovecha un cupo', async () => {
    // 61 rows but only 60 canonical-distinct names, so ALL of them fit.
    const rows = [
      makeInventoryRow('inv-a', 'Papel'),
      makeInventoryRow('inv-b', 'papel'),
      ...Array.from({ length: 59 }, (_, i) => makeInventoryRow(`inv-${m(i + 3)}`, m(i + 3))),
    ];
    expect(rows).toHaveLength(61);
    expect(buildEffectiveMaterialsList(rows.map((row) => row.name))).toHaveLength(60);

    dbState.inventorySelect = () => ({ data: rows, error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    // A raw first-60 cut would have left the 61st row unchecked.
    expect(checkedNamesFromUi()).toHaveLength(61);
    expect(screen.getByRole('checkbox', { name: 'papel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: m(61) })).toBeChecked();
    expect(
      screen.getByText(`${MAX_AVAILABLE_MATERIALS}/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`),
    ).toBeInTheDocument();
  });

  it('"Seleccionar todos" respeta el tope de 60 en orden M-D12', async () => {
    dbState.inventorySelect = () => ({ data: OVER_CAP_ROWS, error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
    await waitFor(() => expect(checkedNamesFromUi()).toHaveLength(0));

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    await waitFor(() => expect(checkedNamesFromUi()).toHaveLength(MAX_AVAILABLE_MATERIALS));
    expect(checkedNamesFromUi()[0]).toBe('m01');
    expect(checkedNamesFromUi()[MAX_AVAILABLE_MATERIALS - 1]).toBe('m60');
    expect(screen.getByRole('checkbox', { name: 'm61' })).not.toBeChecked();
  });

  it('un rechazo muestra el aviso de error, habilita Generar y genera sin restricción', async () => {
    dbState.inventorySelect = () => ({ data: null, error: { message: 'fallo de red' } });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    expect(
      screen.getByText(
        'No se pudieron cargar los materiales del inventario. Puedes generar sin restricción de materiales.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(generarButton());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeBody()).not.toHaveProperty('availableMaterials');
  });
});

// ─── [A4] the [B1] equality, end to end through the real stack ──────────────

describe('[A4] la lista efectiva de la UI, el cuerpo del invoke y el snapshot son la MISMA lista', () => {
  it('canoniza una selección no canónica y la mantiene idéntica en los tres puntos', async () => {
    dbState.inventorySelect = () => ({ data: NONCANONICAL_ROWS, error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    // Read the UI's own effective list off the screen BEFORE generating.
    const fromUi = uiEffectiveList();
    expect(fromUi).toEqual(NONCANONICAL_CANONICAL);
    // Guard the guard: the displayed names really are a different list, so the
    // assertions below cannot be satisfied by forwarding what is on screen.
    expect(checkedNamesFromUi()).not.toEqual(NONCANONICAL_CANONICAL);
    expect(checkedNamesFromUi()).toHaveLength(3);
    expect(screen.getByText(`2/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`)).toBeInTheDocument();

    fireEvent.click(generarButton());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(queriesFor('church_children_lessons', 'insert')).toHaveLength(1),
    );

    const sent = invokeBody().availableMaterials;
    const stored = persistedContent().availableMaterials;

    expect(sent).toEqual(NONCANONICAL_CANONICAL);
    expect(stored).toEqual(NONCANONICAL_CANONICAL);
    // The [B1] equality itself, on the three independent captures.
    expect(sent).toEqual(fromUi);
    expect(stored).toEqual(sent);
  });
});

// ─── [A5] zero selection ⇒ the sin-restricción escape ───────────────────────

describe('[A5] sin selección se genera sin restricción de materiales', () => {
  it('no envía la clave availableMaterials y muestra la nota', async () => {
    dbState.inventorySelect = () => ({
      data: [makeInventoryRow('inv-1', 'Papel'), makeInventoryRow('inv-2', 'Tijeras', 'supply')],
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Sin materiales seleccionados: la actividad se generará sin restricción de materiales.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(`0/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`)).toBeInTheDocument();

    fireEvent.click(generarButton());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(queriesFor('church_children_lessons', 'insert')).toHaveLength(1),
    );

    // Absent, not present-and-undefined: M-D2 requires a byte-identical prompt.
    expect(invokeBody()).not.toHaveProperty('availableMaterials');
    expect(Object.keys(invokeBody())).not.toContain('availableMaterials');
    expect(persistedContent()).not.toHaveProperty('availableMaterials');
    expect(Object.keys(persistedContent())).not.toContain('availableMaterials');
  });
});

// ─── [A6] quick-add: payload, failure tolerance, repeat guard ───────────────

describe('[A6] alta rápida de materiales (M-D6)', () => {
  const addExtra = async (name: string) => {
    fireEvent.change(screen.getByPlaceholderText('Agregar material adicional…'), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  };

  it('inserta exactamente los valores por defecto de M-D6 y mueve el material al inventario', async () => {
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });
    dbState.inventoryInsert = () => ({
      data: makeInventoryRow('inv-nuevo', 'Plumones', 'other'),
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();
    await addExtra('Plumones');

    expect(screen.getByText('Adicionales (solo esta vez)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar en inventario/ }));

    await waitFor(() =>
      expect(toastDescriptions()).toContain('Material guardado en el inventario'),
    );

    // The row the REAL inventoryService built, verbatim.
    expect(inventoryInsertPayloads()).toHaveLength(1);
    expect(inventoryInsertPayloads()[0]).toEqual({
      name: 'Plumones',
      category: 'other',
      quantity: 0,
      min_quantity: 0,
      location: 'Sala Infantil',
      notes: null,
      last_restocked_at: null,
      created_by: 'user-1',
    });

    // Terminal state: it left "Adicionales" and joined its category, checked.
    await waitFor(() =>
      expect(screen.queryByText('Adicionales (solo esta vez)')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'Plumones' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Plumones' })).toBeEnabled();
  });

  it('tras guardar, el nombre viaja UNA sola vez en la lista efectiva', async () => {
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });
    dbState.inventoryInsert = () => ({
      data: makeInventoryRow('inv-nuevo', 'Plumones', 'other'),
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();
    await addExtra('Plumones');
    fireEvent.click(screen.getByRole('button', { name: /Guardar en inventario/ }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Plumones' })).toBeEnabled(),
    );

    fireEvent.click(generarButton());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    expect(invokeBody().availableMaterials).toEqual(['Papel', 'Plumones']);
  });

  it('un insert rechazado conserva el material como uso único y NO bloquea Generar', async () => {
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });
    dbState.inventoryInsert = () => ({ data: null, error: { message: 'permiso denegado' } });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();
    await addExtra('Plumones');

    fireEvent.click(screen.getByRole('button', { name: /Guardar en inventario/ }));
    await waitFor(() =>
      expect(toastDescriptions()).toContain(
        'No se pudo guardar el material. Puedes usarlo solo esta vez.',
      ),
    );

    // Still a usable one-off…
    expect(screen.getByText('Adicionales (solo esta vez)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Plumones' })).toBeChecked();
    // …and generation proceeds with it.
    expect(generarButton()).toBeEnabled();
    fireEvent.click(generarButton());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeBody().availableMaterials).toEqual(['Papel', 'Plumones']);
  });

  it('dos intentos de guardado simultáneos insertan COMO MÁXIMO una vez', async () => {
    const gate = defer<MockResult>();
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });
    dbState.inventoryInsert = () => gate.promise;

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();
    await addExtra('Plumones');
    await addExtra('Cartulina');

    const saveButtons = screen.getAllByRole('button', { name: /Guardar en inventario/ });
    expect(saveButtons).toHaveLength(2);
    // Both clicks land inside one tick, before any state has flushed: only a
    // guard that does NOT read React state can stop the second insert.
    fireEvent.click(saveButtons[0]);
    fireEvent.click(saveButtons[1]);

    await waitFor(() => expect(inventoryInsertPayloads()).toHaveLength(1));
    expect(inventoryInsertPayloads()[0]?.name).toBe('Plumones');

    gate.resolve({ data: makeInventoryRow('inv-nuevo', 'Plumones', 'other'), error: null });
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Plumones' })).toBeEnabled(),
    );
    expect(inventoryInsertPayloads()).toHaveLength(1);
  });
});

// ─── [A7] quick-add case-insensitive duplicates ([S4]) ──────────────────────

describe('[A7] duplicados sin distinguir mayúsculas en el alta rápida ([S4])', () => {
  it('un nombre que ya está en el inventario marca esa fila y no inserta nada', async () => {
    dbState.inventorySelect = () => ({
      data: [makeInventoryRow('inv-1', 'Papel'), makeInventoryRow('inv-2', 'Tijeras', 'supply')],
      error: null,
    });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    // Start from a clean slate so "checked" is unambiguously this action's work.
    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));
    await waitFor(() => expect(checkedNamesFromUi()).toHaveLength(0));

    fireEvent.change(screen.getByPlaceholderText('Agregar material adicional…'), {
      target: { value: '  PAPEL  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Papel' })).toBeChecked(),
    );
    expect(toastDescriptions()).toContain(
      'Ese material ya está en el inventario; quedó seleccionado.',
    );
    expect(inventoryInsertPayloads()).toHaveLength(0);
    // No one-off was created for it.
    expect(screen.queryByText('Adicionales (solo esta vez)')).not.toBeInTheDocument();
    expect(checkedNamesFromUi()).toEqual(['Papel']);
  });

  it('un nombre que repite un adicional existente no agrega nada', async () => {
    dbState.inventorySelect = () => ({ data: [], error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    const input = () => screen.getByPlaceholderText('Agregar material adicional…');
    fireEvent.change(input(), { target: { value: 'Plumones' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(screen.getByText('Plumones')).toBeInTheDocument());

    fireEvent.change(input(), { target: { value: 'PLUMONES' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() =>
      expect(screen.getByText(`1/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`)).toBeInTheDocument(),
    );
    expect(checkedNamesFromUi()).toEqual(['Plumones']);
    expect(screen.queryByText('PLUMONES')).not.toBeInTheDocument();
  });
});

// ─── [A8] [S5] context resets ───────────────────────────────────────────────

describe('[A8] reinicio de contexto ([S5])', () => {
  it('cambiar de liturgia reinicia estado, vista y elegibilidad, y neutraliza la carga en vuelo', async () => {
    const stale = defer<MockResult>();
    const fresh = defer<MockResult>();
    let call = 0;
    dbState.inventorySelect = () => {
      call += 1;
      return call === 1 ? stale.promise : fresh.promise;
    };

    const { rerender } = render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    expect(screen.getByText('Cargando materiales disponibles…')).toBeInTheDocument();

    // A different liturgy arrives while the first fetch is still in flight.
    rerender(<ChildrenActivityDialog {...dialogProps({ liturgyId: 'lit-2' })} />);
    await waitFor(() => expect(materialsStepIsVisible()).toBe(false));
    await waitForGroupCheckbox('Pequenos');
    // Everything the step owned is gone: no staged group survives.
    expect(screen.queryByText('Generarás para: Pequenos')).not.toBeInTheDocument();

    // The stale promise settles — it must not touch the new context at all.
    stale.resolve({ data: [makeInventoryRow('inv-stale', 'Fantasma')], error: null });
    await Promise.resolve();

    await goToMaterials();
    expect(screen.queryByRole('checkbox', { name: 'Fantasma' })).not.toBeInTheDocument();
    expect(generarButton()).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalled();

    // The active context's own fetch still settles normally.
    fresh.resolve({ data: [makeInventoryRow('inv-2', 'Cartulina')], error: null });
    await waitForInventorySettled();
    expect(screen.getByRole('checkbox', { name: 'Cartulina' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Fantasma' })).not.toBeInTheDocument();
  });

  it('cerrar el diálogo (resetAll) limpia todo lo nuevo', async () => {
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });

    const props = dialogProps();
    const { rerender } = render(<ChildrenActivityDialog {...props} />);
    await goToMaterials();
    await waitForInventorySettled();

    fireEvent.change(screen.getByPlaceholderText('Agregar material adicional…'), {
      target: { value: 'Plumones' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(screen.getByText('Plumones')).toBeInTheDocument());

    // Closing straight from the materials step (Escape → Radix onOpenChange →
    // handleClose → resetAll), not via a detour through the select view.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());

    // Reopen: back at the select view with no staged group and no extras.
    rerender(<ChildrenActivityDialog {...dialogProps({ isOpen: false })} />);
    rerender(<ChildrenActivityDialog {...dialogProps()} />);
    await waitForGroupCheckbox('Pequenos');

    expect(materialsStepIsVisible()).toBe(false);
    expect(screen.queryByText('Plumones')).not.toBeInTheDocument();
    expect(screen.queryByText('Adicionales (solo esta vez)')).not.toBeInTheDocument();
  });
});

// ─── [A9] Spanish footer copy (D8) ──────────────────────────────────────────

describe('[A9] copia en español de la botonera (D8)', () => {
  it('usa Continuar / Volver / Generar y Generando… durante la generación', async () => {
    const generation = defer<unknown>();
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });
    invokeMock.mockReturnValue(generation.promise as Promise<unknown>);

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await waitForGroupCheckbox('Pequenos');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pequenos' }));

    // Select view: the primary action is Continuar, not Generar.
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar' })).not.toBeInTheDocument();

    fireEvent.click(continuarButton());
    await waitFor(() => expect(materialsStepIsVisible()).toBe(true));
    await waitForInventorySettled();

    // Materials view: Volver + Generar.
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generando…' })).toBeInTheDocument(),
    );

    generation.resolve({ data: makeGeneratedResponse(), error: null });
    await waitFor(() =>
      expect(screen.getByText('Detalle por grupo:')).toBeInTheDocument(),
    );
  });

  it('"Volver" regresa a la selección conservando las casillas marcadas (M-D7)', async () => {
    dbState.inventorySelect = () => ({ data: [makeInventoryRow('inv-1', 'Papel')], error: null });

    render(<ChildrenActivityDialog {...dialogProps()} />);
    await goToMaterials();
    await waitForInventorySettled();

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(materialsStepIsVisible()).toBe(false));

    // The group checkbox is still ticked, so Continuar is still available…
    expect(screen.getByRole('checkbox', { name: 'Pequenos' })).toBeChecked();
    fireEvent.click(continuarButton());

    // …and the material selection survived the round trip: no second fetch,
    // no reset to loading.
    await waitFor(() => expect(materialsStepIsVisible()).toBe(true));
    expect(screen.getByRole('checkbox', { name: 'Papel' })).toBeChecked();
    expect(queriesFor('church_children_inventory', 'select')).toHaveLength(1);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
