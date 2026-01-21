/**
 * Audio enhancement utilities using Web Audio API
 * Provides normalization, EQ, compression, and gain control
 */

export interface EQSettings {
  bass: number;      // -12 to +12 dB (centered at 250Hz)
  mid: number;       // -12 to +12 dB (centered at 1000Hz)
  treble: number;    // -12 to +12 dB (centered at 4000Hz)
}

export interface CompressionSettings {
  threshold: number;  // -100 to 0 dB (when compression starts)
  ratio: number;      // 1 to 20 (compression ratio)
  attack: number;     // 0 to 1 second
  release: number;    // 0 to 1 second
  knee: number;       // 0 to 40 dB (soft knee)
}

export interface EnhancementSettings {
  enabled: boolean;
  gain: number;           // -12 to +12 dB
  normalize: boolean;     // Auto-normalize to target level
  normalizeTarget: number; // Target peak in dB (e.g., -1 dB)
  eq: EQSettings;
  compression: CompressionSettings;
  compressionEnabled: boolean;
}

export const DEFAULT_ENHANCEMENT_SETTINGS: EnhancementSettings = {
  enabled: false,
  gain: 0,
  normalize: false,
  normalizeTarget: -1, // -1 dB below full scale
  eq: {
    bass: 0,
    mid: 0,
    treble: 0,
  },
  compression: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
    knee: 30,
  },
  compressionEnabled: false,
};

// Compression presets for common use cases
export const COMPRESSION_PRESETS = {
  off: {
    threshold: 0,
    ratio: 1,
    attack: 0.003,
    release: 0.25,
    knee: 0,
  },
  subtle: {
    threshold: -20,
    ratio: 2,
    attack: 0.01,
    release: 0.2,
    knee: 20,
  },
  voice: {
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
    knee: 30,
  },
  podcast: {
    threshold: -18,
    ratio: 6,
    attack: 0.002,
    release: 0.15,
    knee: 20,
  },
  aggressive: {
    threshold: -30,
    ratio: 8,
    attack: 0.001,
    release: 0.1,
    knee: 10,
  },
} as const;

export type CompressionPreset = keyof typeof COMPRESSION_PRESETS;

/**
 * Analyze audio buffer to find peak level
 */
export function analyzePeakLevel(audioBuffer: AudioBuffer): number {
  let maxPeak = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const absValue = Math.abs(channelData[i]);
      if (absValue > maxPeak) {
        maxPeak = absValue;
      }
    }
  }

  // Convert to dB
  return maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
}

/**
 * Calculate gain needed to normalize to target level
 */
export function calculateNormalizationGain(
  audioBuffer: AudioBuffer,
  targetDb: number
): number {
  const currentPeak = analyzePeakLevel(audioBuffer);
  if (currentPeak === -Infinity) return 0;

  const gainDb = targetDb - currentPeak;
  return gainDb;
}

/**
 * Convert dB to linear gain
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to dB
 */
export function linearToDb(linear: number): number {
  return 20 * Math.log10(linear);
}

/**
 * Apply enhancement settings to an AudioBuffer
 * Returns a new enhanced AudioBuffer
 */
export async function applyEnhancements(
  audioBuffer: AudioBuffer,
  settings: EnhancementSettings
): Promise<AudioBuffer> {
  if (!settings.enabled) {
    return audioBuffer;
  }

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    length,
    sampleRate
  );

  // Create source from input buffer
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Build the audio processing chain
  let currentNode: AudioNode = source;

  // 1. Input Gain (before other processing)
  const inputGain = offlineContext.createGain();
  let totalGainDb = settings.gain;

  // Add normalization gain if enabled
  if (settings.normalize) {
    const normGain = calculateNormalizationGain(audioBuffer, settings.normalizeTarget);
    totalGainDb += normGain;
  }

  inputGain.gain.value = dbToLinear(totalGainDb);
  currentNode.connect(inputGain);
  currentNode = inputGain;

  // 2. EQ - Three band equalizer
  // Bass (low shelf at 250Hz)
  if (settings.eq.bass !== 0) {
    const bassFilter = offlineContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 250;
    bassFilter.gain.value = settings.eq.bass;
    currentNode.connect(bassFilter);
    currentNode = bassFilter;
  }

  // Mid (peaking at 1000Hz)
  if (settings.eq.mid !== 0) {
    const midFilter = offlineContext.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1; // Bandwidth
    midFilter.gain.value = settings.eq.mid;
    currentNode.connect(midFilter);
    currentNode = midFilter;
  }

  // Treble (high shelf at 4000Hz)
  if (settings.eq.treble !== 0) {
    const trebleFilter = offlineContext.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 4000;
    trebleFilter.gain.value = settings.eq.treble;
    currentNode.connect(trebleFilter);
    currentNode = trebleFilter;
  }

  // 3. Compression
  if (settings.compressionEnabled && settings.compression.ratio > 1) {
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = settings.compression.threshold;
    compressor.ratio.value = settings.compression.ratio;
    compressor.attack.value = settings.compression.attack;
    compressor.release.value = settings.compression.release;
    compressor.knee.value = settings.compression.knee;
    currentNode.connect(compressor);
    currentNode = compressor;
  }

  // Connect to destination
  currentNode.connect(offlineContext.destination);

  // Start playback and render
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return renderedBuffer;
}

/**
 * Preview enhancement settings in real-time
 * Returns cleanup function
 */
export function createEnhancementPreview(
  audioContext: AudioContext,
  settings: EnhancementSettings
): {
  inputNode: GainNode;
  outputNode: AudioNode;
  updateSettings: (newSettings: EnhancementSettings) => void;
  cleanup: () => void;
} {
  // Create nodes
  const inputGain = audioContext.createGain();
  const bassFilter = audioContext.createBiquadFilter();
  const midFilter = audioContext.createBiquadFilter();
  const trebleFilter = audioContext.createBiquadFilter();
  const compressor = audioContext.createDynamicsCompressor();
  const outputGain = audioContext.createGain();

  // Configure EQ filters
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 250;

  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;

  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 4000;

  // Build chain
  inputGain.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(compressor);
  compressor.connect(outputGain);

  // Apply initial settings
  const updateSettings = (s: EnhancementSettings) => {
    inputGain.gain.value = dbToLinear(s.gain);
    bassFilter.gain.value = s.eq.bass;
    midFilter.gain.value = s.eq.mid;
    trebleFilter.gain.value = s.eq.treble;

    if (s.compressionEnabled) {
      compressor.threshold.value = s.compression.threshold;
      compressor.ratio.value = s.compression.ratio;
      compressor.attack.value = s.compression.attack;
      compressor.release.value = s.compression.release;
      compressor.knee.value = s.compression.knee;
    } else {
      compressor.threshold.value = 0;
      compressor.ratio.value = 1;
    }
  };

  updateSettings(settings);

  return {
    inputNode: inputGain,
    outputNode: outputGain,
    updateSettings,
    cleanup: () => {
      inputGain.disconnect();
      bassFilter.disconnect();
      midFilter.disconnect();
      trebleFilter.disconnect();
      compressor.disconnect();
      outputGain.disconnect();
    },
  };
}
