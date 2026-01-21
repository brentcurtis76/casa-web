/**
 * Main container component for the Sermon Audio Editor
 * Orchestrates all sub-components and state management
 * Updated for PROMPT_004: Added intro/outro music integration
 * Updated for PROMPT_005: Added metadata and cover art sections
 * Updated for PROMPT_007: Added draft save/restore functionality
 * Updated for PROMPT_009: Added multi-segment audio support
 */
import React, { useEffect, useState } from 'react';
import { Undo2, Music2, Tag, Image, Share2, Save, Clock, Trash2, Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSermonEditor } from '@/hooks/useSermonEditor';
import { AudioUploader } from './AudioUploader';
import { SegmentManager } from './SegmentManager'; // PROMPT_009
import { WaveformDisplay } from './WaveformDisplay';
import { TrimControls } from './TrimControls';
import { PlaybackControls } from './PlaybackControls';
import { ExportButton } from './ExportButton';
import { SilenceListPanel } from './SilenceListPanel';
import { SilenceSettings } from './SilenceSettings';
import { MusicSelector } from './MusicSelector'; // PROMPT_004
import { MetadataForm } from './MetadataForm'; // PROMPT_005
import { CoverArtGenerator } from './CoverArtGenerator'; // PROMPT_005
import { AudioEnhancer } from './AudioEnhancer'; // PROMPT_008
import { DistributionPanel } from './DistributionPanel'; // PROMPT_006
import { validateForSpotify } from '@/lib/sermon-editor/spotifyValidator'; // PROMPT_006
import { calculateRemovedDurationInRange } from '@/lib/sermon-editor/silenceDetector';
import { formatDurationLong } from '@/lib/sermon-editor/audioProcessor';
import { formatSavedTime } from '@/lib/sermon-editor/draftStorage'; // PROMPT_007
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

