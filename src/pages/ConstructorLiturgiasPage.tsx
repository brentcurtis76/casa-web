/**
 * Página del Constructor de Liturgias
 * Acceso al sistema completo de construcción de liturgias CASA
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Plus,
  FileText,
  Trash2,
  Calendar,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ConstructorLiturgias from '@/components/liturgia-builder/ConstructorLiturgias';
import {
  saveLiturgy,
  loadLiturgy,
  listLiturgies,
  deleteLiturgy,
  downloadPortadaImage,
} from '@/lib/liturgia/liturgyService';
import type { Liturgy, PortadasConfig } from '@/types/shared/liturgy';

const STORAGE_KEY = 'casa-liturgy-draft';

type PageView = 'list' | 'editor';

interface LiturgyListItem {
  id: string;
  fecha: string;
  titulo: string;
  estado: string;
  porcentaje: number;
}

const ConstructorLiturgiasPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<PageView>('list');
  const [liturgies, setLiturgies] = useState<LiturgyListItem[]>([]);
  const [selectedLiturgy, setSelectedLiturgy] = useState<Liturgy | undefined>(undefined);
  const [selectedPortadaImage, setSelectedPortadaImage] = useState<string | null>(null);
  const [selectedPortadasConfig, setSelectedPortadasConfig] = useState<PortadasConfig | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Dirty state for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<'list' | 'dashboard' | null>(null);

  // Load list of liturgies
  const loadLiturgiesList = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listLiturgies();
      setLiturgies(list);
    } catch (err) {
      console.error('Error loading liturgies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadLiturgiesList();
  }, [loadLiturgiesList]);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Open a liturgy for editing
  const handleOpenLiturgy = async (id: string) => {
    setIsLoading(true);
    try {
      const result = await loadLiturgy(id);
      if (result) {
        setSelectedLiturgy(result.liturgy);

        // Download the portada image if it exists
        if (result.portadaImageUrl) {
          const imageBase64 = await downloadPortadaImage(result.portadaImageUrl);
          setSelectedPortadaImage(imageBase64);
        } else {
          setSelectedPortadaImage(null);
        }

        // Load portadas config if it exists
        setSelectedPortadasConfig(result.portadasConfig);

        setView('editor');
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la liturgia',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error opening liturgy:', err);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la liturgia',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create new liturgy
  const handleNewLiturgy = () => {
    setSelectedLiturgy(undefined);
    setSelectedPortadaImage(null);
    setSelectedPortadasConfig(undefined);
    setView('editor');
  };

  // Delete a liturgy
  const handleDeleteLiturgy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que quieres eliminar esta liturgia?')) return;

    setIsDeleting(id);
    try {
      const success = await deleteLiturgy(id);
      if (success) {
        toast({
          title: 'Liturgia eliminada',
          description: 'La liturgia ha sido eliminada',
        });
        loadLiturgiesList();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la liturgia',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error deleting liturgy:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  // Save handler
  const handleSave = useCallback(async (liturgy: Liturgy, portadaImage?: string | null, portadasConfig?: PortadasConfig) => {
    try {
      // Save to localStorage as backup (without image to save space)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(liturgy));

      // Save to Supabase with image and config
      const result = await saveLiturgy(liturgy, portadaImage, portadasConfig);

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido guardando liturgia');
      }

      toast({
        title: 'Guardado exitoso',
        description: portadaImage
          ? 'Tu liturgia e imagen han sido guardadas en la nube'
          : 'Tu liturgia ha sido guardada en la nube',
      });
      // Update the selected liturgy with any new IDs
      setSelectedLiturgy(liturgy);
      // Update the saved config
      if (portadasConfig) {
        setSelectedPortadasConfig(portadasConfig);
      }
    } catch (err) {
      console.error('Error saving liturgy:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast({
        title: 'Guardado incompleto',
        description: `No se pudo guardar en la nube. Respaldo local disponible. ${message}`,
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  // Handle navigation with unsaved changes check
  const handleNavigate = (destination: 'list' | 'dashboard') => {
    if (isDirty) {
      setPendingNavigation(destination);
      setShowUnsavedDialog(true);
    } else {
      performNavigation(destination);
    }
  };

  // Actually perform the navigation
  const performNavigation = (destination: 'list' | 'dashboard') => {
    setIsDirty(false);
    setShowUnsavedDialog(false);
    setPendingNavigation(null);

    if (destination === 'dashboard') {
      navigate('/admin');
    } else {
      setView('list');
      setSelectedLiturgy(undefined);
      loadLiturgiesList();
    }
  };

  // Back to list
  const handleBackToList = () => {
    handleNavigate('list');
  };

  // Back to dashboard
  const handleBackToDashboard = () => {
    handleNavigate('dashboard');
  };

  // Confirm discard changes
  const handleConfirmDiscard = () => {
    if (pendingNavigation) {
      performNavigation(pendingNavigation);
    }
  };

  // Cancel discard
  const handleCancelDiscard = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  if (!user) {
    return null;
  }

  // Loading state
  if (isLoading && view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p style={{ fontFamily: CASA_BRAND.fonts.body, color: CASA_BRAND.colors.secondary.grayMedium }}>
            Cargando liturgias...
          </p>
        </div>
      </div>
    );
  }

  // Editor view
  if (view === 'editor') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Unsaved Changes Dialog */}
        <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Cambios sin guardar
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tienes cambios que no se han guardado. Si sales ahora, perderás estos cambios.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDiscard}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDiscard}
                className="bg-red-500 hover:bg-red-600"
              >
                Descartar cambios
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AdminPageHeader
          title="Constructor de Liturgias"
          subtitle={selectedLiturgy ? 'Editando liturgia' : 'Nueva liturgia'}
          breadcrumbs={[
            { label: 'Liturgia' },
            { label: 'Mis Liturgias', href: '/admin/liturgia/constructor' },
            { label: selectedLiturgy ? 'Editor' : 'Nueva Liturgia' },
          ]}
          onBack={handleBackToList}
          hasUnsavedChanges={isDirty}
        />

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          <ConstructorLiturgias
            initialLiturgy={selectedLiturgy}
            initialPortadaImage={selectedPortadaImage}
            initialPortadasConfig={selectedPortadasConfig}
            onSave={handleSave}
            onDirtyChange={setIsDirty}
          />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Mis Liturgias"
        subtitle={`${liturgies.length} liturgia${liturgies.length !== 1 ? 's' : ''} guardada${liturgies.length !== 1 ? 's' : ''}`}
        breadcrumbs={[
          { label: 'Liturgia' },
          { label: 'Mis Liturgias' },
        ]}
        backTo="/admin"
        actions={
          <Button
            onClick={handleNewLiturgy}
            className="flex items-center gap-2"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            <Plus size={18} />
            Nueva Liturgia
          </Button>
        }
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {liturgies.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl border-2 border-dashed"
            style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
          >
            <FileText
              size={48}
              className="mx-auto mb-4"
              style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
            />
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '20px',
                color: CASA_BRAND.colors.primary.black,
                marginBottom: '8px',
              }}
            >
              No hay liturgias guardadas
            </h3>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
                marginBottom: '24px',
              }}
            >
              Crea tu primera liturgia para comenzar
            </p>
            <Button
              onClick={handleNewLiturgy}
              className="flex items-center gap-2 mx-auto"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              <Plus size={18} />
              Crear Liturgia
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {liturgies.map((liturgy) => {
              // Agregar T12:00:00 para evitar problemas de timezone
              // Sin esto, "2026-01-11" se interpreta como UTC medianoche,
              // que en Chile es el día anterior
              const fechaFormateada = format(new Date(liturgy.fecha + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es });
              const isComplete = liturgy.porcentaje === 100;

              return (
                <button
                  key={liturgy.id}
                  type="button"
                  onClick={() => handleOpenLiturgy(liturgy.id)}
                  className="w-full p-4 rounded-xl bg-white border text-left transition-all hover:shadow-md hover:border-amber-300 group"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: isComplete
                            ? `${CASA_BRAND.colors.primary.amber}20`
                            : CASA_BRAND.colors.secondary.grayLight,
                        }}
                      >
                        <FileText
                          size={24}
                          style={{
                            color: isComplete
                              ? CASA_BRAND.colors.primary.amber
                              : CASA_BRAND.colors.secondary.grayMedium,
                          }}
                        />
                      </div>
                      <div>
                        <h3
                          style={{
                            fontFamily: CASA_BRAND.fonts.heading,
                            fontSize: '18px',
                            fontWeight: 400,
                            color: CASA_BRAND.colors.primary.black,
                          }}
                        >
                          {liturgy.titulo}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar size={14} style={{ color: CASA_BRAND.colors.secondary.grayMedium }} />
                          <span
                            style={{
                              fontFamily: CASA_BRAND.fonts.body,
                              fontSize: '13px',
                              color: CASA_BRAND.colors.secondary.grayMedium,
                              textTransform: 'capitalize',
                            }}
                          >
                            {fechaFormateada}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Progress */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-24 h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${liturgy.porcentaje}%`,
                              backgroundColor: isComplete
                                ? '#22c55e'
                                : CASA_BRAND.colors.primary.amber,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: CASA_BRAND.fonts.body,
                            fontSize: '13px',
                            fontWeight: 500,
                            color: isComplete
                              ? '#22c55e'
                              : CASA_BRAND.colors.primary.amber,
                          }}
                        >
                          {liturgy.porcentaje}%
                        </span>
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteLiturgy(liturgy.id, e)}
                        className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                        disabled={isDeleting === liturgy.id}
                      >
                        {isDeleting === liturgy.id ? (
                          <Loader2 size={18} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={18} className="text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstructorLiturgiasPage;
