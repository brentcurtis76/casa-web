/**
 * StemPlayer — Main multi-track audio mixer component.
 *
 * Orchestrates stem playback, controls, and session saving.
 */

import { useEffect, useState } from 'react';
import { useStemPlayer } from '@/hooks/useStemPlayer';
import { useStems, useCreatePracticeSession } from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Save, AlertCircle, Music } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import StemPlayerTrack from './StemPlayerTrack';
import StemPlayerTransport from './StemPlayerTransport';
import { useAuth } from '@/components/auth/AuthContext';

interface StemPlayerProps {
  songId: string;
  arrangementId: string;
  songTitle: string;
  arrangementName?: string;
  onClose: () => void;
}

const StemPlayer = ({
  songId,
  arrangementId,
  songTitle,
  arrangementName,
  onClose,
}: StemPlayerProps) => {
  const { user } = useAuth();
  const [state, actions] = useStemPlayer();
  const { data: stems, isLoading: stemsLoading, isError: stemsError } = useStems(arrangementId);
  const createSessionMutation = useCreatePracticeSession();

  const [loopDialogOpen, setLoopDialogOpen] = useState(false);
  const [loopStartInput, setLoopStartInput] = useState('0');
  const [loopEndInput, setLoopEndInput] = useState('0');
  const [loopError, setLoopError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Load stems when available
  useEffect(() => {
    if (stems && stems.length > 0 && state.tracks.length === 0) {
      actions.loadStems(stems);
    }
  }, [stems, state.tracks.length, actions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      actions.destroy();
    };
  }, [actions]);

  const handleSaveSession = async () => {
    if (!user) return;

    const sessionData = await actions.saveSession(user.id, songId, arrangementId);
    createSessionMutation.mutate(sessionData);
  };

  const handleSeek = (values: number[]) => {
    actions.seekTo(values[0]);
  };

  const handleToggleLoop = () => {
    if (state.loopStart !== null && state.loopEnd !== null) {
      actions.clearLoop();
      setStatusMessage('Loop desactivado');
    } else {
      // Open loop dialog or set default loop (0 to duration)
      setLoopStartInput('0');
      setLoopEndInput(state.duration.toFixed(1));
      setLoopDialogOpen(true);
    }
  };

  const handleSetLoop = () => {
    const start = parseFloat(loopStartInput);
    const end = parseFloat(loopEndInput);
    if (isNaN(start) || isNaN(end)) {
      setLoopError('Valores inválidos');
      return;
    }
    if (start >= end) {
      setLoopError('El inicio debe ser menor que el fin');
      return;
    }
    actions.setLoop(start, end);
    setLoopDialogOpen(false);
    setLoopError('');
    setStatusMessage('Loop activado');
  };

  const handleTempoChange = (delta: number) => {
    actions.setTempo(state.tempoFactor + delta);
  };

  // Loading state
  if (stemsLoading || state.isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (stemsError || state.error) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Stem Player</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {state.error || 'Error al cargar los stems. Por favor, intenta de nuevo.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (!stems || stems.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{songTitle}</h2>
            {arrangementName && <p className="text-sm text-gray-500">{arrangementName}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Alert>
          <Music className="h-4 w-4" />
          <AlertTitle>No hay stems subidos</AlertTitle>
          <AlertDescription>
            No hay stems subidos para este arreglo. Ve a la Biblioteca de Música para subir stems.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loopActive = state.loopStart !== null && state.loopEnd !== null;

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: CASA_BRAND.colors.primary.black }}>
            {songTitle}
          </h2>
          {arrangementName && (
            <p className="text-sm text-gray-500">{arrangementName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveSession}
            disabled={createSessionMutation.isPending || !user}
            aria-label="Guardar sesión"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.amber,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Guardar sesión
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Track List */}
      <ScrollArea className="h-[400px] p-4">
        <div className="space-y-3">
          {state.tracks.map(track => (
            <StemPlayerTrack
              key={track.stemType}
              track={track}
              onVolumeChange={actions.setVolume}
              onToggleMute={actions.toggleMute}
              onToggleSolo={actions.toggleSolo}
              onContainerReady={actions.registerContainer}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Transport Bar */}
      <StemPlayerTransport
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        loopActive={loopActive}
        tempoFactor={state.tempoFactor}
        onPlay={actions.play}
        onPause={actions.pause}
        onStop={actions.stop}
        onSeek={handleSeek}
        onToggleLoop={handleToggleLoop}
        onTempoChange={handleTempoChange}
      />

      {/* ARIA Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* Loop Dialog */}
      <Dialog open={loopDialogOpen} onOpenChange={setLoopDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Loop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="loop-start">Inicio (segundos)</Label>
              <Input
                id="loop-start"
                type="number"
                value={loopStartInput}
                onChange={e => setLoopStartInput(e.target.value)}
                step="0.1"
                min="0"
                max={state.duration}
                aria-label="Inicio del loop en segundos"
              />
            </div>
            <div>
              <Label htmlFor="loop-end">Fin (segundos)</Label>
              <Input
                id="loop-end"
                type="number"
                value={loopEndInput}
                onChange={e => setLoopEndInput(e.target.value)}
                step="0.1"
                min="0"
                max={state.duration}
                aria-label="Fin del loop en segundos"
              />
            </div>
            {loopError && (
              <Alert variant="destructive">
                <AlertDescription>{loopError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSetLoop} className="flex-1">
                Aplicar
              </Button>
              <Button variant="outline" onClick={() => { setLoopDialogOpen(false); setLoopError(''); }} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StemPlayer;
