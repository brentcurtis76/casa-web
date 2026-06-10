/**
 * Sermon Audio Editor Page
 * Route: /admin/sermon-editor
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic2, Loader2, Rss } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import {
  QuickPublishContainer,
  SermonEditorContainer,
} from '@/components/sermon-editor';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BackfillPanel } from '@/components/sermon-editor/admin/BackfillPanel';
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

type EditorMode = 'quick' | 'advanced';

const MODE_STORAGE_KEY = 'sermon-editor-mode';

function readInitialMode(searchParams: URLSearchParams): EditorMode {
  const fromUrl = searchParams.get('modo');
  if (fromUrl === 'avanzado') return 'advanced';
  if (fromUrl === 'rapida') return 'quick';
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === 'advanced' || stored === 'quick') return stored;
  }
  return 'quick';
}

const SermonEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EditorMode>(() =>
    readInitialMode(searchParams),
  );
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);
  // Generation counter — bumping it remounts the active container, which is
  // how we discard in-progress work after the user confirms the mode switch.
  const [containerGen, setContainerGen] = useState(0);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      const { data } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!data) {
        toast({
          title: 'Acceso denegado',
          description: 'No tienes permisos de administrador.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdmin();
  }, [user, navigate, toast]);

  // Persist mode to localStorage + URL search param.
  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors (private mode / disabled).
    }
    const next = new URLSearchParams(searchParams);
    next.set('modo', mode === 'quick' ? 'rapida' : 'avanzado');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [mode, searchParams, setSearchParams]);

  const handleModeChange = (value: string) => {
    const next = value === 'advanced' ? 'advanced' : 'quick';
    if (next === mode) return;
    setPendingMode(next);
  };

  const confirmModeSwitch = () => {
    if (pendingMode) {
      setMode(pendingMode);
      setContainerGen((n) => n + 1);
    }
    setPendingMode(null);
  };

  const cancelModeSwitch = () => setPendingMode(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Editor de Reflexiones"
        description="Edita y exporta grabaciones de reflexiones para publicar en Spotify"
        icon={<Mic2 className="h-8 w-8 text-amber-600" />}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Editor de Reflexiones' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList>
              <TabsTrigger value="quick">Publicación rápida</TabsTrigger>
              <TabsTrigger value="advanced">Editor avanzado</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Rss className="mr-2 h-4 w-4" />
                Importar episodios antiguos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importar episodios antiguos</DialogTitle>
                <DialogDescription>
                  Copia los episodios ya publicados en Spotify al nuevo
                  alojamiento del podcast (paso único antes de la migración).
                </DialogDescription>
              </DialogHeader>
              <BackfillPanel />
            </DialogContent>
          </Dialog>
        </div>

        {mode === 'quick' ? (
          <QuickPublishContainer key={`quick-${containerGen}`} />
        ) : (
          <SermonEditorContainer key={`advanced-${containerGen}`} />
        )}
      </main>

      <AlertDialog
        open={pendingMode !== null}
        onOpenChange={(open) => {
          if (!open) cancelModeSwitch();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar de modo?</AlertDialogTitle>
            <AlertDialogDescription>
              Si cambias de modo se perderá el progreso actual. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelModeSwitch}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeSwitch}>
              Cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SermonEditorPage;
