/**
 * Lesson Output Validation Tests
 * Tests that verify the AI-generated lesson structure
 */

import { describe, it, expect } from 'vitest';
import type { GeneratedLesson } from '@/types/childrenPublicationState';

describe('Lesson Output Validation', () => {
  /**
   * Helper function to validate lesson structure
   */
  function validateLesson(data: unknown): data is GeneratedLesson {
    if (!data || typeof data !== 'object') return false;

    const lesson = data as Record<string, unknown>;

    // Validate required fields
    if (typeof lesson.activityName !== 'string' || !lesson.activityName.trim()) return false;
    if (!Array.isArray(lesson.materials) || lesson.materials.length === 0) return false;

    // Validate sequence array (must be exactly 3 phases)
    if (!Array.isArray(lesson.sequence) || lesson.sequence.length !== 3) return false;

    // Validate each phase
    const phases = ['movimiento', 'expresion_conversacion', 'reflexion_metaprendizaje'];
    for (let i = 0; i < lesson.sequence.length; i++) {
      const phase = (lesson.sequence as unknown[])[i] as Record<string, unknown>;
      if (typeof phase.phase !== 'string' || !phases.includes(phase.phase)) return false;
      if (typeof phase.title !== 'string' || !phase.title.trim()) return false;
      if (typeof phase.description !== 'string' || !phase.description.trim()) return false;
      if (typeof phase.minutes !== 'number' || phase.minutes <= 0) return false;
    }

    // Validate adaptations
    if (!lesson.adaptations || typeof lesson.adaptations !== 'object') return false;
    const adaptations = lesson.adaptations as Record<string, unknown>;
    if (
      typeof adaptations.small !== 'string' ||
      typeof adaptations.medium !== 'string' ||
      typeof adaptations.large !== 'string' ||
      typeof adaptations.mixed !== 'string'
    ) {
      return false;
    }

    // Validate volunteer plan
    if (!lesson.volunteerPlan || typeof lesson.volunteerPlan !== 'object') return false;
    const plan = lesson.volunteerPlan as Record<string, unknown>;
    if (typeof plan.leader !== 'string' || typeof plan.support !== 'string') return false;

    // Validate estimated total minutes
    if (typeof lesson.estimatedTotalMinutes !== 'number' || lesson.estimatedTotalMinutes <= 0) {
      return false;
    }

    return true;
  }

  it('should validate a correct lesson structure', () => {
    const validLesson: GeneratedLesson = {
      activityName: 'Parabola del Sembrador',
      materials: ['semillas', 'tierra', 'macetas', 'regadera'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Sembradores en movimiento',
          description: 'Los ninos se desplazan por el espacio como si sembraran semillas',
          minutes: 8,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Plantamos en macetas',
          description:
            'Cada nino planta una semilla real en una maceta mientras comparten historias',
          minutes: 10,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Reflexion: La semilla crece',
          description:
            'Conversacion guiada sobre como la semilla representa nuestra fe y paciencia',
          minutes: 8,
        },
      ],
      adaptations: {
        small: 'Grupos mas pequenos comparten una maceta entre dos',
        medium: 'Cada nino tiene su propia maceta',
        large: 'Dividir en dos grupos por rotacion',
        mixed: 'Los mayores ayudan a los pequenos a plantar',
      },
      volunteerPlan: {
        leader: 'Guia la actividad, explica los pasos, maneja tiempos',
        support: 'Ayuda a preparar materiales, asiste ninos con dificultades, limpia',
      },
      estimatedTotalMinutes: 26,
    };

    expect(validateLesson(validLesson)).toBe(true);
  });

  it('should reject lesson with missing activityName', () => {
    const invalidLesson = {
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 15,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with empty materials array', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: [],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 15,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with incorrect number of phases', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 10,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with invalid phase name', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'invalid_phase',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 15,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with zero or negative minutes in phase', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 0,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 10,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with missing adaptations', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: 15,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with missing volunteer plan', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      estimatedTotalMinutes: 15,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });

  it('should reject lesson with invalid estimatedTotalMinutes', () => {
    const invalidLesson = {
      activityName: 'Activity',
      materials: ['material'],
      sequence: [
        {
          phase: 'movimiento',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'expresion_conversacion',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
        {
          phase: 'reflexion_metaprendizaje',
          title: 'Title',
          description: 'Description',
          minutes: 5,
        },
      ],
      adaptations: { small: '', medium: '', large: '', mixed: '' },
      volunteerPlan: { leader: '', support: '' },
      estimatedTotalMinutes: -5,
    };

    expect(validateLesson(invalidLesson)).toBe(false);
  });
});
