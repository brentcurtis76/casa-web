/**
 * PracticeLogDialog — Create/edit dialog for manual practice session logging.
 *
 * Props:
 *   open: boolean
 *   onOpenChange: (open: boolean) => void
 *   sessionId?: string | null  — if truthy, edit mode (loads existing session)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSongs,
  useArrangements,
  useCreatePracticeSession,
  useUpdatePracticeSession,
  usePracticeSessionById,
} from '@/hooks/useMusicLibrary';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { MusicPracticeSessionInsert } from '@/types/musicPlanning';

interface PracticeLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string | null;
}

const NO_ARRANGEMENT = '__none__';

const PracticeLogDialog: React.FC<PracticeLogDialogProps> = ({
  open,
  onOpenChange,
  sessionId,
}) => {
  const isEdit = !!sessionId;

  // Form state
  const [userId, setUserId] = useState('');
  const [songId, setSongId] = useState('');
  const [arrangementId, setArrangementId] = useState<string>(NO_ARRANGEMENT);
  const [startedAt, setStartedAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [tempoFactor, setTempoFactor] = useState('1.0');

  // Data
  const { data: songs } = useSongs();
  const { data: arrangements } = useArrangements(songId || null);
  const { data: existingSession } = usePracticeSessionById(sessionId ?? null);

  // Mutations
  const createSession = useCreatePracticeSession();
  const updateSession = useUpdatePracticeSession();

  const isPending = createSession.isPending || updateSession.isPending;

  // Populate form for edit mode
  useEffect(() => {
    if (isEdit && existingSession) {
      setUserId(existingSession.user_id);
      setSongId(existingSession.song_id);
      setArrangementId(existingSession.arrangement_id ?? NO_ARRANGEMENT);
      setStartedAt(existingSession.started_at.slice(0, 16)); // datetime-local format
      setDurationMinutes(
        existingSession.duration_seconds != null
          ? String(Math.round(existingSession.duration_seconds / 60))
          : ''
      );
      setTempoFactor(String(existingSession.tempo_factor));
    }
  }, [isEdit, existingSession]);

  // Reset form when dialog opens for create
  useEffect(() => {
    if (open && !isEdit) {
      setUserId('');
      setSongId('');
      setArrangementId(NO_ARRANGEMENT);
      setStartedAt('');
      setDurationMinutes('');
      setTempoFactor('1.0');
    }
  }, [open, isEdit]);

  // Reset arrangement when song changes
  useEffect(() => {
    if (!isEdit) {
      setArrangementId(NO_ARRANGEMENT);
    }
  }, [songId, isEdit]);

  const canSubmit = userId.trim() !== '' && songId !== '' && startedAt !== '';

  const handleSubmit = () => {
    if (!canSubmit) return;

    const durationSec = durationMinutes ? Math.round(parseFloat(durationMinutes) * 60) : null;
    const arrId = arrangementId === NO_ARRANGEMENT ? null : arrangementId;
    const tempo = parseFloat(tempoFactor) || 1.0;

    if (isEdit && sessionId) {
      updateSession.mutate(
        {
          id: sessionId,
          updates: {
            user_id: userId.trim(),
            song_id: songId,
            arrangement_id: arrId,
            started_at: new Date(startedAt).toISOString(),
            duration_seconds: durationSec,
            tempo_factor: tempo,
          },
        },
        { onSettled: () => onOpenChange(false) }
      );
    } else {
      const session: MusicPracticeSessionInsert = {
        user_id: userId.trim(),
        song_id: songId,
        arrangement_id: arrId,
        started_at: new Date(startedAt).toISOString(),
        duration_seconds: durationSec,
        tempo_factor: tempo,
      };

      createSession.mutate(session, {
        onSettled: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            {isEdit ? 'Editar sesión de práctica' : 'Registrar sesión de práctica'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos de la sesión de práctica.'
              : 'Registra manualmente una sesión de práctica para un músico.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User ID */}
          <div className="space-y-2">
            <Label htmlFor="practice-user-id">ID del usuario *</Label>
            <Input
              id="practice-user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID del usuario"
            />
          </div>

          {/* Song */}
          <div className="space-y-2">
            <Label>Canción *</Label>
            <Select value={songId} onValueChange={setSongId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar canción..." />
              </SelectTrigger>
              <SelectContent>
                {songs?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}{s.artist ? ` — ${s.artist}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrangement */}
          <div className="space-y-2">
            <Label>Arreglo (opcional)</Label>
            <Select
              value={arrangementId}
              onValueChange={setArrangementId}
              disabled={!songId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin arreglo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ARRANGEMENT}>(Sin arreglo)</SelectItem>
                {arrangements?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{a.arrangement_key ? ` (${a.arrangement_key})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Started at */}
          <div className="space-y-2">
            <Label htmlFor="practice-started">Fecha y hora de inicio *</Label>
            <Input
              id="practice-started"
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="practice-duration">Duración (minutos)</Label>
            <Input
              id="practice-duration"
              type="number"
              min="0"
              step="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="Ej: 30"
            />
          </div>

          {/* Tempo factor */}
          <div className="space-y-2">
            <Label htmlFor="practice-tempo">Factor de tempo</Label>
            <Input
              id="practice-tempo"
              type="number"
              min="0.25"
              max="2.0"
              step="0.05"
              value={tempoFactor}
              onChange={(e) => setTempoFactor(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              1.0 = velocidad normal, 0.5 = mitad, 2.0 = doble
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending
              ? isEdit ? 'Guardando...' : 'Registrando...'
              : isEdit ? 'Guardar' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PracticeLogDialog;
