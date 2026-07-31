/**
 * PC-UI — el aviso de degradación de la INVESTIGACIÓN en el editor real.
 *
 * Criterios T-U.3 a T-U.8 y T-U.11. La degradación que PC/PD volvieron
 * observable por API se vuelve observable POR EL USUARIO: en éxito, en vista
 * previa y también en las respuestas de error, porque la investigación falló
 * ANTES del fallo y sigue siendo cierta.
 *
 * BARRA DE INTEGRACIÓN (G10). El editor es el de PRODUCCIÓN y con él corren de
 * verdad `useCuentacuentosDraft`, `imageFeedback` (parser y costura de
 * `InvokeError`), las factories del pipeline y `use-toast`. Lo único simulado es
 * el BORDE EXTERNO: el cliente de Supabase (auth, tablas, storage e invocación
 * de funciones pagas) vía `pbBoundary`, más `fetch` del navegador. En
 * particular, `extractInvokeError` —privado del editor— se ejercita con
 * `FunctionsHttpError` cuyo `context` es un `Response` REAL, así que el
 * `ctx.clone().json()` defensivo corre tal cual en producción.
 *
 * Ningún texto de este archivo está inventado: toda la copy del servidor sale
 * de `pcuiWarningFixtures`, capturada de `phase/pb-storage-edge`@`10d1190`.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent, cleanup, within } from '@testing-library/react';
import type { LiturgyContext } from '@/types/shared/liturgy';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('@/lib/cuentacuentos/__tests__/pbBoundary');
  return { supabase: makeSupabaseMock() };
});

import { ctl, invokes, resetBoundary, type InvokeCall } from '@/lib/cuentacuentos/__tests__/pbBoundary';
import {
  researchWarning,
  storyWarning,
  serverWarningMessage,
  PROP_NOT_RECURRING_MESSAGE,
  typedErrorBody,
  genericErrorBody,
  imageRefErrorBody,
  storySuccessBody,
  previewBody,
  CLIENT_INPUT_INVALID_400_DETAIL,
  INVALID_IMAGE_REF_DETAIL,
  type EdgeScene,
} from '@/lib/cuentacuentos/__tests__/pcuiWarningFixtures';

// Producción — importada DESPUÉS del mock de borde.
import CuentacuentoEditor from '../CuentacuentoEditor';

// ---------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: 'lit-pcui',
  date: new Date('2026-05-10'),
  title: 'Liturgia PC-UI',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

const SCENES: EdgeScene[] = [
  { number: 1, text: 'Escena uno', visualDescription: 'una plaza' },
  { number: 2, text: 'Escena dos', visualDescription: 'un cerro' },
];

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/**
 * `FunctionsHttpError` tal como lo entrega supabase-js: el mensaje es fijo y el
 * status/detalle viven en `context`, que es un `Response` REAL. Ésa es la
 * entrada de `extractInvokeError`.
 */
function functionsHttpError(status: number, body: unknown) {
  const err = new Error('Edge Function returned a non-2xx status code') as Error & {
    context?: Response;
  };
  err.name = 'FunctionsHttpError';
  err.context = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return err;
}

/** Un error de borde cuyo cuerpo NO es JSON: el parser defensivo debe aguantar. */
function nonJsonHttpError(status: number) {
  const err = new Error('Edge Function returned a non-2xx status code') as Error & {
    context?: Response;
  };
  err.name = 'FunctionsHttpError';
  err.context = new Response('<html>gateway</html>', { status });
  return err;
}

/** Contesta `generate-story` con lo que se le indique; el resto queda por defecto. */
function answerStory(reply: { data?: unknown; error?: unknown }) {
  ctl.invokeHandler = async (call: InvokeCall) => {
    if (call.fn === 'generate-story') {
      return { data: reply.data ?? null, error: reply.error ?? null };
    }
    return ctl.invokeResponse;
  };
}

