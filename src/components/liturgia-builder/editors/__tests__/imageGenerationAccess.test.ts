import { describe, expect, it } from 'vitest';
import {
  IMAGE_GENERATION_DENIED_REASON,
  IMAGE_GENERATION_PENDING_REASON,
  IMAGE_GENERATION_PERMISSION,
  resolveImageGenerationAccess,
} from '../imageGenerationAccess.ts';

describe('resolveImageGenerationAccess', () => {
  it('requires the same permission the Edge Function enforces (liturgy_builder / write)', () => {
    expect(IMAGE_GENERATION_PERMISSION).toEqual({ resource: 'liturgy_builder', action: 'write' });
  });

  it('keeps controls disabled while permissions load', () => {
    expect(resolveImageGenerationAccess({ loading: true, canWrite: true })).toEqual({
      allowed: false,
      pending: true,
      reason: IMAGE_GENERATION_PENDING_REASON,
    });
  });

  it('disables controls with an explanation when the user lacks write permission', () => {
    expect(resolveImageGenerationAccess({ loading: false, canWrite: false })).toEqual({
      allowed: false,
      pending: false,
      reason: IMAGE_GENERATION_DENIED_REASON,
    });
  });

  it('enables controls for users with write permission', () => {
    expect(resolveImageGenerationAccess({ loading: false, canWrite: true })).toEqual({ allowed: true, pending: false, reason: null });
  });
});
