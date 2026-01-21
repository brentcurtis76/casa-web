/**
 * State management hook for the Sermon Audio Editor
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { toast } from 'sonner';
import {
  decodeAudioFile,
  getAudioFileInfo,
  trimAudioBuffer,
  trimAudioBufferWithSilenceRemovals,
  audioBufferToWav,
  AudioFileInfo,
  fetchAudioBuffer,
  concatenateWithCrossfade,
  concatenateSegments,
  SegmentForConcatenation,
} from '@/lib/sermon-editor/audioProcessor';
import {
  encodeToMp3,
  downloadBlob,
  generateExportFilename,
} from '@/lib/sermon-editor/mp3Encoder';
import {
  saveDraft as saveDraftToStorage,
  loadDraft as loadDraftFromStorage,
  deleteDraft as deleteDraftFromStorage,
  hasDraft,
  getDraftInfo,
  formatSavedTime,
} from '@/lib/sermon-editor/draftStorage';
import {
  embedMetadata,
  createMP3Metadata,
  blobToArrayBuffer,
} from '@/lib/sermon-editor/metadataEmbedder';
import type { SermonMetadata } from '@/components/sermon-editor/MetadataForm';
import {
  SilenceRegion,
  SilenceDetectionOptions,
  DEFAULT_SILENCE_OPTIONS,
  detectSilences,
  calculateRemovedDuration,
} from '@/lib/sermon-editor/silenceDetector';
import {
  EnhancementSettings,
  DEFAULT_ENHANCEMENT_SETTINGS,
  applyEnhancements,
  dbToLinear,
} from '@/lib/sermon-editor/audioEnhancer';

// Brand-consistent toast styles
const toastStyles = {
  success: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #D97706',
    },
  },
  error: {
    style: {
      background: '#292524',
      color: '#fef3c7',
      border: '1px solid #dc2626',
    },
  },
};

// Undo history entry
interface EditHistoryEntry {
  type: 'trim' | 'silence_toggle' | 'silence_detect';
  timestamp: number;
  data: {
    silences?: SilenceRegion[];
    trimStart?: number;
    trimEnd?: number;
  };
}

// Music track type (PROMPT_004)
export interface MusicTrack {
  id: string;
  name: string;
  type: 'intro' | 'outro';
  audio_url: string;
  duration_seconds: number | null;
  is_default: boolean;
}

// Music settings type (PROMPT_004)
export interface MusicSettings {
  includeIntro: boolean;
  includeOutro: boolean;
  introTrack: MusicTrack | null;
  outroTrack: MusicTrack | null;
}

// Audio segment type for multi-segment editing (PROMPT_009)
export interface AudioSegment {
  id: string;
  file: File;
  audioBuffer: AudioBuffer;
  fileInfo: AudioFileInfo;
  trimStart: number;
  trimEnd: number;
  duration: number;
  silences: SilenceRegion[];
  enhancementSettings: EnhancementSettings;
  order: number;
  joinMode: 'crossfade' | 'cut';  // How this segment joins to the NEXT one
}

export interface SermonEditorState {
  // File state (legacy - for backward compatibility with single segment)
  file: File | null;
  audioBuffer: AudioBuffer | null;
  fileInfo: AudioFileInfo | null;
  isLoading: boolean;
  error: string | null;

  // Multi-segment state (PROMPT_009)
  segments: AudioSegment[];
  activeSegmentId: string | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isWaveformReady: boolean; // True when WaveSurfer has rendered

  // Preview with music state
  isPreviewingWithMusic: boolean;
  previewCurrentTime: number; // Time in the combined preview (with intro/outro)

  // Trim state
  trimStart: number;
  trimEnd: number;

  // Silence detection state
  silences: SilenceRegion[];
  silenceOptions: SilenceDetectionOptions;
  isDetectingSilence: boolean;

  // Music state (PROMPT_004)
  musicSettings: MusicSettings;

  // Metadata state (PROMPT_005)
  metadata: SermonMetadata;
  coverImage: Blob | null;

  // Undo state
  editHistory: EditHistoryEntry[];
  canUndo: boolean;

  // Export state
  isExporting: boolean;
  exportProgress: number;

  // Distribution (PROMPT_006)
  exportedAudio: Blob | null;  // Store the exported MP3

  // Audio enhancement state (PROMPT_008)
  enhancementSettings: EnhancementSettings;

  // Draft state
  isSavingDraft: boolean;
  lastSavedAt: string | null;

  // Composite preview state (PROMPT_009)
  isGeneratingCompositePreview: boolean;
  compositePreviewBuffer: AudioBuffer | null;
  isPlayingCompositePreview: boolean;
  compositePreviewCurrentTime: number;
  compositePreviewDuration: number;

  // WaveSurfer reference
  wavesurfer: WaveSurfer | null;
  regionsPlugin: RegionsPlugin | null;
}

export interface SermonEditorActions {
  // File actions
  loadFile: (file: File) => Promise<void>;
  clearFile: () => void;

  // Segment actions (PROMPT_009)
  addSegment: (file: File) => Promise<void>;
  removeSegment: (segmentId: string) => void;
  selectSegment: (segmentId: string) => void;
  reorderSegments: (segmentIds: string[]) => void;
  setSegmentJoinMode: (segmentId: string, mode: 'crossfade' | 'cut') => void;
  moveSegmentUp: (segmentId: string) => void;
  moveSegmentDown: (segmentId: string) => void;

  // Playback actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  playPreviewWithMusic: () => Promise<void>; // Play with intro/outro
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;

  // Trim actions
  setTrimStart: (time: number) => void;
  setTrimEnd: (time: number) => void;
  resetTrim: () => void;
  applyTrim: () => Promise<void>; // Commit trim permanently

  // Silence actions
  detectSilences: () => Promise<void>;
  setSilenceOptions: (options: SilenceDetectionOptions) => void;
  toggleSilenceRemoval: (silenceId: string) => void;
  previewSilence: (silence: SilenceRegion) => void;

  // Music actions (PROMPT_004)
  setMusicSettings: (settings: MusicSettings) => void;

  // Metadata actions (PROMPT_005)
  setMetadata: (metadata: SermonMetadata) => void;
  setCoverImage: (cover: Blob | null) => void;

  // Audio enhancement actions (PROMPT_008)
  setEnhancementSettings: (settings: EnhancementSettings) => void;

  // Undo action
  undo: () => void;

  // Export actions
  exportMp3: (title?: string) => Promise<void>;

  // Composite preview actions (PROMPT_009)
  generateCompositePreview: () => Promise<void>;
  playCompositePreview: () => void;
  pauseCompositePreview: () => void;
  stopCompositePreview: () => void;
  seekCompositePreview: (time: number) => void;

  // Draft actions
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<boolean>;
  clearDraft: () => Promise<void>;
  checkForDraft: () => { exists: boolean; info: { savedAt: string; title: string; speaker: string } | null };

  // WaveSurfer setup
  initWaveSurfer: (container: HTMLElement) => void;
  destroyWaveSurfer: () => void;
}

const MAX_HISTORY_SIZE = 20;

const initialState: SermonEditorState = {
  file: null,
  audioBuffer: null,
  fileInfo: null,
  isLoading: false,
  error: null,
  // Multi-segment state (PROMPT_009)
  segments: [],
  activeSegmentId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  isWaveformReady: false,
  isPreviewingWithMusic: false,
  previewCurrentTime: 0,
  trimStart: 0,
  trimEnd: 0,
  silences: [],
  silenceOptions: DEFAULT_SILENCE_OPTIONS,
  isDetectingSilence: false,
  // Music settings (PROMPT_004)
  musicSettings: {
    includeIntro: false,
    includeOutro: false,
    introTrack: null,
    outroTrack: null,
  },
  // Metadata settings (PROMPT_005)
  metadata: {
    title: '',
    speaker: '',
    date: new Date(),
    series: undefined,
    description: undefined,
    liturgyId: undefined,
  },
  coverImage: null,
  editHistory: [],
  canUndo: false,
  isExporting: false,
  exportProgress: 0,
  // Distribution (PROMPT_006)
  exportedAudio: null,
  // Audio enhancement (PROMPT_008)
  enhancementSettings: DEFAULT_ENHANCEMENT_SETTINGS,
  // Draft state
  isSavingDraft: false,
  lastSavedAt: null,
  // Composite preview state (PROMPT_009)
  isGeneratingCompositePreview: false,
  compositePreviewBuffer: null,
  isPlayingCompositePreview: false,
  compositePreviewCurrentTime: 0,
  compositePreviewDuration: 0,
  wavesurfer: null,
  regionsPlugin: null,
};

export function useSermonEditor(): [SermonEditorState, SermonEditorActions] {
  const [state, setState] = useState<SermonEditorState>(initialState);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  // Ref to track preview listener for cleanup (prevents memory leak)
  const previewListenerRef = useRef<(() => void) | null>(null);
  // Refs for music preview playback
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const outroAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Refs for real-time enhancement preview (PROMPT_008)
  const enhancementNodesRef = useRef<{
    inputGain: GainNode;
    bassFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    trebleFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Refs for composite preview playback (PROMPT_009)
  const compositePreviewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const compositePreviewContextRef = useRef<AudioContext | null>(null);
  const compositePreviewStartTimeRef = useRef<number>(0);
  const compositePreviewIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to create enhancement filter nodes (PROMPT_008)
  const createEnhancementNodes = useCallback((audioContext: AudioContext) => {
    const inputGain = audioContext.createGain();
    const bassFilter = audioContext.createBiquadFilter();
    const midFilter = audioContext.createBiquadFilter();
    const trebleFilter = audioContext.createBiquadFilter();
    const compressor = audioContext.createDynamicsCompressor();

    // Configure EQ filters
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 250;

    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;

    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 4000;

    // Connect the chain: input -> bass -> mid -> treble -> compressor
    inputGain.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(compressor);

    enhancementNodesRef.current = {
      inputGain,
      bassFilter,
      midFilter,
      trebleFilter,
      compressor,
    };

    return { inputGain, bassFilter, midFilter, trebleFilter, compressor };
  }, []);

  // Helper to update enhancement node parameters (PROMPT_008)
  const updateEnhancementNodes = useCallback((settings: EnhancementSettings) => {
    const nodes = enhancementNodesRef.current;
    if (!nodes) return;

    // Update gain
    nodes.inputGain.gain.value = dbToLinear(settings.gain);

    // Update EQ
    nodes.bassFilter.gain.value = settings.eq.bass;
    nodes.midFilter.gain.value = settings.eq.mid;
    nodes.trebleFilter.gain.value = settings.eq.treble;

    // Update compression
    if (settings.compressionEnabled) {
      nodes.compressor.threshold.value = settings.compression.threshold;
      nodes.compressor.ratio.value = settings.compression.ratio;
      nodes.compressor.attack.value = settings.compression.attack;
      nodes.compressor.release.value = settings.compression.release;
      nodes.compressor.knee.value = settings.compression.knee;
    } else {
      // Bypass compression by setting neutral values
      nodes.compressor.threshold.value = 0;
      nodes.compressor.ratio.value = 1;
    }
  }, []);

  // Helper to apply or remove enhancement filters from WaveSurfer (PROMPT_008)
  // WaveSurfer.js v7 uses WebAudioPlayer with getGainNode() method
  const applyEnhancementFilters = useCallback((enabled: boolean) => {
    const ws = wavesurferRef.current;
    const nodes = enhancementNodesRef.current;
    const audioContext = audioContextRef.current;

    if (!ws || !nodes || !audioContext) {
      console.log('[applyEnhancementFilters] Missing ws, nodes, or audioContext');
      return;
    }

    try {
      // Get the media element - in WebAudio mode, this is a WebAudioPlayer
      const mediaElement = ws.getMediaElement() as any;

      // Check if it has getGainNode (WebAudioPlayer)
      if (typeof mediaElement?.getGainNode !== 'function') {
        console.error('[applyEnhancementFilters] getGainNode not available - not using WebAudio backend?');
        return;
      }

      const sourceGainNode = mediaElement.getGainNode() as GainNode;
      console.log('[applyEnhancementFilters] Got source GainNode:', sourceGainNode);

      if (enabled) {
        // Disconnect source gain from destination
        sourceGainNode.disconnect();

        // Connect: sourceGain -> inputGain -> bass -> mid -> treble -> compressor -> destination
        sourceGainNode.connect(nodes.inputGain);
        nodes.compressor.connect(audioContext.destination);

        console.log('[applyEnhancementFilters] Filters applied - chain connected');
      } else {
        // Disconnect filter chain
        sourceGainNode.disconnect();
        nodes.compressor.disconnect();

        // Connect source directly to destination
        sourceGainNode.connect(audioContext.destination);

        console.log('[applyEnhancementFilters] Filters removed - direct connection');
      }
    } catch (err) {
      console.error('[applyEnhancementFilters] Error:', err);
    }
  }, []);

  // Helper to add entry to undo history
  const pushHistory = useCallback((entry: Omit<EditHistoryEntry, 'timestamp'>) => {
    setState(prev => {
      const newHistory = [
        ...prev.editHistory.slice(-(MAX_HISTORY_SIZE - 1)),
        { ...entry, timestamp: Date.now() },
      ];
      return {
        ...prev,
        editHistory: newHistory,
        canUndo: true,
      };
    });
  }, []);

  // Initialize WaveSurfer
  const initWaveSurfer = useCallback((container: HTMLElement) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container,
      waveColor: '#FBBF24',      // Brand amber-400
      progressColor: '#D97706',   // Brand amber-600
      cursorColor: '#111111',     // Brand casa-900
      cursorWidth: 2,
      height: 128,
      normalize: true,
      backend: 'WebAudio',       // Required for real-time enhancement filters
      interact: true,
    });

    // Initialize regions plugin for silence visualization
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsPluginRef.current = regions;

    // Handle region clicks for silence preview
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      // Play just that region
      region.play();
    });

    // Set up event listeners
    ws.on('play', () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    });

    ws.on('pause', () => {
      setState(prev => ({ ...prev, isPlaying: false }));
      // Clean up preview listener when paused (user manually pauses during preview)
      if (previewListenerRef.current) {
        ws.un('timeupdate', previewListenerRef.current);
        previewListenerRef.current = null;
      }
    });

    ws.on('timeupdate', (currentTime: number) => {
      setState(prev => {
        // Respect trim boundaries during playback
        if (currentTime >= prev.trimEnd && prev.trimEnd > 0) {
          ws.pause();
          ws.seekTo(prev.trimStart / prev.duration);
          return { ...prev, currentTime: prev.trimStart, isPlaying: false };
        }
        return { ...prev, currentTime };
      });
    });

    ws.on('ready', () => {
      const duration = ws.getDuration();
      setState(prev => ({
        ...prev,
        duration,
        trimEnd: prev.trimEnd === 0 ? duration : prev.trimEnd,
        isWaveformReady: true,
      }));

      // Create enhancement nodes for real-time preview (PROMPT_008)
      // Get the AudioContext from WaveSurfer's WebAudioPlayer
      try {
        const mediaElement = ws.getMediaElement() as any;
        if (mediaElement?.getGainNode) {
          const gainNode = mediaElement.getGainNode() as GainNode;
          const context = gainNode.context as AudioContext;
          audioContextRef.current = context;
          console.log('[WaveSurfer ready] Got AudioContext from WebAudioPlayer:', context);

          createEnhancementNodes(context);

          // Apply initial enhancement settings if enabled
          setState(prev => {
            if (prev.enhancementSettings.enabled) {
              updateEnhancementNodes(prev.enhancementSettings);
              // Defer applying filters to next tick to ensure WaveSurfer is fully ready
              setTimeout(() => applyEnhancementFilters(true), 0);
            }
            return prev;
          });
        } else {
          console.warn('[WaveSurfer ready] WebAudioPlayer not available, enhancements disabled');
        }
      } catch (err) {
        console.error('[WaveSurfer ready] Error setting up enhancements:', err);
      }
    });

    wavesurferRef.current = ws;
    setState(prev => ({ ...prev, wavesurfer: ws, regionsPlugin: regions }));

    // If there's a pending file, load it now
    if (pendingFileRef.current) {
      ws.loadBlob(pendingFileRef.current);
      pendingFileRef.current = null;
    }
  }, []);

  // Destroy WaveSurfer
  const destroyWaveSurfer = useCallback(() => {
    // Clean up enhancement nodes (PROMPT_008)
    if (enhancementNodesRef.current) {
      const nodes = enhancementNodesRef.current;
      try {
        nodes.inputGain.disconnect();
        nodes.bassFilter.disconnect();
        nodes.midFilter.disconnect();
        nodes.trebleFilter.disconnect();
        nodes.compressor.disconnect();
      } catch (err) {
        // Nodes may already be disconnected
      }
      enhancementNodesRef.current = null;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      regionsPluginRef.current = null;
      setState(prev => ({ ...prev, wavesurfer: null, regionsPlugin: null }));
    }
  }, []);

  // Load audio file (creates first segment for multi-segment support - PROMPT_009)
  const loadFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, isWaveformReady: false }));

    try {
      // Decode audio
      const audioBuffer = await decodeAudioFile(file);
      audioBufferRef.current = audioBuffer;

      // Debug: Log audio buffer info when first segment is loaded
      const channelData = audioBuffer.getChannelData(0);
      const samples = Array.from(channelData.slice(0, 10)).map(s => s.toFixed(4));
      console.log(`[loadFile] First segment from file "${file.name}": duration=${audioBuffer.duration.toFixed(2)}s, first samples: [${samples.join(', ')}]`);

      // Get file info
      const fileInfo = await getAudioFileInfo(file, audioBuffer);

      // Load into WaveSurfer if initialized, otherwise store for later
      if (wavesurferRef.current) {
        await wavesurferRef.current.loadBlob(file);
      } else {
        // Store the file to be loaded when WaveSurfer initializes
        pendingFileRef.current = file;
      }

      // PROMPT_009: Create first segment for multi-segment support
      const segmentId = `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newSegment: AudioSegment = {
        id: segmentId,
        file,
        audioBuffer,
        fileInfo,
        trimStart: 0,
        trimEnd: audioBuffer.duration,
        duration: audioBuffer.duration,
        silences: [],
        enhancementSettings: { ...DEFAULT_ENHANCEMENT_SETTINGS },
        order: 0,
        joinMode: 'crossfade',
      };

      setState(prev => ({
        ...prev,
        file,
        audioBuffer,
        fileInfo,
        isLoading: false,
        duration: audioBuffer.duration,
        trimStart: 0,
        trimEnd: audioBuffer.duration,
        currentTime: 0,
        // Multi-segment state
        segments: [newSegment],
        activeSegmentId: segmentId,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el archivo de audio';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  // Clear file
  const clearFile = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.empty();
    }
    if (regionsPluginRef.current) {
      regionsPluginRef.current.clearRegions();
    }
    audioBufferRef.current = null;
    setState(prev => ({
      ...initialState,
      wavesurfer: prev.wavesurfer,
      regionsPlugin: prev.regionsPlugin,
      isWaveformReady: false,
    }));
  }, []);

  // Generate unique segment ID (PROMPT_009)
  const generateSegmentId = useCallback(() => {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add a new audio segment (PROMPT_009)
  const addSegment = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Decode audio
      const audioBuffer = await decodeAudioFile(file);
      const fileInfo = await getAudioFileInfo(file, audioBuffer);

      // Debug: Log audio buffer info when segment is added
      const channelData = audioBuffer.getChannelData(0);
      const samples = Array.from(channelData.slice(0, 10)).map(s => s.toFixed(4));
      console.log(`[addSegment] New segment from file "${file.name}": duration=${audioBuffer.duration.toFixed(2)}s, first samples: [${samples.join(', ')}]`);

      // Update the audioBufferRef to the new segment's buffer
      audioBufferRef.current = audioBuffer;

      const segmentId = generateSegmentId();
      const newSegment: AudioSegment = {
        id: segmentId,
        file,
        audioBuffer,
        fileInfo,
        trimStart: 0,
        trimEnd: audioBuffer.duration,
        duration: audioBuffer.duration,
        silences: [],
        enhancementSettings: { ...DEFAULT_ENHANCEMENT_SETTINGS },
        order: 0, // Will be set below based on existing segments
        joinMode: 'crossfade', // Default to crossfade
      };

      setState(prev => {
        // Calculate order based on existing segments
        newSegment.order = prev.segments.length;

        const newSegments = [...prev.segments, newSegment];

        return {
          ...prev,
          segments: newSegments,
          activeSegmentId: segmentId,
          // Always update legacy state to the new active segment
          file: file,
          audioBuffer: audioBuffer,
          fileInfo: fileInfo,
          duration: audioBuffer.duration,
          trimStart: 0,
          trimEnd: audioBuffer.duration,
          silences: [],
          isLoading: false,
          isWaveformReady: false,
        };
      });

      // Load into WaveSurfer
      if (wavesurferRef.current) {
        await wavesurferRef.current.loadBlob(file);
      } else {
        pendingFileRef.current = file;
      }

      toast.success(`Segmento ${state.segments.length + 1} añadido`, toastStyles.success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el archivo de audio';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error(message, toastStyles.error);
    }
  }, [generateSegmentId, state.segments.length]);

  // Remove a segment by ID (PROMPT_009)
  const removeSegment = useCallback((segmentId: string) => {
    setState(prev => {
      const segmentIndex = prev.segments.findIndex(s => s.id === segmentId);
      if (segmentIndex === -1) return prev;

      const newSegments = prev.segments
        .filter(s => s.id !== segmentId)
        .map((s, index) => ({ ...s, order: index })); // Reorder remaining segments

      // Determine new active segment
      let newActiveId: string | null = null;
      if (newSegments.length > 0) {
        // Select the next segment, or the previous one if we removed the last
        const newIndex = Math.min(segmentIndex, newSegments.length - 1);
        newActiveId = newSegments[newIndex].id;
      }

      // Get the new active segment's data for legacy state
      const activeSegment = newActiveId
        ? newSegments.find(s => s.id === newActiveId)
        : null;

      return {
        ...prev,
        segments: newSegments,
        activeSegmentId: newActiveId,
        // Update legacy state to match active segment
        file: activeSegment?.file || null,
        audioBuffer: activeSegment?.audioBuffer || null,
        fileInfo: activeSegment?.fileInfo || null,
        duration: activeSegment?.duration || 0,
        trimStart: activeSegment?.trimStart || 0,
        trimEnd: activeSegment?.trimEnd || 0,
        silences: activeSegment?.silences || [],
        enhancementSettings: activeSegment?.enhancementSettings || DEFAULT_ENHANCEMENT_SETTINGS,
      };
    });

    // Clear waveform if no segments left
    if (state.segments.length <= 1) {
      if (wavesurferRef.current) {
        wavesurferRef.current.empty();
      }
      if (regionsPluginRef.current) {
        regionsPluginRef.current.clearRegions();
      }
      audioBufferRef.current = null;
    }

    toast.success('Segmento eliminado', toastStyles.success);
  }, [state.segments.length]);

  // Select a segment to make it active (PROMPT_009)
  const selectSegment = useCallback(async (segmentId: string) => {
    // Use functional update to avoid race conditions with stale closures
    let targetSegment: AudioSegment | null = null;

    setState(prev => {
      const segment = prev.segments.find(s => s.id === segmentId);
      if (!segment) return prev;

      // Store segment for use after setState
      targetSegment = segment;

      // Save current segment's state and switch to new segment in one atomic update
      const currentSegmentId = prev.activeSegmentId;
      let updatedSegments = prev.segments;

      if (currentSegmentId && currentSegmentId !== segmentId) {
        // Update the current segment with current trim/silence/enhancement state
        updatedSegments = prev.segments.map(s =>
          s.id === currentSegmentId
            ? {
                ...s,
                trimStart: prev.trimStart,
                trimEnd: prev.trimEnd,
                silences: prev.silences,
                enhancementSettings: prev.enhancementSettings,
              }
            : s
        );
      }

      // Return combined update with new active segment
      return {
        ...prev,
        segments: updatedSegments,
        activeSegmentId: segmentId,
        file: segment.file,
        audioBuffer: segment.audioBuffer,
        fileInfo: segment.fileInfo,
        duration: segment.duration,
        trimStart: segment.trimStart,
        trimEnd: segment.trimEnd,
        silences: segment.silences,
        enhancementSettings: segment.enhancementSettings,
        isWaveformReady: false,
      };
    });

    // Only proceed if segment was found
    if (!targetSegment) return;

    audioBufferRef.current = targetSegment.audioBuffer;

    // Load into WaveSurfer
    if (wavesurferRef.current) {
      await wavesurferRef.current.loadBlob(targetSegment.file);
    } else {
      pendingFileRef.current = targetSegment.file;
    }

    // Clear regions for new segment
    if (regionsPluginRef.current) {
      regionsPluginRef.current.clearRegions();
    }
  }, []);

  // Reorder segments (PROMPT_009)
  const reorderSegments = useCallback((segmentIds: string[]) => {
    setState(prev => {
      const newSegments = segmentIds
        .map((id, index) => {
          const segment = prev.segments.find(s => s.id === id);
          return segment ? { ...segment, order: index } : null;
        })
        .filter((s): s is AudioSegment => s !== null);

      return { ...prev, segments: newSegments };
    });
  }, []);

  // Set segment join mode (PROMPT_009)
  const setSegmentJoinMode = useCallback((segmentId: string, mode: 'crossfade' | 'cut') => {
    setState(prev => ({
      ...prev,
      segments: prev.segments.map(s =>
        s.id === segmentId ? { ...s, joinMode: mode } : s
      ),
    }));
  }, []);

  // Move segment up in order (PROMPT_009)
  const moveSegmentUp = useCallback((segmentId: string) => {
    setState(prev => {
      const index = prev.segments.findIndex(s => s.id === segmentId);
      if (index <= 0) return prev; // Already at top or not found

      const newSegments = [...prev.segments];
      // Swap with previous segment
      [newSegments[index - 1], newSegments[index]] = [newSegments[index], newSegments[index - 1]];
      // Update order values
      newSegments.forEach((s, i) => { s.order = i; });

      return { ...prev, segments: newSegments };
    });
  }, []);

  // Move segment down in order (PROMPT_009)
  const moveSegmentDown = useCallback((segmentId: string) => {
    setState(prev => {
      const index = prev.segments.findIndex(s => s.id === segmentId);
      if (index === -1 || index >= prev.segments.length - 1) return prev; // Already at bottom or not found

      const newSegments = [...prev.segments];
      // Swap with next segment
      [newSegments[index], newSegments[index + 1]] = [newSegments[index + 1], newSegments[index]];
      // Update order values
      newSegments.forEach((s, i) => { s.order = i; });

      return { ...prev, segments: newSegments };
    });
  }, []);

  // Playback controls
  const play = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // If at trim end or beyond, seek to trim start first
    const currentTime = ws.getCurrentTime();
    if (currentTime >= state.trimEnd || currentTime < state.trimStart) {
      ws.seekTo(state.trimStart / state.duration);
    }

    ws.play();
  }, [state.trimStart, state.trimEnd, state.duration]);

  const pause = useCallback(() => {
    wavesurferRef.current?.pause();

    // Pause music preview as well
    if (introAudioRef.current) {
      introAudioRef.current.pause();
    }
    if (outroAudioRef.current) {
      outroAudioRef.current.pause();
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }

    setState(prev => ({ ...prev, isPreviewingWithMusic: false }));
  }, []);

  const stop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    ws.pause();
    ws.seekTo(state.trimStart / state.duration);
    setState(prev => ({ ...prev, currentTime: state.trimStart, isPreviewingWithMusic: false }));

    // Stop any music preview
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
    }
    if (outroAudioRef.current) {
      outroAudioRef.current.pause();
      outroAudioRef.current.currentTime = 0;
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
  }, [state.trimStart, state.duration]);

  // Play preview with intro/outro music
  const playPreviewWithMusic = useCallback(async () => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    // Clean up any existing audio elements to prevent memory leaks
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.src = '';
      introAudioRef.current = null;
    }
    if (outroAudioRef.current) {
      outroAudioRef.current.pause();
      outroAudioRef.current.src = '';
      outroAudioRef.current = null;
    }

    const { musicSettings } = state;
    const hasIntro = musicSettings.includeIntro && musicSettings.introTrack?.audio_url;
    const hasOutro = musicSettings.includeOutro && musicSettings.outroTrack?.audio_url;

    // If no music enabled, just play normally
    if (!hasIntro && !hasOutro) {
      play();
      return;
    }

    setState(prev => ({ ...prev, isPreviewingWithMusic: true, isPlaying: true, previewCurrentTime: 0 }));

    const CROSSFADE_DURATION = 0.5; // seconds
    const introDuration = musicSettings.introTrack?.duration_seconds || 0;
    const outroDuration = musicSettings.outroTrack?.duration_seconds || 0;
    const sermonDuration = state.trimEnd - state.trimStart;

    // Calculate timing
    const introOverlap = hasIntro ? Math.min(CROSSFADE_DURATION, introDuration / 2, sermonDuration / 2) : 0;
    const outroOverlap = hasOutro ? Math.min(CROSSFADE_DURATION, outroDuration / 2, sermonDuration / 2) : 0;
    const sermonStartDelay = hasIntro ? (introDuration - introOverlap) * 1000 : 0; // ms

    let startTime = Date.now();
    let outroStarted = false;

    // Update preview time display
    previewIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setState(prev => ({ ...prev, previewCurrentTime: elapsed }));
    }, 100);

    // Set up outro trigger based on WaveSurfer time (more reliable than setTimeout for long audio)
    if (hasOutro && musicSettings.outroTrack) {
      const outroTriggerTime = state.trimEnd - outroOverlap;
      const outroUrl = musicSettings.outroTrack.audio_url;

      const checkOutroTrigger = () => {
        const currentTime = ws.getCurrentTime();
        if (!outroStarted && currentTime >= outroTriggerTime) {
          outroStarted = true;
          ws.un('timeupdate', checkOutroTrigger);

          // Play outro
          outroAudioRef.current = new Audio(outroUrl);
          outroAudioRef.current.volume = state.volume;
          outroAudioRef.current.play();

          // When outro ends, stop everything
          outroAudioRef.current.onended = () => {
            setState(prev => ({ ...prev, isPlaying: false, isPreviewingWithMusic: false }));
            if (previewIntervalRef.current) {
              clearInterval(previewIntervalRef.current);
              previewIntervalRef.current = null;
            }
          };
        }
      };

      ws.on('timeupdate', checkOutroTrigger);
    }

    // Play intro if enabled
    if (hasIntro && musicSettings.introTrack) {
      introAudioRef.current = new Audio(musicSettings.introTrack.audio_url);
      introAudioRef.current.volume = state.volume;
      await introAudioRef.current.play();

      // Schedule sermon to start after intro (with crossfade overlap)
      previewTimeoutRef.current = setTimeout(() => {
        ws.seekTo(state.trimStart / state.duration);
        ws.play();
      }, sermonStartDelay);
    } else {
      // No intro, start sermon immediately
      ws.seekTo(state.trimStart / state.duration);
      ws.play();
    }
  }, [state.musicSettings, state.trimStart, state.trimEnd, state.duration, state.volume, play]);

  const seek = useCallback((time: number) => {
    const ws = wavesurferRef.current;
    if (!ws || state.duration === 0) return;

    // Clamp to trim boundaries
    const clampedTime = Math.max(state.trimStart, Math.min(state.trimEnd, time));
    ws.seekTo(clampedTime / state.duration);
    setState(prev => ({ ...prev, currentTime: clampedTime }));
  }, [state.duration, state.trimStart, state.trimEnd]);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    wavesurferRef.current?.setVolume(clampedVolume);
    setState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    wavesurferRef.current?.setPlaybackRate(rate);
    setState(prev => ({ ...prev, playbackRate: rate }));
  }, []);

  // Trim controls
  const setTrimStart = useCallback((time: number) => {
    setState(prev => {
      const newStart = Math.max(0, Math.min(time, prev.trimEnd - 1));
      return { ...prev, trimStart: newStart };
    });
  }, []);

  const setTrimEnd = useCallback((time: number) => {
    setState(prev => {
      const newEnd = Math.min(prev.duration, Math.max(time, prev.trimStart + 1));
      return { ...prev, trimEnd: newEnd };
    });
  }, []);

  const resetTrim = useCallback(() => {
    setState(prev => ({
      ...prev,
      trimStart: 0,
      trimEnd: prev.duration,
    }));
  }, []);

  // Apply trim permanently - creates new trimmed audio buffer
  const applyTrim = useCallback(async () => {
    const audioBuffer = audioBufferRef.current;
    if (!audioBuffer) return;

    // Only apply if there's actually something to trim
    if (state.trimStart === 0 && state.trimEnd >= state.duration) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Save current state to history before applying trim
      pushHistory({
        type: 'trim',
        data: {
          trimStart: state.trimStart,
          trimEnd: state.trimEnd,
        },
      });

      // Create the trimmed buffer
      const trimmedBuffer = trimAudioBuffer(
        audioBuffer,
        state.trimStart,
        state.trimEnd
      );

      // Update the ref
      audioBufferRef.current = trimmedBuffer;

      // Create a new File object from the trimmed buffer for draft saving
      // We'll encode it as WAV for lossless storage
      const wavBlob = audioBufferToWav(trimmedBuffer);
      const trimmedFile = new File(
        [wavBlob],
        state.file?.name.replace(/\.[^/.]+$/, '_trimmed.wav') || 'trimmed_audio.wav',
        { type: 'audio/wav' }
      );

      // Clear silences since they're now invalid
      if (regionsPluginRef.current) {
        regionsPluginRef.current.clearRegions();
      }

      // Update state - waveform will be reloaded
      // PROMPT_009: Also update the active segment with the new trimmed data
      setState(prev => {
        const updatedFileInfo = prev.fileInfo ? {
          ...prev.fileInfo,
          name: trimmedFile.name,
          size: trimmedFile.size,
          duration: trimmedBuffer.duration,
        } : null;

        // Update the active segment in the segments array
        const updatedSegments = prev.segments.map(seg =>
          seg.id === prev.activeSegmentId
            ? {
                ...seg,
                file: trimmedFile,
                audioBuffer: trimmedBuffer,
                fileInfo: updatedFileInfo,
                duration: trimmedBuffer.duration,
                trimStart: 0,
                trimEnd: trimmedBuffer.duration,
                silences: [], // Clear silences - need to re-detect
              }
            : seg
        );

        return {
          ...prev,
          file: trimmedFile,
          audioBuffer: trimmedBuffer,
          fileInfo: updatedFileInfo,
          isLoading: false,
          isWaveformReady: false, // Will be set true when WaveSurfer fires 'ready'
          duration: trimmedBuffer.duration,
          trimStart: 0,
          trimEnd: trimmedBuffer.duration,
          currentTime: 0,
          silences: [], // Clear silences - need to re-detect
          segments: updatedSegments,
        };
      });

      // Reload WaveSurfer with new audio using object URL
      const ws = wavesurferRef.current;
      if (ws) {
        const objectUrl = URL.createObjectURL(trimmedFile);
        try {
          await ws.load(objectUrl);
        } finally {
          // Clean up object URL after loading
          URL.revokeObjectURL(objectUrl);
        }
      }

      toast.success('Recorte aplicado', toastStyles.success);
    } catch (err) {
      console.error('Error applying trim:', err);
      setState(prev => ({ ...prev, isLoading: false }));
      toast.error('Error al aplicar el recorte', toastStyles.error);
    }
  }, [state.trimStart, state.trimEnd, state.duration, state.file, pushHistory]);

  // Silence detection
  const detectSilencesAction = useCallback(async () => {
    const audioBuffer = audioBufferRef.current;
    if (!audioBuffer) return;

    setState(prev => ({ ...prev, isDetectingSilence: true }));

    try {
      // Save current silences to history before re-detecting
      setState(prev => {
        if (prev.silences.length > 0) {
          const newHistory = [
            ...prev.editHistory.slice(-(MAX_HISTORY_SIZE - 1)),
            {
              type: 'silence_detect' as const,
              timestamp: Date.now(),
              data: { silences: [...prev.silences] },
            },
          ];
          return { ...prev, editHistory: newHistory, canUndo: true };
        }
        return prev;
      });

      const silences = await detectSilences(audioBuffer, state.silenceOptions);

      setState(prev => ({
        ...prev,
        silences,
        isDetectingSilence: false,
      }));

      if (silences.length > 0) {
        toast.success(`Se detectaron ${silences.length} silencios`, toastStyles.success);
      } else {
        toast.success('No se encontraron silencios con estos parámetros', toastStyles.success);
      }
    } catch (err) {
      setState(prev => ({ ...prev, isDetectingSilence: false }));
      toast.error('Error al detectar silencios', toastStyles.error);
    }
  }, [state.silenceOptions]);

  // Set silence detection options
  const setSilenceOptions = useCallback((options: SilenceDetectionOptions) => {
    setState(prev => ({ ...prev, silenceOptions: options }));
  }, []);

  // Toggle silence removal mark
  const toggleSilenceRemoval = useCallback((silenceId: string) => {
    setState(prev => {
      // Save current state to history
      const newHistory = [
        ...prev.editHistory.slice(-(MAX_HISTORY_SIZE - 1)),
        {
          type: 'silence_toggle' as const,
          timestamp: Date.now(),
          data: { silences: [...prev.silences] },
        },
      ];

      const newSilences = prev.silences.map(s =>
        s.id === silenceId ? { ...s, markedForRemoval: !s.markedForRemoval } : s
      );

      return {
        ...prev,
        silences: newSilences,
        editHistory: newHistory,
        canUndo: true,
      };
    });
  }, []);

  // Preview a silence region
  const previewSilence = useCallback((silence: SilenceRegion) => {
    const ws = wavesurferRef.current;
    if (!ws || state.duration === 0) return;

    // Clean up previous listener if exists (prevents memory leak on rapid clicks)
    if (previewListenerRef.current) {
      ws.un('timeupdate', previewListenerRef.current);
      previewListenerRef.current = null;
    }

    // Seek to silence start and play
    ws.seekTo(silence.start / state.duration);
    ws.play();

    // Stop playback when reaching silence end
    const checkPosition = () => {
      const currentTime = ws.getCurrentTime();
      if (currentTime >= silence.end) {
        ws.pause();
        ws.un('timeupdate', checkPosition);
        previewListenerRef.current = null;
      }
    };

    previewListenerRef.current = checkPosition;
    ws.on('timeupdate', checkPosition);
  }, [state.duration]);

  // Set music settings (PROMPT_004)
  const setMusicSettings = useCallback((settings: MusicSettings) => {
    setState(prev => ({ ...prev, musicSettings: settings }));
  }, []);

  // Set metadata (PROMPT_005)
  const setMetadata = useCallback((metadata: SermonMetadata) => {
    setState(prev => ({ ...prev, metadata }));
  }, []);

  // Set cover image (PROMPT_005)
  const setCoverImage = useCallback((coverImage: Blob | null) => {
    setState(prev => ({ ...prev, coverImage }));
  }, []);

  // Set audio enhancement settings (PROMPT_008)
  const setEnhancementSettings = useCallback((enhancementSettings: EnhancementSettings) => {
    setState(prev => ({ ...prev, enhancementSettings }));
  }, []);

  // Undo last action
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.editHistory.length === 0) return prev;

      const lastEntry = prev.editHistory[prev.editHistory.length - 1];
      const newHistory = prev.editHistory.slice(0, -1);

      let newState: Partial<SermonEditorState> = {
        editHistory: newHistory,
        canUndo: newHistory.length > 0,
      };

      // Restore based on entry type
      if (lastEntry.data.silences) {
        newState.silences = lastEntry.data.silences;
      }
      if (lastEntry.data.trimStart !== undefined) {
        newState.trimStart = lastEntry.data.trimStart;
      }
      if (lastEntry.data.trimEnd !== undefined) {
        newState.trimEnd = lastEntry.data.trimEnd;
      }

      return { ...prev, ...newState };
    });

    toast.success('Acción deshecha', toastStyles.success);
  }, []);

  // Save draft to storage
  const saveDraft = useCallback(async () => {
    if (!state.file) return;

    setState(prev => ({ ...prev, isSavingDraft: true }));

    try {
      await saveDraftToStorage(
        {
          metadata: state.metadata,
          trimStart: state.trimStart,
          trimEnd: state.trimEnd,
          duration: state.duration,
          musicSettings: {
            includeIntro: state.musicSettings.includeIntro,
            includeOutro: state.musicSettings.includeOutro,
            introTrack: state.musicSettings.introTrack,
            outroTrack: state.musicSettings.outroTrack,
          },
          silences: state.silences,
        },
        state.file,
        state.coverImage
      );

      const savedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        isSavingDraft: false,
        lastSavedAt: savedAt,
      }));

      toast.success('Borrador guardado', toastStyles.success);
    } catch (err) {
      console.error('Error saving draft:', err);
      setState(prev => ({ ...prev, isSavingDraft: false }));
      toast.error('Error al guardar el borrador', toastStyles.error);
    }
  }, [state.file, state.metadata, state.trimStart, state.trimEnd, state.duration, state.musicSettings, state.silences, state.coverImage]);

  // Load draft from storage
  const loadDraftAction = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const draftData = await loadDraftFromStorage();
      if (!draftData) {
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      const { draft, audioFile, coverImage } = draftData;

      // Load audio file if present
      if (audioFile) {
        const audioBuffer = await decodeAudioFile(audioFile);
        audioBufferRef.current = audioBuffer;

        // Store file to be loaded when WaveSurfer initializes
        if (wavesurferRef.current) {
          await wavesurferRef.current.loadBlob(audioFile);
        } else {
          pendingFileRef.current = audioFile;
        }

        // Get file info
        const fileInfo = await getAudioFileInfo(audioFile, audioBuffer);

        // Restore state from draft
        setState(prev => ({
          ...prev,
          file: audioFile,
          audioBuffer,
          fileInfo,
          isLoading: false,
          duration: audioBuffer.duration,
          trimStart: draft.trimStart,
          trimEnd: draft.trimEnd,
          metadata: {
            title: draft.metadata.title,
            speaker: draft.metadata.speaker,
            date: new Date(draft.metadata.date),
            series: draft.metadata.series || undefined,
            description: draft.metadata.description || undefined,
            liturgyId: undefined,
          },
          coverImage: coverImage,
          musicSettings: {
            includeIntro: draft.musicSettings.includeIntro,
            includeOutro: draft.musicSettings.includeOutro,
            introTrack: null, // Will be loaded by MusicSelector
            outroTrack: null,
          },
          silences: [], // Will need to re-detect or restore from IDs
          lastSavedAt: draft.savedAt,
        }));

        toast.success('Borrador restaurado', toastStyles.success);
        return true;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (err) {
      console.error('Error loading draft:', err);
      setState(prev => ({ ...prev, isLoading: false }));
      toast.error('Error al cargar el borrador', toastStyles.error);
      return false;
    }
  }, []);

  // Clear draft from storage
  const clearDraft = useCallback(async () => {
    try {
      await deleteDraftFromStorage();
      setState(prev => ({ ...prev, lastSavedAt: null }));
    } catch (err) {
      console.error('Error clearing draft:', err);
    }
  }, []);

  // Check if a draft exists
  const checkForDraft = useCallback(() => {
    const exists = hasDraft();
    const info = getDraftInfo();
    return { exists, info };
  }, []);

  // Export trimmed MP3 with silence removals and optional intro/outro (PROMPT_004)
  // Updated for PROMPT_009: Multi-segment support
  const exportMp3 = useCallback(async (title?: string) => {
    // PROMPT_009: Check if we have multiple segments
    const hasMultipleSegments = state.segments.length > 1;

    // For single segment mode, use legacy audioBuffer
    const audioBuffer = audioBufferRef.current;
    if (!hasMultipleSegments && !audioBuffer) {
      return;
    }

    setState(prev => ({ ...prev, isExporting: true, exportProgress: 0 }));

    try {
      let processedBuffer: AudioBuffer;

      if (hasMultipleSegments) {
        // PROMPT_009: Multi-segment export
        // First, save the current active segment's state
        const segmentsWithCurrentState = state.segments.map(s =>
          s.id === state.activeSegmentId
            ? {
                ...s,
                trimStart: state.trimStart,
                trimEnd: state.trimEnd,
                silences: state.silences,
                enhancementSettings: state.enhancementSettings,
              }
            : s
        );

        // Process each segment
        const segmentsForConcat: SegmentForConcatenation[] = [];
        const progressPerSegment = 30 / segmentsWithCurrentState.length;

        for (let i = 0; i < segmentsWithCurrentState.length; i++) {
          const segment = segmentsWithCurrentState[i];
          setState(prev => ({ ...prev, exportProgress: i * progressPerSegment }));

          // Get silences marked for removal for this segment
          const silencesToRemove = segment.silences.filter(s => s.markedForRemoval);

          let segmentBuffer: AudioBuffer;

          if (silencesToRemove.length > 0) {
            // Apply trims and silence removals
            segmentBuffer = trimAudioBufferWithSilenceRemovals(
              segment.audioBuffer,
              segment.trimStart,
              segment.trimEnd,
              silencesToRemove
            );
          } else {
            // Just apply trims
            segmentBuffer = trimAudioBuffer(
              segment.audioBuffer,
              segment.trimStart,
              segment.trimEnd
            );
          }

          // Apply audio enhancements if enabled for this segment
          if (segment.enhancementSettings.enabled) {
            try {
              segmentBuffer = await applyEnhancements(segmentBuffer, segment.enhancementSettings);
              console.log(`[exportMp3] Segment ${i + 1} enhancements applied`);
            } catch (err) {
              console.error(`[exportMp3] Error applying enhancements to segment ${i + 1}:`, err);
              // Continue without enhancements for this segment
            }
          }

          segmentsForConcat.push({
            buffer: segmentBuffer,
            joinMode: segment.joinMode,
          });
        }

        setState(prev => ({ ...prev, exportProgress: 35 }));

        // Concatenate all segments
        processedBuffer = await concatenateSegments(segmentsForConcat, 0.5);
        console.log(`[exportMp3] ${segmentsForConcat.length} segments concatenated`);

        setState(prev => ({ ...prev, exportProgress: 40 }));
      } else {
        // Single segment mode (legacy) - use current state
        // Get silences marked for removal
        const silencesToRemove = state.silences.filter(s => s.markedForRemoval);

        if (silencesToRemove.length > 0) {
          // Apply trims and silence removals
          processedBuffer = trimAudioBufferWithSilenceRemovals(
            audioBuffer!,
            state.trimStart,
            state.trimEnd,
            silencesToRemove
          );
        } else {
          // Just apply trims
          processedBuffer = trimAudioBuffer(
            audioBuffer!,
            state.trimStart,
            state.trimEnd
          );
        }

        // PROMPT_008: Apply audio enhancements (normalization, EQ, compression, gain)
        const { enhancementSettings } = state;
        if (enhancementSettings.enabled) {
          try {
            processedBuffer = await applyEnhancements(processedBuffer, enhancementSettings);
            console.log('[exportMp3] Audio enhancements applied successfully');
          } catch (err) {
            console.error('[exportMp3] Error applying enhancements:', err);
            toast.error('Error al aplicar mejoras de audio. Continuando sin mejoras.', toastStyles.error);
            // Continue without enhancements
          }
        }
      }

      // PROMPT_004: Add intro/outro music with crossfade
      const { musicSettings } = state;
      const hasIntro = musicSettings.includeIntro && musicSettings.introTrack?.audio_url;
      const hasOutro = musicSettings.includeOutro && musicSettings.outroTrack?.audio_url;

      if (hasIntro || hasOutro) {
        setState(prev => ({ ...prev, exportProgress: 10 }));

        // Fetch intro buffer if needed - ABORT ON FAILURE (PROMPT_004b Fix 1)
        let introBuffer: AudioBuffer | null = null;
        if (hasIntro && musicSettings.introTrack) {
          try {
            introBuffer = await fetchAudioBuffer(musicSettings.introTrack.audio_url);
          } catch (err) {
            console.error('Failed to load intro track:', err);
            toast.error('Error al cargar la pista de introducción. Exportación cancelada.', toastStyles.error);
            setState(prev => ({ ...prev, isExporting: false, exportProgress: 0 }));
            return; // Abort export
          }
        }

        setState(prev => ({ ...prev, exportProgress: 20 }));

        // Fetch outro buffer if needed - ABORT ON FAILURE (PROMPT_004b Fix 1)
        let outroBuffer: AudioBuffer | null = null;
        if (hasOutro && musicSettings.outroTrack) {
          try {
            outroBuffer = await fetchAudioBuffer(musicSettings.outroTrack.audio_url);
          } catch (err) {
            console.error('Failed to load outro track:', err);
            toast.error('Error al cargar la pista de cierre. Exportación cancelada.', toastStyles.error);
            setState(prev => ({ ...prev, isExporting: false, exportProgress: 0 }));
            return; // Abort export
          }
        }

        setState(prev => ({ ...prev, exportProgress: 30 }));

        // Concatenate with crossfade
        if (introBuffer || outroBuffer) {
          processedBuffer = await concatenateWithCrossfade(processedBuffer, {
            introBuffer,
            outroBuffer,
            crossfadeDuration: 0.5, // 0.5 second crossfade
          });
        }

        setState(prev => ({ ...prev, exportProgress: 40 }));
      }

      // Encode to MP3
      let mp3Blob = await encodeToMp3(processedBuffer, {
        bitrate: 128,
        onProgress: (progress) => {
          // Scale progress from 40-85 if we had music processing, otherwise 0-85
          const baseProgress = (hasIntro || hasOutro) ? 40 : 0;
          const scaledProgress = baseProgress + (progress * (85 - baseProgress) / 100);
          setState(prev => ({ ...prev, exportProgress: scaledProgress }));
        },
      });

      setState(prev => ({ ...prev, exportProgress: 90 }));

      // PROMPT_005: Embed ID3 metadata if available
      const { metadata, coverImage } = state;
      if (metadata.title && metadata.speaker) {
        try {
          // Convert cover image to ArrayBuffer if present
          let coverImageBuffer: ArrayBuffer | undefined;
          if (coverImage) {
            coverImageBuffer = await blobToArrayBuffer(coverImage);
          }

          // Create metadata object
          const mp3Metadata = createMP3Metadata(
            metadata.title,
            metadata.speaker,
            metadata.date,
            {
              series: metadata.series,
              description: metadata.description,
              coverImageBuffer,
            }
          );

          // Embed metadata
          mp3Blob = await embedMetadata(mp3Blob, mp3Metadata);
          console.log('[exportMp3] ID3 metadata embedded successfully');
        } catch (err) {
          console.error('[exportMp3] Error embedding metadata:', err);
          // Continue with export even if metadata embedding fails
        }
      }

      setState(prev => ({ ...prev, exportProgress: 95 }));

      // Download - use metadata title if available, otherwise use original title
      const exportTitle = metadata.title || title;
      const filename = generateExportFilename(exportTitle, metadata.date || new Date());
      downloadBlob(mp3Blob, filename);

      // PROMPT_006: Store the exported audio blob for distribution
      setState(prev => ({
        ...prev,
        isExporting: false,
        exportProgress: 100,
        exportedAudio: mp3Blob,
      }));

      // Show success toast with info
      // PROMPT_009: Calculate total silences removed across all segments
      let totalSilencesRemoved = 0;
      let totalRemovedDuration = 0;

      if (hasMultipleSegments) {
        const segmentsWithCurrentState = state.segments.map(s =>
          s.id === state.activeSegmentId
            ? { ...s, silences: state.silences }
            : s
        );
        for (const seg of segmentsWithCurrentState) {
          const segSilences = seg.silences.filter(s => s.markedForRemoval);
          totalSilencesRemoved += segSilences.length;
          totalRemovedDuration += calculateRemovedDuration(segSilences);
        }
      } else {
        const silencesToRemove = state.silences.filter(s => s.markedForRemoval);
        totalSilencesRemoved = silencesToRemove.length;
        totalRemovedDuration = calculateRemovedDuration(silencesToRemove);
      }

      const musicInfo = [];
      if (hasIntro) musicInfo.push('intro');
      if (hasOutro) musicInfo.push('cierre');

      // Build success message
      const features = [];
      if (metadata.title && metadata.speaker) {
        features.push('metadatos ID3');
      }
      if (coverImage) {
        features.push('portada');
      }
      if (musicInfo.length > 0) {
        features.push(musicInfo.join(' y '));
      }
      if (state.enhancementSettings.enabled || (hasMultipleSegments && state.segments.some(s => s.enhancementSettings.enabled))) {
        features.push('mejoras de audio');
      }
      if (hasMultipleSegments) {
        features.push(`${state.segments.length} segmentos`);
      }

      let successMessage = 'MP3 exportado exitosamente';
      if (features.length > 0) {
        successMessage = `MP3 exportado con ${features.join(', ')}`;
      }
      if (totalSilencesRemoved > 0) {
        successMessage += `. Se eliminaron ${totalSilencesRemoved} silencios (${totalRemovedDuration.toFixed(1)}s)`;
      }

      toast.success(successMessage, toastStyles.success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al exportar MP3';
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: message,
      }));

      // Show error toast
      toast.error('Error al exportar MP3. Intente de nuevo.', toastStyles.error);
    }
  }, [state.trimStart, state.trimEnd, state.silences, state.musicSettings, state.metadata, state.coverImage, state.enhancementSettings, state.segments, state.activeSegmentId]);

  // PROMPT_009: Generate composite preview buffer (all segments + intro/outro)
  const generateCompositePreview = useCallback(async () => {
    const hasMultipleSegments = state.segments.length > 0;
    const audioBuffer = audioBufferRef.current;

    if (!hasMultipleSegments && !audioBuffer) {
      return;
    }

    setState(prev => ({ ...prev, isGeneratingCompositePreview: true }));

    try {
      let processedBuffer: AudioBuffer;

      if (hasMultipleSegments) {
        // Save the current active segment's state
        const segmentsWithCurrentState = state.segments.map(s =>
          s.id === state.activeSegmentId
            ? {
                ...s,
                trimStart: state.trimStart,
                trimEnd: state.trimEnd,
                silences: state.silences,
                enhancementSettings: state.enhancementSettings,
              }
            : s
        );

        // Process each segment
        const segmentsForConcat: SegmentForConcatenation[] = [];

        for (let i = 0; i < segmentsWithCurrentState.length; i++) {
          const segment = segmentsWithCurrentState[i];

          // Get silences marked for removal for this segment
          const silencesToRemove = segment.silences.filter(s => s.markedForRemoval);

          let segmentBuffer: AudioBuffer;

          if (silencesToRemove.length > 0) {
            segmentBuffer = trimAudioBufferWithSilenceRemovals(
              segment.audioBuffer,
              segment.trimStart,
              segment.trimEnd,
              silencesToRemove
            );
          } else {
            segmentBuffer = trimAudioBuffer(
              segment.audioBuffer,
              segment.trimStart,
              segment.trimEnd
            );
          }

          // Apply audio enhancements if enabled for this segment
          if (segment.enhancementSettings.enabled) {
            try {
              segmentBuffer = await applyEnhancements(segmentBuffer, segment.enhancementSettings);
            } catch (err) {
              console.error(`[generateCompositePreview] Error applying enhancements to segment ${i + 1}:`, err);
            }
          }

          segmentsForConcat.push({
            buffer: segmentBuffer,
            joinMode: segment.joinMode,
          });
        }

        // Concatenate all segments
        console.log('[generateCompositePreview] Segments to concatenate:');
        segmentsForConcat.forEach((seg, i) => {
          // Log first 10 samples to help identify audio content
          const channelData = seg.buffer.getChannelData(0);
          const samples = Array.from(channelData.slice(0, 10)).map(s => s.toFixed(4));
          console.log(`  Segment ${i + 1}: ${seg.buffer.duration.toFixed(2)}s, joinMode: ${seg.joinMode}, first samples: [${samples.join(', ')}]`);
        });

        // Also log the raw segment info from state
        console.log('[generateCompositePreview] Raw segments from state:');
        segmentsWithCurrentState.forEach((seg, i) => {
          const channelData = seg.audioBuffer.getChannelData(0);
          const samples = Array.from(channelData.slice(0, 10)).map(s => s.toFixed(4));
          console.log(`  Raw Segment ${i + 1}: id=${seg.id}, duration=${seg.audioBuffer.duration.toFixed(2)}s, trimStart=${seg.trimStart.toFixed(2)}, trimEnd=${seg.trimEnd.toFixed(2)}, first samples: [${samples.join(', ')}]`);
        });

        processedBuffer = await concatenateSegments(segmentsForConcat, 0.5);
        console.log(`[generateCompositePreview] After segment concatenation: ${processedBuffer.duration.toFixed(2)}s`);
      } else {
        // Single segment mode
        const silencesToRemove = state.silences.filter(s => s.markedForRemoval);

        if (silencesToRemove.length > 0) {
          processedBuffer = trimAudioBufferWithSilenceRemovals(
            audioBuffer!,
            state.trimStart,
            state.trimEnd,
            silencesToRemove
          );
        } else {
          processedBuffer = trimAudioBuffer(
            audioBuffer!,
            state.trimStart,
            state.trimEnd
          );
        }

        if (state.enhancementSettings.enabled) {
          try {
            processedBuffer = await applyEnhancements(processedBuffer, state.enhancementSettings);
          } catch (err) {
            console.error('[generateCompositePreview] Error applying enhancements:', err);
          }
        }
      }

      // Add intro/outro music with crossfade
      const { musicSettings } = state;
      const hasIntro = musicSettings.includeIntro && musicSettings.introTrack?.audio_url;
      const hasOutro = musicSettings.includeOutro && musicSettings.outroTrack?.audio_url;

      console.log(`[generateCompositePreview] Before intro/outro: ${processedBuffer.duration.toFixed(2)}s`);
      console.log(`[generateCompositePreview] hasIntro: ${hasIntro}, hasOutro: ${hasOutro}`);

      if (hasIntro || hasOutro) {
        let introBuffer: AudioBuffer | null = null;
        if (hasIntro && musicSettings.introTrack) {
          try {
            introBuffer = await fetchAudioBuffer(musicSettings.introTrack.audio_url);
            const introSamples = Array.from(introBuffer.getChannelData(0).slice(0, 10)).map(s => s.toFixed(4));
            console.log(`[generateCompositePreview] Intro loaded: ${introBuffer.duration.toFixed(2)}s, first samples: [${introSamples.join(', ')}]`);
          } catch (err) {
            console.error('Failed to load intro track:', err);
            toast.error('Error al cargar la pista de introducción', toastStyles.error);
          }
        }

        let outroBuffer: AudioBuffer | null = null;
        if (hasOutro && musicSettings.outroTrack) {
          try {
            outroBuffer = await fetchAudioBuffer(musicSettings.outroTrack.audio_url);
            const outroSamples = Array.from(outroBuffer.getChannelData(0).slice(0, 10)).map(s => s.toFixed(4));
            console.log(`[generateCompositePreview] Outro loaded: ${outroBuffer.duration.toFixed(2)}s, first samples: [${outroSamples.join(', ')}]`);
          } catch (err) {
            console.error('Failed to load outro track:', err);
            toast.error('Error al cargar la pista de cierre', toastStyles.error);
          }
        }

        if (introBuffer || outroBuffer) {
          processedBuffer = await concatenateWithCrossfade(processedBuffer, {
            introBuffer,
            outroBuffer,
            crossfadeDuration: 0.5,
          });
          console.log(`[generateCompositePreview] After intro/outro: ${processedBuffer.duration.toFixed(2)}s`);
        }
      }

      setState(prev => ({
        ...prev,
        isGeneratingCompositePreview: false,
        compositePreviewBuffer: processedBuffer,
        compositePreviewDuration: processedBuffer.duration,
        compositePreviewCurrentTime: 0,
      }));

      toast.success('Vista previa generada', toastStyles.success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar vista previa';
      console.error('[generateCompositePreview] Error:', err);
      setState(prev => ({
        ...prev,
        isGeneratingCompositePreview: false,
        error: message,
      }));
      toast.error('Error al generar vista previa', toastStyles.error);
    }
  }, [state.segments, state.activeSegmentId, state.trimStart, state.trimEnd, state.silences, state.enhancementSettings, state.musicSettings]);

  // PROMPT_009: Play the composite preview buffer
  const playCompositePreview = useCallback(() => {
    if (!state.compositePreviewBuffer) {
      toast.error('Primero genera la vista previa', toastStyles.error);
      return;
    }

    // Stop current playback if any
    if (compositePreviewSourceRef.current) {
      try {
        compositePreviewSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    // Clear any existing interval
    if (compositePreviewIntervalRef.current) {
      clearInterval(compositePreviewIntervalRef.current);
    }

    // Create or reuse AudioContext
    if (!compositePreviewContextRef.current) {
      compositePreviewContextRef.current = new AudioContext();
    }

    const context = compositePreviewContextRef.current;
    const source = context.createBufferSource();
    source.buffer = state.compositePreviewBuffer;
    source.connect(context.destination);

    // Start from current time
    const startOffset = state.compositePreviewCurrentTime;
    compositePreviewStartTimeRef.current = context.currentTime - startOffset;
    source.start(0, startOffset);
    compositePreviewSourceRef.current = source;

    // Update state
    setState(prev => ({ ...prev, isPlayingCompositePreview: true }));

    // Set up interval to update current time
    compositePreviewIntervalRef.current = setInterval(() => {
      if (compositePreviewContextRef.current) {
        const elapsed = compositePreviewContextRef.current.currentTime - compositePreviewStartTimeRef.current;
        setState(prev => {
          if (elapsed >= prev.compositePreviewDuration) {
            // Playback finished
            if (compositePreviewIntervalRef.current) {
              clearInterval(compositePreviewIntervalRef.current);
            }
            return {
              ...prev,
              isPlayingCompositePreview: false,
              compositePreviewCurrentTime: 0,
            };
          }
          return { ...prev, compositePreviewCurrentTime: elapsed };
        });
      }
    }, 100);

    // Handle playback end
    source.onended = () => {
      if (compositePreviewIntervalRef.current) {
        clearInterval(compositePreviewIntervalRef.current);
      }
      setState(prev => ({
        ...prev,
        isPlayingCompositePreview: false,
        compositePreviewCurrentTime: 0,
      }));
    };
  }, [state.compositePreviewBuffer, state.compositePreviewCurrentTime]);

  // PROMPT_009: Pause the composite preview
  const pauseCompositePreview = useCallback(() => {
    if (compositePreviewSourceRef.current) {
      try {
        compositePreviewSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    if (compositePreviewIntervalRef.current) {
      clearInterval(compositePreviewIntervalRef.current);
    }

    // Keep current time where it is
    setState(prev => ({ ...prev, isPlayingCompositePreview: false }));
  }, []);

  // PROMPT_009: Stop the composite preview and reset to beginning
  const stopCompositePreview = useCallback(() => {
    if (compositePreviewSourceRef.current) {
      try {
        compositePreviewSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    if (compositePreviewIntervalRef.current) {
      clearInterval(compositePreviewIntervalRef.current);
    }

    setState(prev => ({
      ...prev,
      isPlayingCompositePreview: false,
      compositePreviewCurrentTime: 0,
    }));
  }, []);

  // PROMPT_009: Seek to a specific position in the composite preview
  const seekCompositePreview = useCallback((time: number) => {
    const wasPlaying = state.isPlayingCompositePreview;

    // Stop current playback
    if (compositePreviewSourceRef.current) {
      try {
        compositePreviewSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }

    if (compositePreviewIntervalRef.current) {
      clearInterval(compositePreviewIntervalRef.current);
    }

    // Update time
    setState(prev => ({ ...prev, compositePreviewCurrentTime: time, isPlayingCompositePreview: false }));

    // Resume playback if it was playing
    if (wasPlaying && state.compositePreviewBuffer) {
      setTimeout(() => {
        playCompositePreview();
      }, 50);
    }
  }, [state.isPlayingCompositePreview, state.compositePreviewBuffer, playCompositePreview]);

  // Cleanup on unmount - comprehensive cleanup of all resources
  useEffect(() => {
    return () => {
      destroyWaveSurfer();

      // Clean up intervals
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
      }
      if (compositePreviewIntervalRef.current) {
        clearInterval(compositePreviewIntervalRef.current);
        compositePreviewIntervalRef.current = null;
      }

      // Clean up timeouts
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }

      // Clean up audio elements
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.src = '';
        introAudioRef.current = null;
      }
      if (outroAudioRef.current) {
        outroAudioRef.current.pause();
        outroAudioRef.current.src = '';
        outroAudioRef.current = null;
      }

      // Clean up composite preview source node
      if (compositePreviewSourceRef.current) {
        try {
          compositePreviewSourceRef.current.stop();
        } catch {
          // May already be stopped
        }
        compositePreviewSourceRef.current = null;
      }

      // Clean up AudioContext
      if (compositePreviewContextRef.current) {
        compositePreviewContextRef.current.close().catch(() => {});
        compositePreviewContextRef.current = null;
      }
    };
  }, [destroyWaveSurfer]);

  // Real-time enhancement preview - update when settings change (PROMPT_008)
  useEffect(() => {
    // Skip if WaveSurfer isn't ready or nodes aren't created
    if (!state.isWaveformReady || !enhancementNodesRef.current) return;

    const { enhancementSettings } = state;

    // Update node parameters
    updateEnhancementNodes(enhancementSettings);

    // Apply or remove filters based on enabled state
    applyEnhancementFilters(enhancementSettings.enabled);
  }, [
    state.isWaveformReady,
    state.enhancementSettings,
    updateEnhancementNodes,
    applyEnhancementFilters,
  ]);

  const actions: SermonEditorActions = {
    loadFile,
    clearFile,
    // Segment actions (PROMPT_009)
    addSegment,
    removeSegment,
    selectSegment,
    reorderSegments,
    setSegmentJoinMode,
    moveSegmentUp,
    moveSegmentDown,
    play,
    pause,
    stop,
    playPreviewWithMusic,
    seek,
    setVolume,
    setPlaybackRate,
    setTrimStart,
    setTrimEnd,
    resetTrim,
    applyTrim,
    detectSilences: detectSilencesAction,
    setSilenceOptions,
    toggleSilenceRemoval,
    previewSilence,
    setMusicSettings, // PROMPT_004
    setMetadata, // PROMPT_005
    setCoverImage, // PROMPT_005
    setEnhancementSettings, // PROMPT_008
    undo,
    exportMp3,
    // Composite preview actions (PROMPT_009)
    generateCompositePreview,
    playCompositePreview,
    pauseCompositePreview,
    stopCompositePreview,
    seekCompositePreview,
    // Draft actions
    saveDraft,
    loadDraft: loadDraftAction,
    clearDraft,
    checkForDraft,
    initWaveSurfer,
    destroyWaveSurfer,
  };

  return [state, actions];
}