async function mountEditor() {
  const view = render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);
  const generar = await screen.findByRole(
    'button',
    { name: /Generar cuento con IA/i },
    { timeout: 10000 },
  );
  // El lugar es obligatorio para que `handleGenerate` llegue al invoke.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Santiago/i }));
    await yields(5);
  });
  expect(generar).toBeTruthy();
  return view;
}

async function clickGenerate() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Generar cuento con IA/i }));
    await yields(40);
  });
}

async function clickPreview() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Ver Prompt/i }));
    await yields(40);
  });
}

/** El aviso de avisos: `role="status"` es su identidad accesible (G4). */
function notice(): HTMLElement | null {
  return screen.queryByRole('status');
}

function noticeMessages(): string[] {
  const n = notice();
  if (!n) return [];
  return Array.from(n.querySelectorAll('li')).map((li) => li.textContent ?? '');
}

beforeEach(() => {
  resetBoundary();
  ctl.userId = 'user-pcui';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// T-U.3 — aviso en éxito
// ---------------------------------------------------------------------------

describe('T-U.3 — aviso en una generación exitosa', () => {
  it('renderiza el encabezado fijo, los roles de accesibilidad y los mensajes DEL SERVIDOR verbatim', async () => {
    const w1 = researchWarning('location', 'NO_API_KEY');
    const w2 = researchWarning('landmark', 'PROVIDER_HTTP_ERROR', { httpStatus: 503 });
    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [w1, w2] }) });

    await mountEditor();
    await clickGenerate();

    const n = await waitFor(() => {
      const el = notice();
      expect(el).not.toBeNull();
      return el!;
    }, { timeout: 10000 });

    expect(within(n).getByText('Avisos de la generación')).toBeTruthy();
    expect(n.getAttribute('aria-live')).toBe('polite');
    expect(noticeMessages()).toEqual([
      serverWarningMessage('location', 'NO_API_KEY'),
      serverWarningMessage('landmark', 'PROVIDER_HTTP_ERROR'),
    ]);
  });

  it('renderiza el mensaje FIJO de `story` / PROP_NOT_RECURRING tal cual', async () => {
    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [storyWarning()] }) });
    await mountEditor();
    await clickGenerate();

    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    expect(noticeMessages()).toEqual([PROP_NOT_RECURRING_MESSAGE]);
  });

  it('sin la clave `warnings` no hay aviso (el borde la omite cuando está vacía)', async () => {
    answerStory({ data: storySuccessBody({ scenes: SCENES }) });
    await mountEditor();
    await clickGenerate();

    // La generación SÍ ocurrió: el editor avanzó de paso.
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Generar cuento con IA/i })).toBeNull(),
      { timeout: 10000 },
    );
    expect(notice()).toBeNull();
  });

  it('`warnings: []` explícito tampoco fabrica un aviso', async () => {
    answerStory({ data: { ...storySuccessBody({ scenes: SCENES }), warnings: [] } });
    await mountEditor();
    await clickGenerate();
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Generar cuento con IA/i })).toBeNull(),
      { timeout: 10000 },
    );
    expect(notice()).toBeNull();
  });

  it('el control de descarte lo quita, con su etiqueta exacta', async () => {
    answerStory({
      data: storySuccessBody({ scenes: SCENES, warnings: [researchWarning('prop', 'EMPTY_RESPONSE')] }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    const ocultar = screen.getByRole('button', { name: 'Ocultar avisos de la generación' });
    await act(async () => {
      fireEvent.click(ocultar);
      await yields(5);
    });
    expect(notice()).toBeNull();
  });

  it('vive en el contenedor compartido, como HERMANO del paso actual y del aviso de fotos', async () => {
    answerStory({
      data: storySuccessBody({
        scenes: SCENES,
        warnings: [researchWarning('prop', 'EMPTY_RESPONSE')],
        skippedImages: [{ field: 'props[0].referenceImages[0]', code: 'NOT_IMAGE' }],
      }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    // El aviso de fotos (PFE, congelado) y el de avisos coexisten como hermanos.
    const skipped = screen.getByRole('button', { name: 'Ocultar aviso' }).closest('div.p-3');
    expect(skipped).not.toBeNull();
    expect(notice()!.parentElement).toBe(skipped!.parentElement);
    // …y el aviso va ANTES del contenido del paso.
    const container = notice()!.parentElement!;
    const kids = Array.from(container.children);
    const stepIdx = kids.findIndex((k) => k.textContent?.includes('Cuento de prueba'));
    expect(stepIdx).toBeGreaterThan(kids.indexOf(notice()!));
  });
});

// ---------------------------------------------------------------------------
// T-U.4 — reemplazo y ciclo de vida
// ---------------------------------------------------------------------------

describe('T-U.4 — cada intento COMPLETO reemplaza el conjunto entero', () => {
  it('aviso A → aviso B reemplaza (no acumula)', async () => {
    const a = researchWarning('location', 'NO_API_KEY');
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'El modelo devolvió una estructura inválida.',
        warnings: [a],
      })),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(noticeMessages()).toHaveLength(1), { timeout: 10000 });

    const b = researchWarning('prop', 'OUTPUT_BLOCKED');
    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [b] }) });
    await clickGenerate();

    await waitFor(
      () => expect(noticeMessages()).toEqual([serverWarningMessage('prop', 'OUTPUT_BLOCKED')]),
      { timeout: 10000 },
    );
    // El aviso viejo no sobrevivió.
    expect(noticeMessages()).not.toContain(serverWarningMessage('location', 'NO_API_KEY'));
  });

  it('aviso → respuesta SIN warnings limpia el aviso', async () => {
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'x',
        warnings: [researchWarning('landmark', 'MODEL_NOT_FOUND')],
      })),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    answerStory({ data: storySuccessBody({ scenes: SCENES }) });
    await clickGenerate();
    await waitFor(() => expect(notice()).toBeNull(), { timeout: 10000 });
  });

  it('aviso → error de RED (sin `context`) limpia el aviso y deja el error visible', async () => {
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'x',
        warnings: [researchWarning('landmark', 'MODEL_NOT_FOUND')],
      })),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    // Un `FunctionsFetchError`: no hay `context` que leer.
    answerStory({ error: new Error('Failed to send a request to the Edge Function') });
    await clickGenerate();

    await waitFor(() => expect(notice()).toBeNull(), { timeout: 10000 });
    expect(
      screen.getByText('Failed to send a request to the Edge Function'),
    ).toBeTruthy();
  });

  it('aviso → cuerpo NO-JSON limpia el aviso sin romperse', async () => {
    answerStory({
      error: functionsHttpError(500, genericErrorBody({
        error: 'Error generando cuento',
        warnings: [storyWarning()],
      })),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    answerStory({ error: nonJsonHttpError(502) });
    await clickGenerate();

    await waitFor(() => expect(notice()).toBeNull(), { timeout: 10000 });
    // Status-only: el formato existente se conserva.
    expect(screen.getByText('Error 502')).toBeTruthy();
  });

  it('"volver a generar" limpia el aviso: un cuento abandonado no lo arrastra', async () => {
    answerStory({
      data: storySuccessBody({ scenes: SCENES, warnings: [researchWarning('prop', 'EMPTY_RESPONSE')] }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    const regenerar = await screen.findByRole('button', { name: /^Regenerar$/i }, { timeout: 10000 });
    await act(async () => {
      fireEvent.click(regenerar);
      await yields(20);
    });
    expect(notice()).toBeNull();
  });

  it('un borrado exitoso limpia el aviso', async () => {
    answerStory({
      data: storySuccessBody({ scenes: SCENES, warnings: [researchWarning('prop', 'EMPTY_RESPONSE')] }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    const eliminar = await screen.findByRole('button', { name: /^Eliminar$/i }, { timeout: 10000 });
    await act(async () => {
      fireEvent.click(eliminar);
      await yields(10);
    });
    const confirmar = await screen.findByRole('button', { name: /Sí, eliminar/i }, { timeout: 10000 });
    await act(async () => {
      fireEvent.click(confirmar);
      await yields(40);
    });

    await waitFor(() => expect(notice()).toBeNull(), { timeout: 10000 });
  });

  it('las llamadas de IMÁGENES no tocan el canal de avisos', async () => {
    answerStory({
      data: storySuccessBody({ scenes: SCENES, warnings: [researchWarning('prop', 'EMPTY_RESPONSE')] }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    const antes = noticeMessages();

    // `generate-scene-images` contesta con SUS propios warnings: aunque el
    // canal de imágenes los trajera, no puede pisar el de la historia.
    ctl.invokeHandler = async (call: InvokeCall) => {
      if (call.fn === 'generate-scene-images') {
        return {
          data: {
            success: true,
            images: ['data:image/png;base64,iVBORw0KGgoAAA='],
            skippedImages: [{ field: 'characters[0].referenceImage', code: 'NOT_USED' }],
            warnings: [researchWarning('landmark', 'PROVIDER_UNAVAILABLE')],
          },
          error: null,
        };
      }
      return ctl.invokeResponse;
    };

    const aprobar = await screen.findByRole(
      'button',
      { name: /Aprobar cuento/i },
      { timeout: 10000 },
    );
    await act(async () => {
      fireEvent.click(aprobar);
      await yields(80);
    });

    // La llamada de imágenes OCURRIÓ de verdad — sin esto la comparación de
    // abajo sería una aserción que no puede fallar.
    await waitFor(
      () => expect(invokes.filter((i) => i.fn === 'generate-scene-images').length).toBeGreaterThan(0),
      { timeout: 10000 },
    );
    // …y trajo su propio `skippedImages`, que SÍ movió el canal de fotos.
    await waitFor(
      () => expect(screen.getByText(/el personaje 1: no se usó\./)).toBeTruthy(),
      { timeout: 10000 },
    );

    // El aviso de la historia quedó EXACTAMENTE igual pese a todo eso.
    expect(noticeMessages()).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------
// T-U.5 — vista previa
// ---------------------------------------------------------------------------

describe('T-U.5 — la vista previa usa el MISMO aviso compartido', () => {
  it('abre la vista previa real y muestra el aviso FUERA del panel del prompt', async () => {
    const w = researchWarning('location', 'PROVIDER_UNAVAILABLE');
    answerStory({ data: previewBody({ warnings: [w] }) });

    await mountEditor();
    await clickPreview();

    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    // La vista previa REAL se abrió.
    const panel = screen.getByText(/Prompt que se enviará a/i).closest('div.p-4');
    expect(panel).not.toBeNull();
    expect(screen.getByText('USER PROMPT capturado')).toBeTruthy();

    expect(noticeMessages()).toEqual([serverWarningMessage('location', 'PROVIDER_UNAVAILABLE')]);
    // …y el aviso NO vive dentro del panel del prompt.
    expect(panel!.contains(notice())).toBe(false);
  });

  it('una generación posterior REEMPLAZA los avisos de la vista previa', async () => {
    answerStory({ data: previewBody({ warnings: [researchWarning('location', 'PROVIDER_UNAVAILABLE')] }) });
    await mountEditor();
    await clickPreview();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [storyWarning()] }) });
    await clickGenerate();

    await waitFor(
      () => expect(noticeMessages()).toEqual([PROP_NOT_RECURRING_MESSAGE]),
      { timeout: 10000 },
    );
  });

  it('una vista previa sin warnings limpia los de un intento anterior', async () => {
    answerStory({ data: previewBody({ warnings: [researchWarning('prop', 'OUTPUT_TRUNCATED')] }) });
    await mountEditor();
    await clickPreview();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    answerStory({ data: previewBody({}) });
    await clickPreview();
    await waitFor(() => expect(notice()).toBeNull(), { timeout: 10000 });
  });

  it('un ERROR de vista previa usa el mismo camino de `InvokeError`', async () => {
    answerStory({
      error: functionsHttpError(422, typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: 'Se requiere contexto de la liturgia y ubicación',
        warnings: [researchWarning('landmark', 'OUTPUT_BLOCKED')],
      })),
    });
    await mountEditor();
    await clickPreview();

    await waitFor(
      () => expect(noticeMessages()).toEqual([serverWarningMessage('landmark', 'OUTPUT_BLOCKED')]),
      { timeout: 10000 },
    );
    expect(
      screen.getByText('Error 422: Se requiere contexto de la liturgia y ubicación'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T-U.6 — el aviso y el error rojo COEXISTEN, en todos los status
// ---------------------------------------------------------------------------

describe('T-U.6 — coexistencia con la superficie de error, agnóstica al status', () => {
  const casos: Array<{ status: number; body: Record<string, unknown>; esperado: string }> = [
    {
      status: 400,
      body: typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: CLIENT_INPUT_INVALID_400_DETAIL,
        warnings: [researchWarning('location', 'NO_API_KEY')],
      }),
      esperado: `Error 400: ${CLIENT_INPUT_INVALID_400_DETAIL}`,
    },
    {
      status: 422,
      body: typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: 'Se requiere contexto de la liturgia y ubicación',
        warnings: [researchWarning('landmark', 'EMPTY_RESPONSE')],
      }),
      esperado: 'Error 422: Se requiere contexto de la liturgia y ubicación',
    },
    {
      status: 502,
      body: typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'El modelo devolvió una estructura inválida.',
        warnings: [researchWarning('prop', 'OUTPUT_TRUNCATED')],
      }),
      esperado: 'Error 502: El modelo devolvió una estructura inválida.',
    },
    {
      status: 500,
      body: genericErrorBody({
        error: 'Error generando cuento',
        warnings: [storyWarning()],
      }),
      esperado: 'Error 500: Error generando cuento',
    },
  ];

  for (const caso of casos) {
    it(`${caso.status}: el aviso y el error se ven a la vez`, async () => {
      answerStory({ error: functionsHttpError(caso.status, caso.body) });
      await mountEditor();
      await clickGenerate();

      await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
      expect(noticeMessages()).toHaveLength(1);
      // Ninguno reemplaza al otro.
      expect(screen.getByText(caso.esperado)).toBeTruthy();
      expect(screen.getByText('Avisos de la generación')).toBeTruthy();
    });
  }

  it('un cuerpo de error SIN warnings no fabrica un aviso', async () => {
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'El modelo devolvió una estructura inválida.',
      })),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(
      () => expect(screen.getByText('Error 502: El modelo devolvió una estructura inválida.')).toBeTruthy(),
      { timeout: 10000 },
    );
    expect(notice()).toBeNull();
  });

  it('warnings MAL FORMADOS en un cuerpo de error no fabrican un aviso', async () => {
    answerStory({
      error: functionsHttpError(502, {
        success: false,
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'x',
        warnings: [{ source: 'inventada', code: 'X', message: 'y' }, { source: 'prop' }, 'texto'],
      }),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(() => expect(screen.getByText('Error 502: x')).toBeTruthy(), { timeout: 10000 });
    expect(notice()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-U.7 — códigos futuros, multiplicidad e higiene
// ---------------------------------------------------------------------------

describe('T-U.7 — código desconocido, duplicados legales e higiene de texto', () => {
  it('un código DESCONOCIDO de fuente conocida renderiza el mensaje del servidor verbatim', async () => {
    const futuro = {
      source: 'prop',
      code: 'MOTIVO_QUE_AUN_NO_EXISTE',
      message: 'El servicio de investigación visual agotó su cuota diaria. No se pudo incorporar esa información.',
    };
    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [futuro] }) });
    await mountEditor();
    await clickGenerate();

    await waitFor(() => expect(noticeMessages()).toEqual([futuro.message]), { timeout: 10000 });
    // La UI no derivó copy del código.
    expect(notice()!.textContent).not.toContain('MOTIVO_QUE_AUN_NO_EXISTE');
  });

  it('DOS entradas idénticas en source/code se renderizan las DOS, sin key duplicada', async () => {
    // El borde emite una entrada por resultado: dos props que fallan igual
    // producen el mismo par. Deduplicar borraría un fallo real.
    const dup = researchWarning('prop', 'PROVIDER_HTTP_ERROR', { httpStatus: 500 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [dup, dup] }) });
      await mountEditor();
      await clickGenerate();

      await waitFor(() => expect(noticeMessages()).toHaveLength(2), { timeout: 10000 });
      const msg = serverWarningMessage('prop', 'PROVIDER_HTTP_ERROR');
      expect(noticeMessages()).toEqual([msg, msg]);

      const keyWarnings = errSpy.mock.calls
        .map((c) => String(c[0] ?? ''))
        .filter((m) => /same key|duplicate key|Encountered two children/i.test(m));
      expect(keyWarnings).toEqual([]);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('no filtra texto del request, del proveedor ni propiedades fuera de contrato', async () => {
    const conBasura = {
      ...researchWarning('landmark', 'PROVIDER_HTTP_ERROR', { httpStatus: 503, finishReason: 'SAFETY' }),
      promptDelUsuario: 'TOKEN-REQUEST-NO-DEBE-RENDERIZARSE',
      proveedor: 'TOKEN-PROVEEDOR-NO-DEBE-RENDERIZARSE',
      requestId: 'TOKEN-REQID-NO-DEBE-RENDERIZARSE',
    };
    answerStory({ data: storySuccessBody({ scenes: SCENES, warnings: [conBasura] }) });
    await mountEditor();
    await clickGenerate();

    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    const texto = notice()!.textContent ?? '';
    expect(texto).toContain(serverWarningMessage('landmark', 'PROVIDER_HTTP_ERROR'));
    for (const token of [
      'TOKEN-REQUEST-NO-DEBE-RENDERIZARSE',
      'TOKEN-PROVEEDOR-NO-DEBE-RENDERIZARSE',
      'TOKEN-REQID-NO-DEBE-RENDERIZARSE',
    ]) {
      expect(texto).not.toContain(token);
    }
    // Los opcionales del contrato tampoco se interpolan en la copy.
    expect(texto).not.toContain('503');
    expect(texto).not.toContain('SAFETY');
  });
});

// ---------------------------------------------------------------------------
// T-U.8 — sin distinción "todo falló"
// ---------------------------------------------------------------------------

describe('T-U.8 — degradación mixta y total se ven IGUAL', () => {
  /** Firma visual/estructural del aviso, sin sus mensajes. */
  function shape() {
    const n = notice()!;
    return {
      role: n.getAttribute('role'),
      ariaLive: n.getAttribute('aria-live'),
      className: n.getAttribute('class'),
      style: n.getAttribute('style'),
      heading: within(n).getByText(/^Avisos de la generación$/).textContent,
      dismiss: !!screen.queryByRole('button', { name: 'Ocultar avisos de la generación' }),
    };
  }

  it('un solo fallo y "todo falló" comparten encabezado, rol, color y estructura', async () => {
    answerStory({
      data: storySuccessBody({ scenes: SCENES, warnings: [researchWarning('location', 'NO_API_KEY')] }),
    });
    const view = await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    const mixto = shape();
    view.unmount();

    resetBoundary();
    ctl.userId = 'user-pcui';
    answerStory({
      data: storySuccessBody({
        scenes: SCENES,
        warnings: [
          researchWarning('location', 'NO_API_KEY'),
          researchWarning('landmark', 'NO_API_KEY'),
          researchWarning('prop', 'NO_API_KEY'),
        ],
      }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(noticeMessages()).toHaveLength(3), { timeout: 10000 });
    const total = shape();

    expect(total).toEqual(mixto);
  });

  it('no existe denominador de cliente: nada cuenta intentos ni dice "todos"', async () => {
    answerStory({
      data: storySuccessBody({
        scenes: SCENES,
        warnings: [
          researchWarning('location', 'NO_API_KEY'),
          researchWarning('landmark', 'NO_API_KEY'),
        ],
      }),
    });
    await mountEditor();
    await clickGenerate();
    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });

    const texto = notice()!.textContent ?? '';
    expect(texto).not.toMatch(/toda[s]? la[s]? investigacion|ningun[ao]|\bde 3\b|\b2 de\b|fall(ó|aron) todo/i);
  });
});

// ---------------------------------------------------------------------------
// T-U.11 — cierre de PFE-F3 por comportamiento del CONSUMIDOR
// ---------------------------------------------------------------------------

describe('T-U.11 — PFE-F3: el detalle del backend llega a la superficie roja', () => {
  it('un 400 CLIENT_INPUT_INVALID muestra `Error 400: <detalle>` en el editor real', async () => {
    answerStory({
      error: functionsHttpError(400, typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: CLIENT_INPUT_INVALID_400_DETAIL,
      })),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(
      () => expect(screen.getByText(`Error 400: ${CLIENT_INPUT_INVALID_400_DETAIL}`)).toBeTruthy(),
      { timeout: 10000 },
    );
    // El detalle del backend, no una redacción del cliente.
    expect(screen.queryByText(/la referencia no es válida/i)).toBeNull();
  });

  it('un INVALID_IMAGE_REF de NIVEL SUPERIOR sigue el camino genérico: nada ramifica en él', async () => {
    answerStory({
      error: functionsHttpError(422, imageRefErrorBody({
        code: 'INVALID_IMAGE_REF',
        error: INVALID_IMAGE_REF_DETAIL,
        field: 'props[0].referenceImages[0]',
      })),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(
      () => expect(screen.getByText(`Error 422: ${INVALID_IMAGE_REF_DETAIL}`)).toBeTruthy(),
      { timeout: 10000 },
    );
    // NO se usó `describeSkippedImage` para el código de nivel superior.
    expect(screen.queryByText(/el objeto 1, foto 1: la referencia no es válida\./)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ocultar aviso' })).toBeNull();
  });

  it('un INVALID_IMAGE_REF POR ENTRADA sí usa la copy por entrada: es su único consumidor', async () => {
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'El modelo devolvió una estructura inválida.',
        skippedImages: [{ field: 'props[0].referenceImages[0]', code: 'INVALID_IMAGE_REF' }],
      })),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(
      () => expect(screen.getByText('el objeto 1, foto 1: la referencia no es válida.')).toBeTruthy(),
      { timeout: 10000 },
    );
    expect(screen.getByText('Error 502: El modelo devolvió una estructura inválida.')).toBeTruthy();
  });

  it('los cuatro sitios de invoke pasan por la MISMA costura: el aviso de historia no viene de un parser propio', async () => {
    // Guardia de topología: `generate-story` es la única función invocada en
    // este flujo, y su error llegó ya tipado (status + detalle), que es lo que
    // sólo `extractInvokeError` produce a partir de `context`.
    answerStory({
      error: functionsHttpError(502, typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'detalle único de la costura',
        warnings: [researchWarning('prop', 'EMPTY_RESPONSE')],
      })),
    });
    await mountEditor();
    await clickGenerate();

    await waitFor(() => expect(notice()).not.toBeNull(), { timeout: 10000 });
    expect(screen.getByText('Error 502: detalle único de la costura')).toBeTruthy();
    expect(invokes.filter((i) => i.fn === 'generate-story')).toHaveLength(1);
  });
});
