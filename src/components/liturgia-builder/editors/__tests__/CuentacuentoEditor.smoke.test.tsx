/**
 * Smoke test for CuentacuentoEditor.
 *
 * Renders the component far enough to execute every top-level hook call,
 * including the `useRef` calls near the top of the component body
 * (characterSheetOptionsRef, sceneImageOptionsRef, currentStepRef, etc.).
 *
 * If `useRef` is removed from the named React import in
 * CuentacuentoEditor.tsx, evaluating the module still succeeds but the
 * first render throws `ReferenceError: useRef is not defined` — this test
 * catches that regression.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CuentacuentoEditor from '../CuentacuentoEditor';
import type { LiturgyContext } from '@/types/shared/liturgy';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useCuentacuentosDraft', () => ({
  useCuentacuentosDraft: () => ({
    hasDraft: false,
    draft: null,
    lastSavedAt: null,
    isLoading: false,
    isSaving: false,
    saveDraft: vi.fn(),
    getDraftIdentity: () => ({ storyId: null, epoch: 0 }),
    getDraftWriteIdentity: () => ({ storyId: null, epoch: 0, revision: 0, contentRevision: 0 }),
    // E/A9a — la época viva se estampa en la intención de auto-arranque, que se
    // evalúa en un efecto de render: el mock debe traerla.
    activeIdentity: { storyId: null, epoch: 0 },
    flushPendingDraftWrites: vi.fn().mockResolvedValue(undefined),
    enqueueAuthoritativeWrite: vi.fn(),
    bumpContentRevision: vi.fn(() => 1),
    getContentRevision: () => 0,
    confirmFinalizationDelete: vi.fn().mockResolvedValue(1),
    enqueueDraftWrite: vi.fn(),
    loadDraft: vi.fn().mockResolvedValue(null),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    deleteDraftRecord: vi.fn().mockResolvedValue(true),
    showRecoveryPrompt: false,
    acceptRecovery: vi.fn(),
    declineRecovery: vi.fn(),
    bumpDraftEpoch: vi.fn(),
    setActiveDraftStoryId: vi.fn(),
    bumpDraftStoryRevision: vi.fn(),
    enqueueGeneratedSnapshot: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useStoryImagePipeline', () => ({
  useStoryImagePipeline: () => ({
    items: [],
    isRunning: false,
    isSaving: false,
    isBusy: () => false,
    doneCount: 0,
    errorCount: 0,
    saveFailedCount: 0,
    totalCount: 0,
    runAll: vi.fn().mockResolvedValue(false),
    runItems: vi.fn().mockResolvedValue('token'),
    retryFailed: vi.fn().mockResolvedValue(undefined),
    retrySaves: vi.fn().mockResolvedValue(undefined),
    retryItem: vi.fn().mockResolvedValue(undefined),
    invalidateSaveRetries: vi.fn(() => 0),
    cancel: vi.fn(),
    statusOf: vi.fn(() => undefined),
    errorOf: vi.fn(() => undefined),
    markResolved: vi.fn(),
    getRunToken: () => null,
  }),
}));

const baseContext: LiturgyContext = {
  id: 'test-liturgy',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

describe('CuentacuentoEditor smoke test', () => {
  it('renders without throwing and executes top-level useRef calls', () => {
    // Render is what actually executes the component body — including the
    // 20+ useRef calls at ~line 605. Missing `useRef` import surfaces here
    // as ReferenceError, not during module evaluation.
    expect(() => {
      render(
        <CuentacuentoEditor
          context={baseContext}
          onStoryCreated={vi.fn()}
        />,
      );
    }).not.toThrow();
  });
});
