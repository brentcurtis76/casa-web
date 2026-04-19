/**
 * Children Activity Dialog — Age group selection, refinement, and regeneration
 *
 * View states:
 *   - 'select'            → show existing activities per group (with Refinar/Regenerar)
 *                           + checkboxes for groups that do NOT yet have an activity.
 *   - 'refine'            → feedback input for a specific existing lesson.
 *   - 'refine-confirm'    → confirmation panel after successful refinement.
 *   - 'results'           → per-group generation results.
 *
 * Pattern: ExportPanel + MusicPublishDialog
 */

import React, { useState, useEffect, useRef } from 'react';
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
import type { ChildrenAgeGroupRow, ChildrenLessonRow } from '@/types/childrenMinistry';
import type {
  GroupGenerationResult,
  LessonPhase,
  RefinementType,
} from '@/types/childrenPublicationState';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import {
  publishChildrenActivities,
  refineChildrenActivity,
  type PublishChildrenActivitiesParams,
} from '@/lib/children-ministry/liturgyChildrenPublishService';
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
  onSuccess?: () => void;
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

type ViewState = 'select' | 'refine' | 'refine-confirm' | 'results';

type ExistingActivityMap = Map<string, ChildrenLessonRow>;

function truncateMaterials(materials: string | null, limit = 80): string {
  if (!materials) return '';
  const trimmed = materials.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
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

        const { data: lessons, error: lessonsError } = await supabase
          .from('church_children_lessons')
          .select('*')
          .eq('liturgy_id', liturgyId)
          .order('updated_at', { ascending: false });

        if (cancelled) return;

        if (lessonsError) {
          console.warn('Error cargando actividades existentes:', lessonsError);
          toast({
            title: 'Aviso',
            description: 'No se pudieron cargar las actividades existentes.',
            variant: 'destructive',
          });
          return;
        }

        const map: ExistingActivityMap = new Map();
        if (lessons) {
          for (const lesson of lessons as ChildrenLessonRow[]) {
            if (lesson.age_group_id && !map.has(lesson.age_group_id)) {
              map.set(lesson.age_group_id, lesson);
            }
          }
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

  const resetAll = () => {
    setSelectedGroupIds(new Set());
    setResults([]);
    setViewState('select');
    setRefineTarget(null);
    setFeedback('');
    setRefinementType('general');
    setLastRefinementNotes(null);
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

  const runGenerationForGroups = async (groupIds: string[], requestLiturgyId: string) => {
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
    };

    const result = await publishChildrenActivities(params);

    if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;

    setResults(result.results);
    setViewState('results');

    if (result.success && result.results.every((r) => r.success)) {
      toast({
        title: 'Éxito',
        description: `${result.totalActivitiesGenerated} actividad(es) generada(s) exitosamente`,
      });
      if (onSuccess) onSuccess();
    } else if (result.totalActivitiesGenerated > 0) {
      toast({
        title: 'Éxito parcial',
        description: `Se generaron ${result.totalActivitiesGenerated} de ${groupIds.length} actividades.`,
        variant: 'destructive',
      });
      if (onSuccess) onSuccess();
    } else {
      toast({
        title: 'Error',
        description: 'No se pudo generar ninguna actividad.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateNew = async () => {
    const requestLiturgyId = liturgyId;
    if (selectedGroupIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un grupo de edad',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      await runGenerationForGroups(Array.from(selectedGroupIds), requestLiturgyId);
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

  const handleRegenerate = async (groupId: string) => {
    const requestLiturgyId = liturgyId;
    setIsGenerating(true);
    try {
      await runGenerationForGroups([groupId], requestLiturgyId);
      if (!isActiveRef.current || requestLiturgyId !== liturgyIdRef.current) return;
      // Refresh existing activities map for this group so returning to 'select' shows updated data
      const { data: updated, error: updatedError } = await supabase
        .from('church_children_lessons')
        .select('*')
        .eq('liturgy_id', liturgyId)
        .eq('age_group_id', groupId)
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
          next.set(groupId, updatedRow);
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

        if (onSuccess) onSuccess();
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

        {viewState === 'results' && (
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium">Resultados:</p>
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
        )}

        <DialogFooter>
          {viewState === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isBusy}>
                Cerrar
              </Button>
              {groupsWithoutActivity.length > 0 && (
                <Button
                  onClick={handleGenerateNew}
                  disabled={isBusy || selectedGroupIds.size === 0}
                >
                  {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isGenerating ? 'Generando…' : 'Generar'}
                </Button>
              )}
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
