/**
 * Music selector component for adding intro/outro to sermon exports
 * Part of PROMPT_004: Intro/Outro Music Integration
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MusicTrackManager, MusicTrack } from './admin/MusicTrackManager';

export interface MusicSettings {
  includeIntro: boolean;
  includeOutro: boolean;
  introTrack: MusicTrack | null;
  outroTrack: MusicTrack | null;
}

interface MusicSelectorProps {
  settings: MusicSettings;
  onSettingsChange: (settings: MusicSettings) => void;
  disabled?: boolean;
}

export function MusicSelector({
  settings,
  onSettingsChange,
  disabled = false,
}: MusicSelectorProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [playingTrackType, setPlayingTrackType] = useState<'intro' | 'outro' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setIsAdmin(!!data);
    };

    checkAdmin();
  }, [user]);

  // Load default tracks on mount - only runs once
  useEffect(() => {
    const loadTracks = async () => {
      try {
        const { data, error } = await supabase
          .from('sermon_music_tracks')
          .select('*')
          .eq('is_default', true);

        if (error) throw error;

        const introTrack = (data as MusicTrack[])?.find(t => t.type === 'intro') || null;
        const outroTrack = (data as MusicTrack[])?.find(t => t.type === 'outro') || null;

        // Only update if we found tracks
        if (introTrack || outroTrack) {
          onSettingsChange({
            includeIntro: settings.includeIntro,
            includeOutro: settings.includeOutro,
            introTrack,
            outroTrack,
          });
        }
      } catch (err) {
        console.error('Error loading default tracks:', err);
      }
    };

    loadTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleIntro = (checked: boolean) => {
    onSettingsChange({
      ...settings,
      includeIntro: checked,
    });
  };

  const handleToggleOutro = (checked: boolean) => {
    onSettingsChange({
      ...settings,
      includeOutro: checked,
    });
  };

  const handlePlayPreview = (type: 'intro' | 'outro') => {
    const track = type === 'intro' ? settings.introTrack : settings.outroTrack;
    if (!track) return;

    // If already playing this type, stop it
    if (playingTrackType === type && audioRef.current) {
      audioRef.current.pause();
      setPlayingTrackType(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Play the track
    const audio = new Audio(track.audio_url);
    audio.onended = () => setPlayingTrackType(null);
    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
      setPlayingTrackType(null);
    });
    audioRef.current = audio;
    setPlayingTrackType(type);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0.0s';
    return `${seconds.toFixed(1)}s`;
  };

  // Function to reload tracks (used after admin dialog closes)
  const reloadDefaultTracks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sermon_music_tracks')
        .select('*')
        .eq('is_default', true);

      if (error) throw error;

      const introTrack = (data as MusicTrack[])?.find(t => t.type === 'intro') || null;
      const outroTrack = (data as MusicTrack[])?.find(t => t.type === 'outro') || null;

      onSettingsChange({
        includeIntro: settings.includeIntro,
        includeOutro: settings.includeOutro,
        introTrack,
        outroTrack,
      });
    } catch (err) {
      console.error('Error loading default tracks:', err);
    }
  }, [onSettingsChange, settings.includeIntro, settings.includeOutro]);

  const handleAdminDialogClose = () => {
    setShowAdminDialog(false);
    // Reload default tracks after admin makes changes
    reloadDefaultTracks();
  };

  return (
    <div className="space-y-3">
      {/* Intro checkbox */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox
            id="include-intro"
            checked={settings.includeIntro}
            onCheckedChange={handleToggleIntro}
            disabled={disabled || !settings.introTrack}
          />
          <Label
            htmlFor="include-intro"
            className={`text-sm ${!settings.introTrack ? 'text-muted-foreground' : ''}`}
          >
            Agregar música de introducción
          </Label>
        </div>

        <div className="flex items-center gap-2">
          {settings.introTrack ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handlePlayPreview('intro')}
                disabled={disabled}
              >
                {playingTrackType === 'intro' ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {settings.introTrack.name} ({formatDuration(settings.introTrack.duration_seconds)})
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Sin pista configurada
            </span>
          )}
        </div>
      </div>

      {/* Outro checkbox */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox
            id="include-outro"
            checked={settings.includeOutro}
            onCheckedChange={handleToggleOutro}
            disabled={disabled || !settings.outroTrack}
          />
          <Label
            htmlFor="include-outro"
            className={`text-sm ${!settings.outroTrack ? 'text-muted-foreground' : ''}`}
          >
            Agregar música de cierre
          </Label>
        </div>

        <div className="flex items-center gap-2">
          {settings.outroTrack ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handlePlayPreview('outro')}
                disabled={disabled}
              >
                {playingTrackType === 'outro' ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {settings.outroTrack.name} ({formatDuration(settings.outroTrack.duration_seconds)})
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Sin pista configurada
            </span>
          )}
        </div>
      </div>

      {/* Admin link */}
      {isAdmin && (
        <Dialog open={showAdminDialog} onOpenChange={(open) => {
          if (!open) {
            // Dialog is closing - reload default tracks
            reloadDefaultTracks();
          }
          setShowAdminDialog(open);
        }}>
          <DialogTrigger asChild>
            <Button variant="link" size="sm" className="px-0 h-auto text-xs">
              <Settings className="h-3 w-3 mr-1" />
              Administrar pistas de música...
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Administrar Pistas de Música</DialogTitle>
            </DialogHeader>
            <MusicTrackManager />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default MusicSelector;
