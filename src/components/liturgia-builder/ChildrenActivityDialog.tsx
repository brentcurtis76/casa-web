/**
 * Children Activity Dialog — Age group selection, refinement, and regeneration
 *
 * View states:
 *   - 'select'            → show existing activities per group (with Refinar/Regenerar)
 *                           + checkboxes for groups that do NOT yet have an activity.
 *   - 'materials'         → "materiales disponibles" step: pick the church
 *                           inventory the activity must be designed with
 *                           (PLAN-MATERIALES M3b). Every generation path —
 *                           Continuar and Regenerar alike — passes through it.
 *   - 'refine'            → feedback input for a specific existing lesson.
 *   - 'refine-confirm'    → confirmation panel after successful refinement.
 *   - 'results'           → per-group generation results.
 *
 * Pattern: ExportPanel + MusicPublishDialog
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check, X, Sparkles, RefreshCw, ArrowLeft } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { useToast } from '@/hooks/use-toast';
import type {
  ChildrenAgeGroupRow,
  ChildrenInventoryRow,
  ChildrenLessonRow,
  InventoryCategory,
} from '@/types/childrenMinistry';
import type {
  GroupGenerationResult,
  LessonPhase,
  RefinementType,
} from '@/types/childrenPublicationState';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import {
  createInventoryItem,
  getInventory,
} from '@/lib/children-ministry/inventoryService';
import {
  buildEffectiveMaterialsList,
  MAX_AVAILABLE_MATERIALS,
} from '@/lib/children-ministry/materialsList';
import {
  publishChildrenActivities,
  refineChildrenActivity,
  type PublishChildrenActivitiesParams,
} from '@/lib/children-ministry/liturgyChildrenPublishService';
import MaterialsStepView from '@/components/liturgia-builder/MaterialsStepView';
import { supabase } from '@/integrations/supabase/client';

const REFINEMENT_TYPE_OPTIONS: Array<{ value: RefinementType; label: string }> = [
  { value: 'general', label: 'General — mejoras libres' },
  { value: 'materials', label: 'Materiales — ajustar o sustituir recursos' },
  { value: 'duration', label: 'Duración — hacer más corto o más largo' },
  { value: 'adaptations', label: 'Adaptaciones — por tamaño de grupo' },
  { value: 'phases', label: 'Fases — reestructurar el flujo' },
  { value: 'spiritual', label: 'Espiritual — profundizar la conexión bíblica' },
  { value: 'volunteer', label: 'Voluntarios — claridad de roles' },
  { value: 'tone', label: 'Tono — ajustar el estilo' },
];

const PHASE_LABEL: Record<LessonPhase['phase'], string> = {
  movimiento: 'Movimiento',
  expresion_conversacion: 'Expresión / Conversación',
  reflexion_metaprendizaje: 'Reflexión / Metaaprendizaje',
};

function parseLessonPhases(content: string | null): LessonPhase[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { sequence?: LessonPhase[] };
    return Array.isArray(parsed.sequence) ? parsed.sequence : [];
  } catch {
    return [];
  }
}

interface ChildrenActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  liturgyId: string;
  liturgyTitle: string;
  liturgySummary: string;
  bibleText: string;
  liturgyDate: string;
  storyData: {
    title: string;
    summary: string;
    spiritualConnection: string;
    scenes: Array<{ text: string }>;
  };
}

type ViewState = 'select' | 'materials' | 'refine' | 'refine-confirm' | 'results';

type ExistingActivityMap = Map<string, ChildrenLessonRow>;

function truncateMaterials(materials: string | null, limit = 80): string {
  if (!materials) return '';
  const trimmed = materials.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
}

// ─── Materials step helpers (PLAN-MATERIALES M-D5 / M-D12) ──────────────────

/** M-D12 fixed category order — the same one MaterialsStepView renders in. */
const MATERIAL_CATEGORY_ORDER: InventoryCategory[] = [
  'craft',
  'book',
  'supply',
  'equipment',
  'other',
];

/**
 * The ONE order (M-D12): fixed category order, then the order `getInventory()`
 * returned (name-ascending) within each category. Used for rendering, the
 * initial pre-check, bulk selection and effective-list construction alike, so
 * the prompt order can never drift from what the user saw.
 */
function orderInventory(items: ChildrenInventoryRow[]): ChildrenInventoryRow[] {
  return MATERIAL_CATEGORY_ORDER.flatMap((category) =>
    items.filter((item) => item.category === category),
  );
}

/**
 * The key M-D5 dedupes on, obtained by running the frozen algorithm itself —
 * never a second implementation of it. `null` when the name canonicalizes away
 * entirely (empty / whitespace-only / control chars only).
 */
