/**
 * useStemPlayer — Core audio engine hook for multi-track stem playback.
 *
 * Manages synchronized playback of up to 9 stem tracks using WaveSurfer instances.
 * Uses MediaElement backend (NOT WebAudio) to avoid AudioContext limitations.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { supabase } from '@/integrations/supabase/client';
import type { MusicStemRow, MusicPracticeSessionInsert, StemType } from '@/types/musicPlanning';

export interface StemTrack {
  stemType: StemType;
  stemId: string;
  fileName: string;
  storagePath: string;
  duration: number;
  volume: number; // 0-100
  isMuted: boolean;
  isSoloed: boolean;
  isLoaded: boolean;
  isError: boolean;
  signedUrl: string | null;
}

export interface UseStemPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number; // Duration of longest track
  tracks: StemTrack[];
  loopStart: number | null;
  loopEnd: number | null;
  tempoFactor: number;
  isLoading: boolean;
  error: string | null;
  sessionStartedAt: Date | null;
}

export interface UseStemPlayerActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (stemType: StemType, volume: number) => void;
  toggleMute: (stemType: StemType) => void;
  toggleSolo: (stemType: StemType) => void;
  setLoop: (start: number, end: number) => void;
  clearLoop: () => void;
  setTempo: (factor: number) => void;
  loadStems: (stems: MusicStemRow[]) => Promise<void>;
  destroy: () => void;
  saveSession: (userId: string, songId: string, arrangementId: string) => Promise<MusicPracticeSessionInsert>;
  registerContainer: (stemType: StemType, container: HTMLDivElement | null) => void;
}

const MIN_TEMPO = 0.5;
const MAX_TEMPO = 2.0;

export function useStemPlayer(): [UseStemPlayerState, UseStemPlayerActions] {
  const [state, setState] = useState<UseStemPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tracks: [],
    loopStart: null,
    loopEnd: null,
    tempoFactor: 1.0,
    isLoading: false,
    error: null,
    sessionStartedAt: null,
  });

  // Map of stem type to WaveSurfer instance
  const instancesRef = useRef<Map<StemType, WaveSurfer>>(new Map());
  // Map of stem type to container div
  const containersRef = useRef<Map<StemType, HTMLDivElement>>(new Map());
  // RAF handle for currentTime sync
  const rafHandleRef = useRef<number | null>(null);
  // Region plugin (only on first loaded instance)
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const loopRegionIdRef = useRef<string | null>(null);

  // Sync currentTime via RAF
  const updateCurrentTime = useCallback(() => {
    const instances = instancesRef.current;
    if (instances.size === 0) return;

    // Read time from the first loaded instance
    const firstInstance = Array.from(instances.values())[0];
    if (!firstInstance) return;

    const currentTime = firstInstance.getCurrentTime();
    setState(prev => {
      // Check loop boundary
      if (prev.loopEnd !== null && currentTime >= prev.loopEnd) {
        // Seek all tracks back to loopStart
        const loopStart = prev.loopStart || 0;
        instances.forEach(ws => {
          const duration = ws.getDuration();
          if (duration > 0) {
            ws.seekTo(loopStart / duration);
          }
        });
        return { ...prev, currentTime: loopStart };
      }
      return { ...prev, currentTime };
    });

    rafHandleRef.current = requestAnimationFrame(updateCurrentTime);
  }, []);

  // Generate signed URLs for stems
  const loadStems = useCallback(async (stems: MusicStemRow[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tracks: StemTrack[] = [];

      for (const stem of stems) {
        // Generate signed URL
        const { data, error } = await supabase.storage
          .from('music-stems')
          .createSignedUrl(stem.storage_path, 3600); // 1 hour

        if (error || !data) {
          tracks.push({
            stemType: stem.stem_type,
            stemId: stem.id,
            fileName: stem.file_name || 'Unknown',
            storagePath: stem.storage_path,
            duration: stem.duration_seconds || 0,
            volume: 100,
            isMuted: false,
            isSoloed: false,
            isLoaded: false,
            isError: true,
            signedUrl: null,
          });
          continue;
        }

        tracks.push({
          stemType: stem.stem_type,
          stemId: stem.id,
          fileName: stem.file_name || 'Unknown',
          storagePath: stem.storage_path,
          duration: stem.duration_seconds || 0,
          volume: 100,
          isMuted: false,
          isSoloed: false,
          isLoaded: false,
          isError: false,
          signedUrl: data.signedUrl,
        });
      }

      // Calculate max duration
      const maxDuration = Math.max(...tracks.map(t => t.duration), 0);

      setState(prev => ({
        ...prev,
        tracks,
        duration: maxDuration,
        isLoading: false,
        sessionStartedAt: new Date(),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error al cargar stems',
      }));
    }
  }, []);

  // Initialize WaveSurfer instance for a track
  const initWaveSurfer = useCallback((stemType: StemType, container: HTMLDivElement, url: string) => {
    const ws = WaveSurfer.create({
      container,
      waveColor: '#D4A853',
      progressColor: '#1A1A1A',
      cursorWidth: 0,
      height: 48,
      normalize: true,
      interact: false,
      // CRITICAL: Use MediaElement backend (NOT WebAudio) to avoid AudioContext limit
      backend: 'MediaElement',
    });

    // If this is the first instance, attach RegionsPlugin for loop visualization
    if (instancesRef.current.size === 0) {
      const regions = ws.registerPlugin(RegionsPlugin.create());
      regionsPluginRef.current = regions;
    }

    ws.on('ready', () => {
      setState(prev => ({
        ...prev,
        tracks: prev.tracks.map(t =>
          t.stemType === stemType ? { ...t, isLoaded: true } : t
        ),
      }));
    });

    ws.on('error', () => {
      setState(prev => ({
        ...prev,
        tracks: prev.tracks.map(t =>
          t.stemType === stemType ? { ...t, isError: true } : t
        ),
      }));
    });

    ws.load(url);
    instancesRef.current.set(stemType, ws);
  }, []);

  // Register container div for a stem type
  const registerContainer = useCallback((stemType: StemType, container: HTMLDivElement | null) => {
    if (!container) return;
    containersRef.current.set(stemType, container);

    // Find the track
    setState(prev => {
      const track = prev.tracks.find(t => t.stemType === stemType);
      if (!track || !track.signedUrl || track.isError) return prev;

      // Initialize WaveSurfer
      initWaveSurfer(stemType, container, track.signedUrl);
      return prev;
    });
  }, [initWaveSurfer]);

  // Play all tracks
  const play = useCallback(() => {
    const instances = instancesRef.current;
    instances.forEach(ws => ws.play());
    setState(prev => ({ ...prev, isPlaying: true }));

    // Start RAF loop
    if (rafHandleRef.current === null) {
      rafHandleRef.current = requestAnimationFrame(updateCurrentTime);
    }
  }, [updateCurrentTime]);

  // Pause all tracks
  const pause = useCallback(() => {
    const instances = instancesRef.current;
    instances.forEach(ws => ws.pause());
    setState(prev => ({ ...prev, isPlaying: false }));

    // Stop RAF loop
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
  }, []);

  // Stop and reset to beginning
  const stop = useCallback(() => {
    const instances = instancesRef.current;
    instances.forEach(ws => {
      ws.pause();
      ws.seekTo(0);
    });
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));

    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
  }, []);

  // Seek all tracks to a specific time
  const seekTo = useCallback((seconds: number) => {
    setState(prev => {
      const clampedSeconds = Math.max(0, Math.min(seconds, prev.duration));
      const instances = instancesRef.current;
      instances.forEach(ws => {
        const duration = ws.getDuration();
        if (duration > 0) {
          ws.seekTo(clampedSeconds / duration);
        }
      });
      return { ...prev, currentTime: clampedSeconds };
    });
  }, []);

  // Set volume for a specific track
  const setVolume = useCallback((stemType: StemType, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    setState(prev => {
      const track = prev.tracks.find(t => t.stemType === stemType);
      if (!track) return prev;

      // Apply volume considering solo/mute state
      const ws = instancesRef.current.get(stemType);
      if (ws) {
        const soloedTypes = prev.tracks.filter(t => t.isSoloed).map(t => t.stemType);
        const hasSolo = soloedTypes.length > 0;

        if (hasSolo) {
          ws.setVolume(track.isSoloed ? clampedVolume / 100 : 0);
        } else {
          ws.setVolume(track.isMuted ? 0 : clampedVolume / 100);
        }
      }

      return {
        ...prev,
        tracks: prev.tracks.map(t =>
          t.stemType === stemType ? { ...t, volume: clampedVolume } : t
        ),
      };
    });
  }, []);

  // Toggle mute for a specific track
  const toggleMute = useCallback((stemType: StemType) => {
    setState(prev => {
      const track = prev.tracks.find(t => t.stemType === stemType);
      if (!track) return prev;

      const newMuted = !track.isMuted;
      const ws = instancesRef.current.get(stemType);
      if (ws) {
        const soloedTypes = prev.tracks.filter(t => t.isSoloed).map(t => t.stemType);
        const hasSolo = soloedTypes.length > 0;

        if (!hasSolo) {
          ws.setVolume(newMuted ? 0 : track.volume / 100);
        }
      }

      return {
        ...prev,
        tracks: prev.tracks.map(t =>
          t.stemType === stemType ? { ...t, isMuted: newMuted } : t
        ),
      };
    });
  }, []);

  // Toggle solo for a specific track
  const toggleSolo = useCallback((stemType: StemType) => {
    setState(prev => {
      const track = prev.tracks.find(t => t.stemType === stemType);
      if (!track) return prev;

      const newSoloed = !track.isSoloed;

      // Update solo state
      const newTracks = prev.tracks.map(t =>
        t.stemType === stemType ? { ...t, isSoloed: newSoloed } : t
      );

      // Apply solo logic to all tracks
      const soloedTypes = newTracks.filter(t => t.isSoloed).map(t => t.stemType);
      const hasSolo = soloedTypes.length > 0;

      newTracks.forEach(t => {
        const ws = instancesRef.current.get(t.stemType);
        if (!ws) return;

        if (hasSolo) {
          ws.setVolume(t.isSoloed ? t.volume / 100 : 0);
        } else {
          ws.setVolume(t.isMuted ? 0 : t.volume / 100);
        }
      });

      return { ...prev, tracks: newTracks };
    });
  }, []);

  // Set loop region
  const setLoop = useCallback((start: number, end: number) => {
    setState(prev => {
      const clampedStart = Math.max(0, Math.min(start, prev.duration));
      const clampedEnd = Math.max(clampedStart, Math.min(end, prev.duration));

      // Create visual region on first instance
      const regions = regionsPluginRef.current;
      if (regions) {
        // Clear existing loop region
        if (loopRegionIdRef.current) {
          regions.getRegions().forEach(r => {
            if (r.id === loopRegionIdRef.current) {
              r.remove();
            }
          });
        }

        // Add new region
        const region = regions.addRegion({
          start: clampedStart,
          end: clampedEnd,
          color: 'rgba(212, 168, 83, 0.2)',
          drag: false,
          resize: false,
        });
        loopRegionIdRef.current = region.id;
      }

      return { ...prev, loopStart: clampedStart, loopEnd: clampedEnd };
    });
  }, []);

  // Clear loop region
  const clearLoop = useCallback(() => {
    setState(prev => {
      const regions = regionsPluginRef.current;
      if (regions && loopRegionIdRef.current) {
        regions.getRegions().forEach(r => {
          if (r.id === loopRegionIdRef.current) {
            r.remove();
          }
        });
        loopRegionIdRef.current = null;
      }

      return { ...prev, loopStart: null, loopEnd: null };
    });
  }, []);

  // Set playback tempo
  const setTempo = useCallback((factor: number) => {
    const clampedFactor = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, factor));
    const instances = instancesRef.current;
    instances.forEach(ws => {
      ws.setPlaybackRate(clampedFactor);
    });
    setState(prev => ({ ...prev, tempoFactor: clampedFactor }));
  }, []);

  // Save practice session
  const saveSession = useCallback(async (userId: string, songId: string, arrangementId: string): Promise<MusicPracticeSessionInsert> => {
    const now = new Date();
    const startedAt = state.sessionStartedAt || now;
    const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

    // Build stem_volumes object
    const stemVolumes: Record<string, number> = {};
    state.tracks.forEach(track => {
      stemVolumes[track.stemType] = track.volume / 100;
    });

    const session: MusicPracticeSessionInsert = {
      user_id: userId,
      song_id: songId,
      arrangement_id: arrangementId,
      stem_volumes: stemVolumes,
      loop_start: state.loopStart,
      loop_end: state.loopEnd,
      tempo_factor: state.tempoFactor,
      duration_seconds: durationSeconds,
      started_at: startedAt.toISOString(),
      ended_at: now.toISOString(),
    };

    return session;
  }, [state]);

  // Destroy all instances
  const destroy = useCallback(() => {
    pause();

    const instances = instancesRef.current;
    instances.forEach(ws => ws.destroy());
    instances.clear();

    containersRef.current.clear();
    regionsPluginRef.current = null;
    loopRegionIdRef.current = null;

    setState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      tracks: [],
      loopStart: null,
      loopEnd: null,
      tempoFactor: 1.0,
      isLoading: false,
      error: null,
      sessionStartedAt: null,
    });
  }, [pause]);

  // Cleanup on unmount
  useEffect(() => {
    const instances = instancesRef.current;
    const rafRef = rafHandleRef;
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      instances.forEach(ws => ws.destroy());
      instances.clear();
    };
  }, []);

  const actions: UseStemPlayerActions = {
    play,
    pause,
    stop,
    seekTo,
    setVolume,
    toggleMute,
    toggleSolo,
    setLoop,
    clearLoop,
    setTempo,
    loadStems,
    destroy,
    saveSession,
    registerContainer,
  };

  return [state, actions];
}
