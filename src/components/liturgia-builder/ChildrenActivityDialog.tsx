/**
 * Children Activity Dialog — Age group selection and generation
 * Allows users to select age groups and generate children's activities
 * from a cuentacuentos element.
 *
 * Pattern: ExportPanel + MusicPublishDialog
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { useToast } from '@/hooks/use-toast';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';
import type { GroupGenerationResult } from '@/types/childrenPublicationState';
import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
import {
  publishChildrenActivities,
  type PublishChildrenActivitiesParams,
} from '@/lib/children-ministry/liturgyChildrenPublishService';
import { supabase } from '@/integrations/supabase/client';

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
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GroupGenerationResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [existingActivities, setExistingActivities] = useState<Set<string>>(new Set());
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);

  // Load age groups and check for existing activities
  useEffect(() => {
    if (!isOpen) return;

    (async () => {
      try {
        setIsCheckingExisting(true);
        const groups = await getAgeGroups();
        setAgeGroups(groups);

        // Check for existing activities for this liturgy
        const { data: existing } = await supabase
          .from('church_children_publication_state')
          .select('age_group_id')
          .eq('liturgy_id', liturgyId);

        if (existing) {
          setExistingActivities(new Set(existing.map((e) => e.age_group_id)));
        }
      } catch (_error) {
        // Silently fail — age groups will show as loading
      } finally {
        setIsCheckingExisting(false);
      }
    })();
  }, [isOpen, liturgyId]);

  const handleAgeGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroupIds);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroupIds(newSelected);
  };

  const handleGenerate = async () => {
    if (selectedGroupIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un grupo de edad',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setShowResults(false);

    try {
      const selectedGroups = ageGroups.filter((ag) => selectedGroupIds.has(ag.id));

      const params: PublishChildrenActivitiesParams = {
        liturgyId,
        liturgyTitle,
        liturgySummary,
        bibleText,
        liturgyDate,
        storyData,
        selectedAgeGroupIds: Array.from(selectedGroupIds),
        ageGroups: selectedGroups,
      };

      const result = await publishChildrenActivities(params);

      setResults(result.results);
      setShowResults(true);

      if (result.success) {
        toast({
          title: 'Exito',
          description: `${result.totalActivitiesGenerated} actividades generadas exitosamente`,
        });
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: 'Error parcial',
          description: `Se generaron ${result.totalActivitiesGenerated} de ${selectedGroupIds.size} actividades. Ver detalles abajo.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setSelectedGroupIds(new Set());
    setResults([]);
    setShowResults(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar Actividades de Niños</DialogTitle>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4 py-4">
            {isCheckingExisting && (
              <div className="text-center text-sm text-muted-foreground">
                Verificando actividades existentes...
              </div>
            )}

            {!isCheckingExisting && existingActivities.size > 0 && (
              <div
                className="flex gap-2 rounded-md border p-3"
                style={{
                  borderColor: `${CASA_BRAND.colors.primary.amber}40`,
                  backgroundColor: `${CASA_BRAND.colors.primary.amber}10`,
                }}
              >
                <AlertTriangle
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: CASA_BRAND.colors.primary.amber }}
                  aria-hidden="true"
                />
                <p
                  className="text-sm"
                  style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                >
                  Este liturgia ya tiene actividades generadas para algunos grupos. Al regenerar se
                  actualizara la version existente (no se duplicaran).
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Selecciona grupos de edad:</p>
              {ageGroups.map((group) => (
                <div key={group.id} className="flex items-center gap-3">
                  <Checkbox
                    id={group.id}
                    checked={selectedGroupIds.has(group.id)}
                    onCheckedChange={() => handleAgeGroupToggle(group.id)}
                    disabled={isGenerating}
                  />
                  <label htmlFor={group.id} className="flex-1 cursor-pointer text-sm">
                    {group.name}
                    {existingActivities.has(group.id) && (
                      <Badge variant="secondary" className="ml-2">
                        Existente
                      </Badge>
                    )}
                  </label>
                </div>
              ))}
            </div>

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
                Las actividades generadas incluyen una estructura de 3 fases (movimiento,
                expresion/conversacion, reflexion) adaptadas a cada grupo de edad.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium">Resultados de generacion:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto" aria-live="polite" aria-label="Resultados de generación de actividades">
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
                        Actividad generada ({result.estimatedMinutes || 30} min)
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
          {showResults ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || selectedGroupIds.size === 0}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isGenerating ? 'Generando...' : 'Generar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