export function SermonEditorContainer() {
  const [state, actions] = useSermonEditor();
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ savedAt: string; title: string; speaker: string } | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    const { exists, info } = actions.checkForDraft();
    if (exists && info) {
      setDraftInfo(info);
      setShowDraftDialog(true);
    }
  }, [actions.checkForDraft]);

  // Handle restore draft
  const handleRestoreDraft = async () => {
    setShowDraftDialog(false);
    await actions.loadDraft();
  };

  // Handle discard draft
  const handleDiscardDraft = async () => {
    setShowDraftDialog(false);
    await actions.clearDraft();
  };

  const hasAudio = state.audioBuffer !== null && !state.isLoading;
  // Calculate removed duration only for silences within trim range (clamped to boundaries)
  const removedDuration = calculateRemovedDurationInRange(
    state.silences,
    state.trimStart,
    state.trimEnd
  );

  // PROMPT_004: Calculate final duration including intro/outro
  // PROMPT_004b Fix 3: Subtract crossfade durations for accurate display
  const CROSSFADE_DURATION = 0.5; // Must match audioProcessor.ts
  const sermonDuration = state.trimEnd - state.trimStart - removedDuration;
  const { musicSettings } = state;
  const introDuration = musicSettings.includeIntro && musicSettings.introTrack?.duration_seconds
    ? musicSettings.introTrack.duration_seconds
    : 0;
  const outroDuration = musicSettings.includeOutro && musicSettings.outroTrack?.duration_seconds
    ? musicSettings.outroTrack.duration_seconds
    : 0;

  // Calculate crossfade overlaps (same formula as in audioProcessor.ts)
  const introOverlap = introDuration > 0 ? Math.min(CROSSFADE_DURATION, introDuration / 2, sermonDuration / 2) : 0;
  const outroOverlap = outroDuration > 0 ? Math.min(CROSSFADE_DURATION, outroDuration / 2, sermonDuration / 2) : 0;
  const finalDuration = introDuration + sermonDuration + outroDuration - introOverlap - outroOverlap;

  // PROMPT_006: Calculate Spotify validation
  const spotifyValidation = validateForSpotify(
    state.exportedAudio,
    state.coverImage,
    state.metadata,
    finalDuration
  );

  // PROMPT_009: Get active segment info for display
  const activeSegmentIndex = state.segments.findIndex(s => s.id === state.activeSegmentId);
  const hasMultipleSegments = state.segments.length > 1;
  const segmentLabel = hasMultipleSegments && activeSegmentIndex >= 0
    ? ` (Segmento ${activeSegmentIndex + 1})`
    : '';

  return (
    <div className="space-y-6">
      {/* Draft Restore Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrador encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              {draftInfo && (
                <span className="block space-y-1">
                  <span className="block">
                    <strong>{draftInfo.title || 'Sin título'}</strong>
                    {draftInfo.speaker && ` - ${draftInfo.speaker}`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Guardado {formatSavedTime(draftInfo.savedAt)}
                  </span>
                </span>
              )}
              <span className="block mt-2">
                ¿Deseas restaurar el borrador guardado o empezar de nuevo?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>
              <Trash2 className="h-4 w-4 mr-2" />
              Descartar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>
              <Clock className="h-4 w-4 mr-2" />
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header with Save and Undo buttons */}
      {hasAudio && (
        <div className="flex justify-between items-center">
          {/* Last saved indicator */}
          <div className="text-sm text-muted-foreground">
            {state.lastSavedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Guardado {formatSavedTime(state.lastSavedAt)}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Save Draft button */}
            <Button
              variant="outline"
              size="sm"
              onClick={actions.saveDraft}
              disabled={state.isSavingDraft || state.isExporting}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {state.isSavingDraft ? 'Guardando...' : 'Guardar borrador'}
            </Button>

            {/* Undo button */}
            {state.canUndo && (
              <Button
                variant="outline"
                size="sm"
                onClick={actions.undo}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" />
                Deshacer
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Audio Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Cargar Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <AudioUploader
            onFileSelected={actions.loadFile}
            fileInfo={state.fileInfo}
            isLoading={state.isLoading}
            error={state.error}
            onClear={actions.clearFile}
          />
        </CardContent>
      </Card>

      {/* Segment Manager (PROMPT_009) - appears when there's at least one segment */}
      {state.segments.length > 0 && (
        <SegmentManager
          segments={state.segments}
          activeSegmentId={state.activeSegmentId}
          onSelectSegment={actions.selectSegment}
          onAddSegment={actions.addSegment}
          onRemoveSegment={actions.removeSegment}
          onMoveUp={actions.moveSegmentUp}
          onMoveDown={actions.moveSegmentDown}
          onSetJoinMode={actions.setSegmentJoinMode}
          disabled={state.isExporting || state.isLoading}
          maxSegments={4}
          // Intro/outro visualization
          introTrack={musicSettings.introTrack}
          outroTrack={musicSettings.outroTrack}
          includeIntro={musicSettings.includeIntro}
          includeOutro={musicSettings.includeOutro}
          // Composite preview (PROMPT_009)
          isGeneratingPreview={state.isGeneratingCompositePreview}
          hasPreviewBuffer={state.compositePreviewBuffer !== null}
          isPlayingPreview={state.isPlayingCompositePreview}
          previewCurrentTime={state.compositePreviewCurrentTime}
          previewDuration={state.compositePreviewDuration}
          onGeneratePreview={actions.generateCompositePreview}
          onPlayPreview={actions.playCompositePreview}
          onPausePreview={actions.pauseCompositePreview}
          onStopPreview={actions.stopCompositePreview}
          onSeekPreview={actions.seekCompositePreview}
        />
      )}

      {/* Waveform & Playback Section */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Reproducir y Editar{segmentLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Waveform visualization with silence regions and music timeline */}
            <WaveformDisplay
              onInit={actions.initWaveSurfer}
              onDestroy={actions.destroyWaveSurfer}
              currentTime={state.currentTime}
              duration={state.duration}
              trimStart={state.trimStart}
              trimEnd={state.trimEnd}
              isReady={state.isWaveformReady}
              isLoading={state.audioBuffer !== null && !state.isWaveformReady}
              wavesurfer={state.wavesurfer}
              silences={state.silences}
              onSilenceClick={actions.previewSilence}
              regionsPlugin={state.regionsPlugin}
              // PROMPT_004: Music track props
              introTrack={musicSettings.introTrack}
              outroTrack={musicSettings.outroTrack}
              includeIntro={musicSettings.includeIntro}
              includeOutro={musicSettings.includeOutro}
            />

            {/* Playback controls */}
            <PlaybackControls
              isPlaying={state.isPlaying}
              currentTime={state.isPreviewingWithMusic ? state.previewCurrentTime : state.currentTime}
              duration={state.isPreviewingWithMusic ? finalDuration : state.duration}
              volume={state.volume}
              playbackRate={state.playbackRate}
              onPlay={
                // Use music preview when intro or outro is enabled
                (musicSettings.includeIntro && musicSettings.introTrack) ||
                (musicSettings.includeOutro && musicSettings.outroTrack)
                  ? actions.playPreviewWithMusic
                  : actions.play
              }
              onPause={actions.pause}
              onStop={actions.stop}
              onVolumeChange={actions.setVolume}
              onPlaybackRateChange={actions.setPlaybackRate}
              disabled={!hasAudio}
            />

            {/* Trim controls */}
            <TrimControls
              duration={state.duration}
              trimStart={state.trimStart}
              trimEnd={state.trimEnd}
              onTrimStartChange={actions.setTrimStart}
              onTrimEndChange={actions.setTrimEnd}
              onReset={actions.resetTrim}
              onApplyTrim={actions.applyTrim}
              isApplying={state.isLoading}
              disabled={!hasAudio}
            />
          </CardContent>
        </Card>
      )}

      {/* Audio Enhancement Section (PROMPT_008) */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              Mejoras de Audio{segmentLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AudioEnhancer
              settings={state.enhancementSettings}
              onSettingsChange={actions.setEnhancementSettings}
              disabled={state.isExporting}
            />
          </CardContent>
        </Card>
      )}

      {/* Silence Detection Section */}
      {hasAudio && (
        <div className="space-y-4">
          <SilenceListPanel
            silences={state.silences}
            onPreview={actions.previewSilence}
            onToggleRemoval={actions.toggleSilenceRemoval}
            onDetect={actions.detectSilences}
            isDetecting={state.isDetectingSilence}
            disabled={!hasAudio}
          />

          {/* Detection settings (collapsible) */}
          <Card>
            <SilenceSettings
              options={state.silenceOptions}
              onOptionsChange={actions.setSilenceOptions}
              onRedetect={actions.detectSilences}
              disabled={!hasAudio || state.isDetectingSilence}
            />
          </Card>
        </div>
      )}

      {/* Music Section (PROMPT_004) */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              Música
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MusicSelector
              settings={musicSettings}
              onSettingsChange={actions.setMusicSettings}
              disabled={state.isExporting}
            />
          </CardContent>
        </Card>
      )}

      {/* Metadata Section (PROMPT_005) */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Metadatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Metadata Form */}
              <div>
                <MetadataForm
                  metadata={state.metadata}
                  onMetadataChange={actions.setMetadata}
                  disabled={state.isExporting}
                />
              </div>

              {/* Cover Art Generator */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Portada</span>
                </div>
                <CoverArtGenerator
                  metadata={state.metadata}
                  coverImage={state.coverImage}
                  onCoverChange={actions.setCoverImage}
                  disabled={state.isExporting}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Section */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Exportar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExportButton
              onExport={() => actions.exportMp3(state.fileInfo?.name)}
              isExporting={state.isExporting}
              exportProgress={state.exportProgress}
              trimStart={state.trimStart}
              trimEnd={state.trimEnd}
              disabled={!hasAudio || state.isExporting}
              hasMetadata={Boolean(state.metadata.title && state.metadata.speaker)}
              hasCoverArt={Boolean(state.coverImage)}
              hasMusic={Boolean(
                (musicSettings.includeIntro && musicSettings.introTrack) ||
                (musicSettings.includeOutro && musicSettings.outroTrack)
              )}
              hasEnhancements={state.enhancementSettings.enabled}
            />

            {/* Duration summary with music breakdown (PROMPT_004) */}
            <div className="space-y-2 border-t pt-3">
              {/* Original duration */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Duración original:</span>
                <span className="font-mono">{formatDurationLong(state.duration)}</span>
              </div>

              {/* Trim info */}
              {(state.trimStart > 0 || state.trimEnd < state.duration) && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Recortes:</span>
                  <span className="font-mono text-amber-600">
                    -{formatDurationLong(state.duration - (state.trimEnd - state.trimStart))}
                  </span>
                </div>
              )}

              {/* Removed silences */}
              {removedDuration > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Silencios eliminados:</span>
                  <span className="font-mono text-amber-600">
                    -{formatDurationLong(removedDuration)}
                  </span>
                </div>
              )}

              {/* Music additions */}
              {(introDuration > 0 || outroDuration > 0) && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Música:</span>
                  <span className="font-mono text-amber-600">
                    +{formatDurationLong(introDuration + outroDuration)}
                    {introDuration > 0 && outroDuration > 0 && (
                      <span className="text-xs ml-1">
                        (intro {introDuration.toFixed(1)}s + cierre {outroDuration.toFixed(1)}s)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Final duration */}
              <div className="flex items-center justify-between text-sm font-medium border-t pt-2">
                <span>Duración final:</span>
                <span className="font-mono text-lg">{formatDurationLong(finalDuration)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Section (PROMPT_006) */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Distribucion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionPanel
              audioBlob={state.exportedAudio}
              coverImage={state.coverImage}
              metadata={state.metadata}
              validation={spotifyValidation}
              disabled={state.isExporting}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
