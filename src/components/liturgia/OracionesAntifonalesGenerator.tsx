/**
 * OracionesAntifonalesGenerator - Componente principal para generar oraciones antifonales
 *
 * Flujo:
 * 1. Formulario: Ingresar datos de la liturgia
 * 2. Revisión: Editar y aprobar las oraciones generadas
 * 3. Slides: Generar y descargar slides para presentación
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Loader2,
  FileText,
  Edit3,
  Image as ImageIcon,
  ArrowLeft,
  Save,
  Check,
  PlusCircle,
  FolderOpen,
} from 'lucide-react';
import { LiturgiaForm } from './LiturgiaForm';
import { OracionEditor } from './OracionEditor';
import { SlideGenerator } from './SlideGenerator';
import { SavedLiturgias } from './SavedLiturgias';
import { LABELS } from './constants';
import type {
  LiturgiaInput,
  LecturaFetched,
  OracionesAntifonales,
  Oracion,
  WorkflowPhase,
  ApprovalState,
  TipoOracion,
  GenerateOracionesResponse,
} from './types';

export const OracionesAntifonalesGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Admin check
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Main tab state (create vs saved)
  const [mainTab, setMainTab] = useState<'create' | 'saved'>('create');

  // Workflow state
  const [phase, setPhase] = useState<WorkflowPhase>('form');
  const [liturgiaInput, setLiturgiaInput] = useState<LiturgiaInput | null>(null);
  const [lecturas, setLecturas] = useState<LecturaFetched[]>([]);
  const [oraciones, setOraciones] = useState<OracionesAntifonales | null>(null);
  const [approval, setApproval] = useState<ApprovalState>({
    invocacion: false,
    arrepentimiento: false,
    gratitud: false,
  });

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingTipo, setRegeneratingTipo] = useState<TipoOracion | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('mesa_abierta_admin_roles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        setIsAdmin(!!data && !error);
      } catch (err) {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);

  // Generate oraciones using Claude API
  const handleGenerate = async (input: LiturgiaInput, lecturasData: LecturaFetched[]) => {
    setIsGenerating(true);
    setLiturgiaInput(input);
    setLecturas(lecturasData);

    try {
      const { data, error } = await supabase.functions.invoke<GenerateOracionesResponse>(
        'generate-oraciones',
        {
          body: {
            liturgia: {
              titulo: input.titulo,
              resumen: input.resumen,
              lecturas: lecturasData.map((l) => ({
                cita: l.cita,
                texto: l.texto,
              })),
            },
          },
        }
      );

      if (error) throw error;

      if (!data?.success || !data.oraciones) {
        throw new Error(data?.error || 'Error desconocido');
      }

      setOraciones(data.oraciones);
      setApproval({
        invocacion: false,
        arrepentimiento: false,
        gratitud: false,
      });
      setPhase('review');

      toast({
        title: 'Oraciones generadas',
        description: `Usando modelo ${data.model || 'Claude'}. Tokens: ${data.usage?.input_tokens || 0} in, ${data.usage?.output_tokens || 0} out`,
      });
    } catch (err) {
      console.error('Error generating oraciones:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudieron generar las oraciones',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Update a specific oracion
  const handleUpdateOracion = (tipo: TipoOracion, oracion: Oracion) => {
    if (!oraciones) return;
    setOraciones({
      ...oraciones,
      [tipo]: oracion,
    });
    // Clear approval when edited
    setApproval((prev) => ({
      ...prev,
      [tipo]: false,
    }));
  };

  // Approve an oracion
  const handleApprove = (tipo: TipoOracion) => {
    setApproval((prev) => ({
      ...prev,
      [tipo]: true,
    }));
  };

  // Regenerate a specific oracion
  const handleRegenerate = async (tipo: TipoOracion) => {
    if (!liturgiaInput || !lecturas.length) return;

    setRegeneratingTipo(tipo);

    try {
      const { data, error } = await supabase.functions.invoke<GenerateOracionesResponse>(
        'generate-oraciones',
        {
          body: {
            liturgia: {
              titulo: liturgiaInput.titulo,
              resumen: liturgiaInput.resumen,
              lecturas: lecturas.map((l) => ({
                cita: l.cita,
                texto: l.texto,
              })),
            },
          },
        }
      );

      if (error) throw error;

      if (!data?.success || !data.oraciones) {
        throw new Error(data?.error || 'Error desconocido');
      }

      // Only update the specific oracion
      if (oraciones) {
        setOraciones({
          ...oraciones,
          [tipo]: data.oraciones[tipo],
        });
      }

      setApproval((prev) => ({
        ...prev,
        [tipo]: false,
      }));

      toast({
        title: `${LABELS.oraciones[tipo]} regenerada`,
        description: 'Revisa el nuevo texto generado',
      });
    } catch (err) {
      console.error('Error regenerating oracion:', err);
      toast({
        title: 'Error',
        description: 'No se pudo regenerar la oración',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingTipo(null);
    }
  };

  // Save to database
  const handleSave = async () => {
    if (!liturgiaInput || !oraciones || !user) return;

    setIsSaving(true);

    try {
      // Create liturgia record
      const { data: liturgiaData, error: liturgiaError } = await supabase
        .from('liturgias')
        .insert({
          fecha: liturgiaInput.fecha.toISOString().split('T')[0],
          titulo: liturgiaInput.titulo,
          resumen: liturgiaInput.resumen,
          created_by: user.id,
        })
        .select()
        .single();

      if (liturgiaError) throw liturgiaError;

      const liturgiaId = liturgiaData.id;

      // Insert lecturas
      if (lecturas.length > 0) {
        const lecturasInsert = lecturas.map((l, index) => ({
          liturgia_id: liturgiaId,
          cita: l.cita,
          texto: l.texto,
          version: l.versionCode,
          orden: index,
        }));

        const { error: lecturasError } = await supabase
          .from('liturgia_lecturas')
          .insert(lecturasInsert);

        if (lecturasError) throw lecturasError;
      }

      // Insert oraciones
      const tipos: TipoOracion[] = ['invocacion', 'arrepentimiento', 'gratitud'];
      const oracionesInsert = tipos.map((tipo) => ({
        liturgia_id: liturgiaId,
        tipo,
        tiempos: oraciones[tipo].tiempos,
        aprobada: approval[tipo],
      }));

      const { error: oracionesError } = await supabase
        .from('liturgia_oraciones')
        .insert(oracionesInsert);

      if (oracionesError) throw oracionesError;

      toast({
        title: 'Liturgia guardada',
        description: 'Las oraciones han sido guardadas exitosamente',
      });
    } catch (err) {
      console.error('Error saving liturgia:', err);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la liturgia',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check all approved
  const allApproved = approval.invocacion && approval.arrepentimiento && approval.gratitud;

  // Reset to start
  const handleReset = () => {
    setPhase('form');
    setOraciones(null);
    setLiturgiaInput(null);
    setLecturas([]);
    setApproval({
      invocacion: false,
      arrepentimiento: false,
      gratitud: false,
    });
  };

  // Load a saved liturgia
  const handleLoadSaved = (
    input: LiturgiaInput,
    lecturasData: LecturaFetched[],
    oracionesData: OracionesAntifonales
  ) => {
    setLiturgiaInput(input);
    setLecturas(lecturasData);
    setOraciones(oracionesData);
    // Mark all as approved since they were saved
    setApproval({
      invocacion: true,
      arrepentimiento: true,
      gratitud: true,
    });
    setPhase('review');
    setMainTab('create');
    toast({
      title: 'Liturgia cargada',
      description: `"${input.titulo}" cargada exitosamente`,
    });
  };

  // Loading state
  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Not authorized
  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acceso Restringido</AlertTitle>
        <AlertDescription>
          Solo los administradores pueden acceder al generador de oraciones antifonales.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Reset button when not in form phase */}
      {phase !== 'form' && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleReset}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nueva liturgia
          </Button>
        </div>
      )}

      {/* Main Tabs: Create vs Saved (only show when in form phase) */}
      {phase === 'form' && (
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'create' | 'saved')} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Crear Nueva
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Guardadas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <LiturgiaForm onGenerate={handleGenerate} isGenerating={isGenerating} />
          </TabsContent>

          <TabsContent value="saved">
            <SavedLiturgias onLoad={handleLoadSaved} />
          </TabsContent>
        </Tabs>
      )}

      {/* Phase: Review */}
      {phase === 'review' && oraciones && liturgiaInput && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">{liturgiaInput.titulo}</h2>
                <p className="text-sm text-gray-500">
                  {liturgiaInput.fecha.toLocaleDateString('es-CL', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {allApproved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Todas aprobadas
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs for navigation */}
          <Tabs defaultValue="oraciones" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oraciones" className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Revisar Oraciones
              </TabsTrigger>
              <TabsTrigger
                value="slides"
                className="flex items-center gap-2"
                disabled={!allApproved}
              >
                <ImageIcon className="h-4 w-4" />
                Generar Slides
                {!allApproved && (
                  <span className="text-xs text-gray-400">(aprueba todas)</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Oraciones */}
            <TabsContent value="oraciones" className="space-y-4 mt-6">
              <OracionEditor
                tipo="invocacion"
                oracion={oraciones.invocacion}
                isApproved={approval.invocacion}
                onUpdate={(o) => handleUpdateOracion('invocacion', o)}
                onApprove={() => handleApprove('invocacion')}
                onRegenerate={() => handleRegenerate('invocacion')}
                isRegenerating={regeneratingTipo === 'invocacion'}
              />

              <OracionEditor
                tipo="arrepentimiento"
                oracion={oraciones.arrepentimiento}
                isApproved={approval.arrepentimiento}
                onUpdate={(o) => handleUpdateOracion('arrepentimiento', o)}
                onApprove={() => handleApprove('arrepentimiento')}
                onRegenerate={() => handleRegenerate('arrepentimiento')}
                isRegenerating={regeneratingTipo === 'arrepentimiento'}
              />

              <OracionEditor
                tipo="gratitud"
                oracion={oraciones.gratitud}
                isApproved={approval.gratitud}
                onUpdate={(o) => handleUpdateOracion('gratitud', o)}
                onApprove={() => handleApprove('gratitud')}
                onRegenerate={() => handleRegenerate('gratitud')}
                isRegenerating={regeneratingTipo === 'gratitud'}
              />
            </TabsContent>

            {/* Tab: Slides */}
            <TabsContent value="slides" className="mt-6">
              {allApproved && (
                <SlideGenerator
                  oraciones={oraciones}
                  fecha={liturgiaInput.fecha}
                  titulo={liturgiaInput.titulo}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default OracionesAntifonalesGenerator;