function canonicalKey(name: string): string | null {
  const [canonical] = buildEffectiveMaterialsList([name]);
  return canonical ? canonical.toLowerCase() : null;
}

/**
 * Does adding `name` fit under the M-D5 cap, given the effective list built so
 * far? This is how the dialog owns cap enforcement (M3a binding note) without a
 * second implementation of M-D5: `current` already holds canonical entries, so
 * lowercasing one yields exactly the key the algorithm dedupes on, and the
 * candidate's key comes from the algorithm itself. A canonical duplicate — or a
 * name M-D5 would drop outright — costs no slot; anything else needs a free one.
 *
 * Comparing the canonicalized lists before and after would NOT work: the cap
 * truncates the tail, so at 60 the 61st distinct name is the entry that
 * disappears and the list looks unchanged.
 */
function fitsUnderCap(name: string, current: string[]): boolean {
  const key = canonicalKey(name);
  if (key === null) return true;
  if (current.some((entry) => entry.toLowerCase() === key)) return true;
  return current.length < MAX_AVAILABLE_MATERIALS;
}

/**
 * Greedy "first N canonical-distinct names in M-D12 order" ([S2-R]): walk the
 * ordered rows and take each one that still fits — extras included, since they
 * always count toward the cap. Canonical name collisions cost no slot, so they
 * never under-fill the selection.
 */
function selectWithinCap(
  orderedItems: ChildrenInventoryRow[],
  extras: string[],
): Set<string> {
  const chosenIds = new Set<string>();
  const chosenNames: string[] = [];
  let current = buildEffectiveMaterialsList(extras);

  for (const item of orderedItems) {
    if (!fitsUnderCap(item.name, current)) continue;
    chosenNames.push(item.name);
    chosenIds.add(item.id);
    current = buildEffectiveMaterialsList([...chosenNames, ...extras]);
  }

  return chosenIds;
}

