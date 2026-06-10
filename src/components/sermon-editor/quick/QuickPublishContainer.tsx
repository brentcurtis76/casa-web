/**
 * QuickPublishContainer — top-level orchestrator for Publicación Rápida.
 *
 * Renders a stepper header and the step-specific component for each phase
 * of the state machine in useQuickPublish.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { AudioUploader } from '@/components/sermon-editor/AudioUploader';
import { useQuickPublish } from '@/hooks/useQuickPublish';
import { QuickStepLiturgy } from './QuickStepLiturgy';
import { QuickProcessingPanel } from './QuickProcessingPanel';
import { QuickStepReview } from './QuickStepReview';
import { QuickPublishProgress } from './QuickPublishProgress';

const STEPS: Array<{ key: 'upload' | 'liturgy' | 'review' | 'publish'; label: string }> = [
  { key: 'upload', label: 'Audio' },
  { key: 'liturgy', label: 'Liturgia' },
  { key: 'review', label: 'Revisar' },
  { key: 'publish', label: 'Publicar' },
];

function stepNumber(step: ReturnType<typeof useQuickPublish>['state']['step']): number {
  switch (step) {
    case 'upload':
      return 0;
    case 'liturgy':
      return 1;
    case 'processing':
    case 'review':
      return 2;
    case 'publishing':
    case 'done':
      return 3;
  }
}

export function QuickPublishContainer() {
  const {
    state,
    handleFileSelected,
    clearAudio,
    selectLiturgy,
    continueWithoutLiturgy,
    updateMetadata,
    confirmLiturgyStep,
    changeLiturgy,
    generateCover,
    setCustomCover,
    publishNow,
    reset,
  } = useQuickPublish();

  const activeIdx = stepNumber(state.step);

  return (
    <div className="space-y-6">
      <Stepper activeIdx={activeIdx} />

      {state.step === 'upload' && (
        <AudioUploader
          onFileSelected={handleFileSelected}
          fileInfo={state.fileInfo}
          isLoading={false}
          error={state.processing.error ?? null}
          onClear={clearAudio}
        />
      )}

      {state.step === 'liturgy' && (
        <QuickStepLiturgy
          liturgies={state.liturgies}
          matched={state.matchedLiturgy}
          loading={state.loadingLiturgies}
          onSelect={selectLiturgy}
          onContinueWithoutLiturgy={continueWithoutLiturgy}
          onConfirm={confirmLiturgyStep}
        />
      )}

      {state.step === 'processing' && (
        <QuickProcessingPanel
          processing={state.processing}
          cover={state.cover}
          musicWarning={state.musicWarning}
        />
      )}

      {state.step === 'review' && (
        <QuickStepReview
          metadata={state.metadata}
          processing={state.processing}
          processedMp3={state.processedMp3}
          durationSeconds={state.durationSeconds}
          cover={state.cover}
          publish={state.publish}
          validation={state.validation}
          musicWarning={state.musicWarning}
          liturgies={state.liturgies}
          onUpdateMetadata={updateMetadata}
          onChangeLiturgy={changeLiturgy}
          onRegenerateCover={generateCover}
          onUploadCover={setCustomCover}
          onPublish={publishNow}
        />
      )}

      {(state.step === 'publishing' || state.step === 'done') && (
        <QuickPublishProgress
          stage={state.publish.stage}
          feedUrl={state.feedUrl}
          done={state.step === 'done'}
          onPublishAnother={reset}
        />
      )}
    </div>
  );
}

function Stepper({ activeIdx }: { activeIdx: number }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-2 text-sm"
      aria-label="Pasos de publicación"
    >
      {STEPS.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={
                'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ' +
                (isActive
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : isDone
                    ? 'border-amber-600 bg-amber-50 text-amber-700'
                    : 'border-muted-foreground/40 text-muted-foreground')
              }
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={
                isActive
                  ? 'font-medium'
                  : isDone
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground'
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="hidden sm:inline-block w-6 border-t border-muted-foreground/30"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