/** M-D6: `created_by` is the current user id, or null when unavailable. */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const ChildrenActivityDialog: React.FC<ChildrenActivityDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  liturgyId,
  liturgyTitle,
  liturgySummary,
  bibleText,
  liturgyDate,
  storyData,
}) => {
  const { toast } = useToast();
  const [ageGroups, setAgeGroups] = useState<ChildrenAgeGroupRow[]>([]);
  const [existingActivities, setExistingActivities] = useState<ExistingActivityMap>(new Map());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [results, setResults] = useState<GroupGenerationResult[]>([]);
  const [viewState, setViewState] = useState<ViewState>('select');
  const [refineTarget, setRefineTarget] = useState<{
    lesson: ChildrenLessonRow;
    ageGroup: ChildrenAgeGroupRow;
  } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [refinementType, setRefinementType] = useState<RefinementType>('general');
  const [lastRefinementNotes, setLastRefinementNotes] = useState<string | null>(null);

  // ── Materials step state (M3b) ────────────────────────────────────────────
  // Groups staged by Continuar/Regenerar and generated once the user leaves the
  // materials step; `regenerateGroupId` remembers which path staged them so the
  // Regenerar-only view refresh still runs afterwards.
  const [pendingGroupIds, setPendingGroupIds] = useState<string[]>([]);
  const [regenerateGroupId, setRegenerateGroupId] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<ChildrenInventoryRow[]>([]);
  const [checkedMaterialIds, setCheckedMaterialIds] = useState<Set<string>>(new Set());
  const [materialExtras, setMaterialExtras] = useState<string[]>([]);
  const [savingExtra, setSavingExtra] = useState<string | null>(null);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [inventoryLoadError, setInventoryLoadError] = useState(false);
  // M-D10 generation eligibility: false until the FIRST inventory request for
  // the active context settles (success — including empty — or error).
  const [inventorySettled, setInventorySettled] = useState(false);
  // Row count when the inventory exceeded the cap, so the step can say so ([B1]).
  const [inventoryOverCapCount, setInventoryOverCapCount] = useState<number | null>(null);

  // Tracks whether the dialog is still mounted/open; async handlers check this
  // before calling setState to avoid stale updates after close/unmount.
  const isActiveRef = useRef(false);
  useEffect(() => {
    isActiveRef.current = isOpen;
    return () => {
      isActiveRef.current = false;
    };
  }, [isOpen]);

  // Tracks the current liturgyId so in-flight async handlers from a previous
  // liturgy cannot apply results to a newer one after the prop changes.
  const liturgyIdRef = useRef(liturgyId);
  useEffect(() => {
    liturgyIdRef.current = liturgyId;
  }, [liturgyId]);

  // [S5] Monotonic token for the materials step. Every reset bumps it, so an
  // in-flight inventory fetch from a previous context is recognisable as stale
  // even when the liturgyId happens to be unchanged.
  const materialsContextRef = useRef(0);
  // The inventory is fetched lazily, ONCE per context, on first materials entry.
  const inventoryFetchStartedRef = useRef(false);
  // M-D6 repeat-save guard. A ref, not the state: two clicks inside one tick
  // would both read `savingExtra === null` and both insert. It holds the OWNER
  // token of the save in flight — a fresh symbol per attempt, never the
  // material name: the same name can be added again after a context reset, so
  // only identity tells the live owner apart from an obsolete one ([B1]).
  const savingExtraRef = useRef<symbol | null>(null);

  const isMaterialsContextCurrent = useCallback(
    (requestLiturgyId: string, requestToken: number) =>
      isActiveRef.current &&
      requestLiturgyId === liturgyIdRef.current &&
      requestToken === materialsContextRef.current,
    [],
  );

  // [S5] Everything the materials step owns, back to its initial value. The
  // token bump is what makes a stale fetch harmless: it can no longer mark the
  // new context loaded/errored, pre-check anything, or enable Generar.
  const resetMaterialsState = useCallback(() => {
    materialsContextRef.current += 1;
    inventoryFetchStartedRef.current = false;
    savingExtraRef.current = null;
    setPendingGroupIds([]);
    setRegenerateGroupId(null);
    setInventoryItems([]);
    setCheckedMaterialIds(new Set());
    setMaterialExtras([]);
    setSavingExtra(null);
    setIsInventoryLoading(false);
    setInventoryLoadError(false);
    setInventorySettled(false);
    setInventoryOverCapCount(null);
    // Only the step this phase added is navigated away from; the refine and
    // results views keep the behaviour they had before M3b.
    setViewState((current) => (current === 'materials' ? 'select' : current));
  }, []);

  // [S5] A different liturgy is a different materials context.
  useEffect(() => {
    resetMaterialsState();
  }, [liturgyId, resetMaterialsState]);

  // Fetch the latest existing lessons for this liturgy and rebuild the
  // age-group → lesson map from DB. Returns the new map (or null on error)
  // so callers can use it without waiting for setState to flush.
  const fetchExistingActivities = async (
    requestLiturgyId: string,
  ): Promise<ExistingActivityMap | null> => {
    const { data, error } = await supabase
      .from('church_children_lessons')
      .select('*')
      .eq('liturgy_id', requestLiturgyId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('Error cargando actividades existentes:', error);
      return null;
    }
    const map: ExistingActivityMap = new Map();
    for (const lesson of (data ?? []) as ChildrenLessonRow[]) {
      if (lesson.age_group_id && !map.has(lesson.age_group_id)) {
        map.set(lesson.age_group_id, lesson);
      }
    }
    return map;
  };

  // Load age groups + existing lessons for this liturgy on open.
  // Uses a `cancelled` flag so older requests (e.g. from a previous liturgyId)
  // cannot overwrite state for the newer one if they resolve out of order.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    setExistingActivities(new Map());
    setAgeGroups([]);

    (async () => {
      try {
        setIsLoading(true);
        const groups = await getAgeGroups();
        if (cancelled) return;
        setAgeGroups(groups);

        const map = await fetchExistingActivities(liturgyId);
        if (cancelled) return;

        if (map === null) {
          toast({
            title: 'Aviso',
            description: 'No se pudieron cargar las actividades existentes.',
            variant: 'destructive',
          });
          return;
        }

        setExistingActivities(map);
      } catch (error) {
        if (cancelled) return;
        console.warn('Error cargando datos del diálogo de niños:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, liturgyId, toast]);

  // Lazy inventory fetch — the FIRST time this context reaches the materials
  // step ([S1-R]: Continuar itself generates nothing; the fetch is what starts
  // here). M-D10: `inventorySettled` stays false until this request settles, and
  // the footer's Generar is disabled meanwhile, so a pending fetch can never be
  // bypassed into an unintended unconstrained generation.
  useEffect(() => {
    if (viewState !== 'materials') return;
    if (inventoryFetchStartedRef.current) return;
    inventoryFetchStartedRef.current = true;

    const requestLiturgyId = liturgyId;
    const requestToken = materialsContextRef.current;
    // The step hides the one-off input while loading, so this is [] in practice;
    // reading it keeps the pre-check honest if that ever changes.
    const extrasAtEntry = materialExtras;

    setIsInventoryLoading(true);
    setInventoryLoadError(false);

    (async () => {
      try {
        const rows = await getInventory();
        if (!isMaterialsContextCurrent(requestLiturgyId, requestToken)) return;

        setInventoryItems(rows);
        // Pre-check ALL (Brent's product decision) — or, past the cap, the first
        // MAX_AVAILABLE_MATERIALS canonical-distinct names in M-D12 order ([B1]).
        setCheckedMaterialIds(selectWithinCap(orderInventory(rows), extrasAtEntry));
        setInventoryOverCapCount(
          rows.length > MAX_AVAILABLE_MATERIALS ? rows.length : null,
        );
        setIsInventoryLoading(false);
        setInventorySettled(true);
      } catch (error) {
        console.warn('Error cargando el inventario de materiales:', error);
        if (!isMaterialsContextCurrent(requestLiturgyId, requestToken)) return;
        // M-D1 degradation: the step stays usable and generation proceeds
        // without a materials constraint.
        setInventoryLoadError(true);
        setIsInventoryLoading(false);
        setInventorySettled(true);
      }
    })();
  }, [viewState, liturgyId, materialExtras, isMaterialsContextCurrent]);

  const resetAll = () => {
    setSelectedGroupIds(new Set());
    setResults([]);
    setViewState('select');
    setRefineTarget(null);
    setFeedback('');
    setRefinementType('general');
    setLastRefinementNotes(null);
    resetMaterialsState();
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleAgeGroupToggle = (groupId: string) => {
    const next = new Set(selectedGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setSelectedGroupIds(next);
  };

  // ── Derived materials state (M-D5 / M-D12) ────────────────────────────────
  const orderedInventoryItems = orderInventory(inventoryItems);
  // Checked inventory names in M-D12 order, then extras in entry order — the
  // ONE construction order behind the counter, the cap and the prompt.
  const effectiveMaterials = buildEffectiveMaterialsList([
    ...orderedInventoryItems
      .filter((item) => checkedMaterialIds.has(item.id))
      .map((item) => item.name),
    ...materialExtras,
  ]);
  const capReached = effectiveMaterials.length >= MAX_AVAILABLE_MATERIALS;

  const handleToggleMaterial = (itemId: string) => {
    setCheckedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        return next;
      }
      next.add(itemId);

      // Cap ownership lives here: at the cap a canonically new name has no slot,
      // so the toggle is refused rather than checking a row whose name would
      // never reach the prompt. Derived from `prev`, never from a possibly
      // stale render snapshot.
      const ordered = orderInventory(inventoryItems);
      const item = ordered.find((row) => row.id === itemId);
      if (!item) return prev;
      const current = buildEffectiveMaterialsList([
        ...ordered.filter((row) => prev.has(row.id)).map((row) => row.name),
        ...materialExtras,
      ]);

      return fitsUnderCap(item.name, current) ? next : prev;
    });
  };

  const handleToggleAllMaterials = (checked: boolean) => {
    if (!checked) {
      setCheckedMaterialIds(new Set());
      return;
    }
    setCheckedMaterialIds(selectWithinCap(orderInventory(inventoryItems), materialExtras));
  };

  const handleAddExtra = (rawName: string) => {
    const name = rawName.trim();
    const key = canonicalKey(name);
    // M-D5 would drop it anyway; nothing to add.
    if (key === null) return;

    // [S4] An existing inventory row always wins over a one-off: check that row,
    // insert nothing, and say so.
    const match = inventoryItems.find((item) => canonicalKey(item.name) === key);
    if (match) {
      if (!checkedMaterialIds.has(match.id)) {
        handleToggleMaterial(match.id);
      }
      toast({
        title: 'Aviso',
        description: 'Ese material ya está en el inventario; quedó seleccionado.',
      });
      return;
    }

    // [S4] Case-insensitively already a one-off: adding it again is a no-op.
    // The check runs inside the updater so two adds in one tick cannot race.
    setMaterialExtras((prev) =>
      prev.some((extra) => canonicalKey(extra) === key) ? prev : [...prev, name],
    );
  };

  const handleSaveExtra = async (name: string) => {
    const requestLiturgyId = liturgyId;
    const requestToken = materialsContextRef.current;
    // M-D6 repeat guard: one save in flight at a time, so a double click (or a
    // click on a second row mid-save) cannot insert the same name twice.
    if (savingExtraRef.current !== null) return;

    // This attempt's ownership token: only its holder may release the guard.
    const owner = Symbol('savingExtra');
    savingExtraRef.current = owner;
    setSavingExtra(name);
    try {
      const created = await createInventoryItem({
        name,
        category: 'other',
        quantity: 0,
        min_quantity: 0,
        location: 'Sala Infantil',
        notes: null,
        last_restocked_at: null,
        created_by: await currentUserId(),
      });

      if (!isMaterialsContextCurrent(requestLiturgyId, requestToken)) return;

      // M-D6 terminal state: the name leaves "Adicionales (solo esta vez)" and
      // joins its category group, checked. Its canonical entry is unchanged, so
      // the move cannot push the effective list over the cap.
      setInventoryItems((prev) => [...prev, created]);
      setCheckedMaterialIds((prev) => new Set(prev).add(created.id));
      setMaterialExtras((prev) => prev.filter((extra) => extra !== name));
      toast({ title: 'Éxito', description: 'Material guardado en el inventario' });
    } catch (error) {
      if (!isMaterialsContextCurrent(requestLiturgyId, requestToken)) return;
      console.warn('Error guardando el material en el inventario:', error);
      // A failed save NEVER blocks generation: the one-off stays usable.
      toast({
        title: 'Aviso',
        description: 'No se pudo guardar el material. Puedes usarlo solo esta vez.',
        variant: 'destructive',
      });
    } finally {
      // [B1] Release ONLY what this attempt still owns. Abandoning a context
      // already frees the guard (`resetMaterialsState` nulls the ref), so the
      // next context can save right away; a stale save settling afterwards must
      // leave the newer owner's guard — and its spinner — untouched.
      if (savingExtraRef.current === owner) {
        savingExtraRef.current = null;
        if (isMaterialsContextCurrent(requestLiturgyId, requestToken)) {
          setSavingExtra(null);
        }
      }
    }
  };

  const runGenerationForGroups = async (
    groupIds: string[],
    requestLiturgyId: string,
    availableMaterials: string[],
  ) => {
    const selectedGroups = ageGroups.filter((ag) => groupIds.includes(ag.id));

    const params: PublishChildrenActivitiesParams = {
      liturgyId: requestLiturgyId,
      liturgyTitle,
      liturgySummary,
      bibleText,
      liturgyDate,
      storyData,
      selectedAgeGroupIds: groupIds,
      ageGroups: selectedGroups,
      // M-D2: no selection at all ⇒ the key is omitted entirely, which is the
      // "sin restricción de materiales" escape and a byte-identical prompt.
      ...(availableMaterials.length > 0 ? { availableMaterials } : {}),
    };

    const result = await publishChildrenActivities(params);

    if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;

    // Refresh the existing-activity map from DB so the dialog's "select"
    // view, and the count shown to the user, reflect what was actually
    // persisted — not a stale React snapshot. We base the inline summary
    // on this map (intersected with the requested group ids), not on the
    // in-memory result shape.
    const refreshed = await fetchExistingActivities(requestLiturgyId);
    if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
    if (refreshed) {
      setExistingActivities(refreshed);
    }

    const persistedCount = refreshed
      ? groupIds.filter((id) => refreshed.has(id)).length
      : result.totalActivitiesGenerated;
    const attempted = groupIds.length;

    setResults(result.results);
    setViewState('results');

    if (persistedCount === attempted && attempted > 0) {
      toast({
        title: 'Éxito',
        description: `${persistedCount} actividad(es) generada(s) exitosamente`,
      });
      if (onSuccess) await onSuccess();
    } else if (persistedCount > 0) {
      toast({
        title: 'Éxito parcial',
        description: `Se generaron ${persistedCount} de ${attempted} actividades. Revisa el detalle en el diálogo.`,
        variant: 'destructive',
      });
      if (onSuccess) await onSuccess();
    } else {
      toast({
        title: 'Error',
        description: 'No se pudo generar ninguna actividad. Revisa el detalle en el diálogo.',
        variant: 'destructive',
      });
    }
  };

  // Continuar — stages the checked groups and opens the materials step. No
  // generation and no invoke happen here ([S1-R]); only the inventory fetch does.
  const handleContinueToMaterials = () => {
    if (selectedGroupIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un grupo de edad',
        variant: 'destructive',
      });
      return;
    }

    setPendingGroupIds(Array.from(selectedGroupIds));
    setRegenerateGroupId(null);
    setViewState('materials');
  };

  // M-D7: Regenerar stages exactly its own group and routes through the SAME
  // step, so a single group can never silently reuse a stale selection.
  const handleRegenerate = (groupId: string) => {
    setPendingGroupIds([groupId]);
    setRegenerateGroupId(groupId);
    setViewState('materials');
  };

  // Volver — back to 'select' with both the group and the material checkbox
  // state intact for this dialog session (M-D7).
  const handleBackFromMaterials = () => {
    setViewState('select');
  };

  const handleGenerateFromMaterials = async () => {
    const requestLiturgyId = liturgyId;
    const groupIds = pendingGroupIds;
    const regeneratedGroupId = regenerateGroupId;
    if (groupIds.length === 0) return;

    setIsGenerating(true);
    try {
      // The canonical effective list, computed ONCE for this click.
      await runGenerationForGroups(groupIds, requestLiturgyId, effectiveMaterials);
      if (!regeneratedGroupId) return;
      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
      // Refresh existing activities map for this group so returning to 'select' shows updated data
      const { data: updated, error: updatedError } = await supabase
        .from('church_children_lessons')
        .select('*')
        .eq('liturgy_id', requestLiturgyId)
        .eq('age_group_id', regeneratedGroupId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
      const updatedRow = (updated as ChildrenLessonRow[] | null)?.[0] ?? null;
      if (updatedError) {
        console.warn('Error actualizando actividad regenerada:', updatedError);
        toast({
          title: 'Aviso',
          description: 'La actividad se regeneró, pero no se pudo actualizar la vista. Vuelve a abrir el diálogo.',
          variant: 'destructive',
        });
        return;
      }
      if (updatedRow) {
        setExistingActivities((prev) => {
          const next = new Map(prev);
          next.set(regeneratedGroupId, updatedRow);
          return next;
        });
      }
    } catch (error) {
      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      if (isActiveRef.current && requestLiturgyId === liturgyIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleOpenRefine = (groupId: string) => {
    const lesson = existingActivities.get(groupId);
    const ageGroup = ageGroups.find((g) => g.id === groupId);
    if (!lesson || !ageGroup) return;
    setRefineTarget({ lesson, ageGroup });
    setFeedback('');
    setRefinementType('general');
    setLastRefinementNotes(null);
    setViewState('refine');
  };

  const handleRefineAgain = () => {
    setFeedback('');
    setRefinementType('general');
    setLastRefinementNotes(null);
    setViewState('refine');
  };

  const handleSubmitRefine = async () => {
    const requestLiturgyId = liturgyId;
    if (!refineTarget) return;
    const trimmed = feedback.trim();
    if (trimmed.length === 0) {
      toast({
        title: 'Error',
        description: 'Escribe qué te gustaría ajustar.',
        variant: 'destructive',
      });
      return;
    }

    setIsRefining(true);
    const target = refineTarget;
    try {
      const result = await refineChildrenActivity({
        lessonId: target.lesson.id,
        feedback: trimmed,
        refinementType,
        liturgyContext: { title: liturgyTitle, summary: liturgySummary },
      });

      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;

      if (result.success) {
        // Refresh this lesson in the existing map so a second refinement uses the updated content
        const { data: updated, error: updatedError } = await supabase
          .from('church_children_lessons')
          .select('*')
          .eq('id', target.lesson.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;

        const nextRow = (updated as ChildrenLessonRow[] | null)?.[0] ?? null;
        if (updatedError) {
          console.warn('Error recargando lección refinada:', updatedError);
          toast({
            title: 'Aviso',
            description: 'La actividad se refinó, pero no se pudo recargar la vista. Vuelve a abrirla para ver el resultado.',
            variant: 'destructive',
          });
        } else if (nextRow) {
          setExistingActivities((prev) => {
            const next = new Map(prev);
            next.set(target.ageGroup.id, nextRow);
            return next;
          });
          setRefineTarget({ lesson: nextRow, ageGroup: target.ageGroup });
        }

        setLastRefinementNotes(result.refinementNotes ?? null);
        setViewState('refine-confirm');

        toast({
          title: 'Actividad refinada',
          description: `Se actualizó la actividad para ${result.ageGroupLabel}.`,
        });

        if (onSuccess) await onSuccess();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo refinar la actividad.',
          variant: 'destructive',
        });
        // Preserve feedback text so the user can retry.
      }
    } catch (error) {
      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
      // Preserve feedback text so the user can retry.
    } finally {
      if (isActiveRef.current && requestLiturgyId === liturgyIdRef.current) {
        setIsRefining(false);
      }
    }
  };

  if (!isOpen) return null;

  const groupsWithoutActivity = ageGroups.filter((g) => !existingActivities.has(g.id));
  const groupsWithActivity = ageGroups.filter((g) => existingActivities.has(g.id));
  const isBusy = isGenerating || isRefining;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {(viewState === 'refine' || viewState === 'refine-confirm') && refineTarget
              ? `Refinar actividad — ${refineTarget.ageGroup.name}`
              : 'Actividades de Niños'}
          </DialogTitle>
        </DialogHeader>

        {viewState === 'select' && (
          <div className="space-y-4 py-4">
            {isLoading && (
              <div className="text-center text-sm text-muted-foreground">
                Cargando actividades existentes…
              </div>
            )}

            {!isLoading && groupsWithActivity.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Actividades generadas:</p>
                {groupsWithActivity.map((group) => {
                  const lesson = existingActivities.get(group.id)!;
                  return (
                    <div
                      key={group.id}
                      className="rounded-md border p-3 space-y-2"
                      style={{
                        borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                        backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}15`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{group.name}</p>
                          <p
                            className="text-sm truncate"
                            style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                          >
                            {lesson.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.duration_minutes} min
                          </p>
                          {lesson.materials_needed && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Materiales: {truncateMaterials(lesson.materials_needed)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRefine(group.id)}
                          disabled={isBusy}
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Refinar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerate(group.id)}
                          disabled={isBusy}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Regenerar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoading && groupsWithoutActivity.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {groupsWithActivity.length > 0
                    ? 'Generar para otros grupos:'
                    : 'Selecciona grupos de edad:'}
                </p>
                {groupsWithoutActivity.map((group) => (
                  <div key={group.id} className="flex items-center gap-3">
                    <Checkbox
                      id={group.id}
                      checked={selectedGroupIds.has(group.id)}
                      onCheckedChange={() => handleAgeGroupToggle(group.id)}
                      disabled={isBusy}
                    />
                    <label htmlFor={group.id} className="flex-1 cursor-pointer text-sm">
                      {group.name}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {!isLoading &&
              groupsWithoutActivity.length === 0 &&
              groupsWithActivity.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos los grupos de edad ya tienen actividad. Puedes refinar o regenerar las
                  actividades existentes.
                </p>
              )}

            <div
              className="rounded-md border p-3"
              style={{
                borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}20`,
              }}
            >
              <p
                className="text-xs"
                style={{ color: CASA_BRAND.colors.secondary.grayDark }}
              >
                Las actividades incluyen 3 fases (movimiento, expresión/conversación, reflexión)
                adaptadas a cada grupo de edad.
              </p>
            </div>
          </div>
        )}

        {viewState === 'materials' && (
          <>
            <MaterialsStepView
              groupNames={pendingGroupIds
                .map((id) => ageGroups.find((group) => group.id === id)?.name)
                .filter((name): name is string => Boolean(name))}
              items={orderedInventoryItems}
              checkedIds={checkedMaterialIds}
              extras={materialExtras}
              savingExtra={savingExtra}
              isLoading={isInventoryLoading}
              loadError={inventoryLoadError}
              capReached={capReached}
              effectiveCount={effectiveMaterials.length}
              onToggleItem={handleToggleMaterial}
              onToggleAll={handleToggleAllMaterials}
              onAddExtra={handleAddExtra}
              onSaveExtra={handleSaveExtra}
            />
            {inventoryOverCapCount !== null && (
              <p className="text-xs" style={{ color: CASA_BRAND.colors.primary.amber }}>
                {`El inventario tiene ${inventoryOverCapCount} materiales; se preseleccionaron los primeros ${MAX_AVAILABLE_MATERIALS}.`}
              </p>
            )}
          </>
        )}

        {viewState === 'refine' && refineTarget && (() => {
          const phases = parseLessonPhases(refineTarget.lesson.content);
          const materials = refineTarget.lesson.materials_needed?.trim();
          return (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
              <div
                className="rounded-md border p-3 space-y-2"
                style={{
                  borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                  backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}15`,
                }}
              >
                <div>
                  <p className="text-sm font-semibold">{refineTarget.lesson.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {refineTarget.lesson.duration_minutes} min
                  </p>
                </div>

                {materials && (
                  <div>
                    <p className="text-xs font-medium">Materiales</p>
                    <p
                      className="text-xs"
                      style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                    >
                      {materials}
                    </p>
                  </div>
                )}

                {phases.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Fases</p>
                    <ul className="space-y-1">
                      {phases.map((phase, idx) => (
                        <li key={`${phase.phase}-${idx}`} className="text-xs">
                          <span className="font-medium">
                            {PHASE_LABEL[phase.phase] ?? phase.phase}
                          </span>
                          {' — '}
                          <span style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                            {phase.title} ({phase.minutes} min)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="refine-type" className="text-sm font-medium">
                  Tipo de ajuste
                </label>
                <Select
                  value={refinementType}
                  onValueChange={(value) => setRefinementType(value as RefinementType)}
                  disabled={isRefining}
                >
                  <SelectTrigger id="refine-type">
                    <SelectValue placeholder="Selecciona el tipo de ajuste" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFINEMENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="refine-feedback" className="text-sm font-medium">
                  ¿Qué te gustaría ajustar?
                </label>
                <Textarea
                  id="refine-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ej: No tengo acceso a témpera..."
                  rows={5}
                  disabled={isRefining}
                />
              </div>
            </div>
          );
        })()}

        {viewState === 'refine-confirm' && refineTarget && (
          <div className="space-y-4 py-4">
            <div
              className="rounded-md border p-3 flex items-start gap-2"
              style={{
                borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}15`,
              }}
              role="status"
            >
              <Check
                className="h-4 w-4 mt-0.5 text-green-600 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium">
                  Actividad refinada para {refineTarget.ageGroup.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {refineTarget.lesson.title} · {refineTarget.lesson.duration_minutes} min
                </p>
              </div>
            </div>

            {lastRefinementNotes && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Notas del refinamiento</p>
                <p
                  className="text-sm whitespace-pre-wrap rounded-md border p-3"
                  style={{
                    borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                    color: CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  {lastRefinementNotes}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleRefineAgain}
              className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
              style={{ color: CASA_BRAND.colors.primary.amber }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Refinar de nuevo
            </button>
          </div>
        )}

        {viewState === 'results' && (() => {
          const succeeded = results.filter((r) => r.success).length;
          const totalAttempted = results.length;
          const failedResults = results.filter((r) => !r.success);
          const allSucceeded = totalAttempted > 0 && succeeded === totalAttempted;
          return (
            <div className="space-y-4 py-4">
              <div
                className="rounded-md border p-3 space-y-1"
                role={allSucceeded ? 'status' : 'alert'}
                style={{
                  borderColor: allSucceeded
                    ? '#16a34a40'
                    : `${CASA_BRAND.colors.primary.amber}40`,
                  backgroundColor: allSucceeded
                    ? '#16a34a10'
                    : `${CASA_BRAND.colors.primary.amber}15`,
                }}
              >
                <p className="text-sm font-medium">
                  {succeeded} de {totalAttempted} actividad(es) generada(s) y guardada(s)
                </p>
                {failedResults.length > 0 && (
                  <p className="text-xs" style={{ color: '#b91c1c' }}>
                    Con error: {failedResults.map((r) => r.ageGroupLabel).join(', ')}
                  </p>
                )}
                {!allSucceeded && succeeded > 0 && (
                  <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                    Éxito parcial — revisa los grupos con error antes de exportar.
                  </p>
                )}
              </div>
              <p className="text-sm font-medium">Detalle por grupo:</p>
              <div
                className="space-y-2 max-h-60 overflow-y-auto"
                aria-live="polite"
                aria-label="Resultados de actividades"
              >
                {results.map((result) => (
                <div
                  key={result.ageGroupId}
                  className="flex items-center justify-between rounded-md border p-3"
                  role={result.success ? 'status' : 'alert'}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.ageGroupLabel}</p>
                    {result.success ? (
                      <p className="text-xs text-green-600">
                        Actividad lista ({result.estimatedMinutes || 30} min)
                      </p>
                    ) : (
                      <p className="text-xs text-red-600">{result.error}</p>
                    )}
                  </div>
                  {result.success ? (
                    <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
                  ) : (
                    <X className="h-5 w-5 text-red-600" aria-hidden="true" />
                  )}
                </div>
                ))}
              </div>
            </div>
          );
        })()}

        <DialogFooter>
          {viewState === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isBusy}>
                Cerrar
              </Button>
              {groupsWithoutActivity.length > 0 && (
                <Button
                  onClick={handleContinueToMaterials}
                  disabled={isBusy || selectedGroupIds.size === 0}
                >
                  Continuar
                </Button>
              )}
            </>
          )}

          {viewState === 'materials' && (
            <>
              <Button variant="outline" onClick={handleBackFromMaterials} disabled={isBusy}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Volver
              </Button>
              {/* M-D10: disabled until the first inventory request settles. */}
              <Button
                onClick={handleGenerateFromMaterials}
                disabled={isBusy || !inventorySettled}
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGenerating ? 'Generando…' : 'Generar'}
              </Button>
            </>
          )}

          {viewState === 'refine' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setViewState('select');
                  setRefineTarget(null);
                  setFeedback('');
                  setRefinementType('general');
                  setLastRefinementNotes(null);
                }}
                disabled={isRefining}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitRefine}
                disabled={isRefining || feedback.trim().length === 0}
              >
                {isRefining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRefining ? 'Refinando…' : 'Refinar'}
              </Button>
            </>
          )}

          {viewState === 'refine-confirm' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setViewState('select');
                  setRefineTarget(null);
                  setFeedback('');
                  setRefinementType('general');
                  setLastRefinementNotes(null);
                }}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Volver
              </Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </>
          )}

          {viewState === 'results' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setResults([]);
                  setViewState('select');
                  setRefineTarget(null);
                  setFeedback('');
                  setSelectedGroupIds(new Set());
                }}
              >
                Volver
              </Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
