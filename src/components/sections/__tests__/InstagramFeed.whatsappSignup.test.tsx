/**
 * InstagramFeed — formulario público "lista de difusión de WhatsApp".
 *
 * Es el ÚNICO caller activo de la Function `whatsapp-signup` (pública,
 * verify_jwt = false), así que la protección anti-bot del handler sólo sirve
 * si este formulario la alimenta:
 *
 *   1. la invocación lleva `_honey` (vacío para un humano) y `_timestamp`
 *      (el instante en que se presentó el formulario);
 *   2. un bot que rellena el honeypot oculto lo envía con contenido;
 *   3. tras un envío exitoso, el reset refresca `_timestamp`;
 *   4. nada personal (nombre, teléfono, respuesta, error crudo) pasa por console.
 *
 * Supabase, el toast y framer-motion se mockean: no hay red ni animaciones.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { invokeMock, toastMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
}));

// El mock global de src/test/setup.ts sólo cubre div/button/span/section; este
// componente usa motion.h2 y motion.a. Cualquier etiqueta → elemento plano.
vi.mock('framer-motion', () => {
  const MOTION_PROPS = new Set([
    'initial', 'animate', 'exit', 'whileInView', 'whileHover', 'whileTap',
    'transition', 'viewport', 'variants', 'layout',
  ]);
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(props)) {
            if (!MOTION_PROPS.has(k)) clean[k] = v;
          }
          return React.createElement(tag, clean, children);
        },
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { InstagramFeed } from '../InstagramFeed';

const NAME = 'Valentina Quiroga';
const PHONE = '+56 9 1234 5678';
const T_PRESENTED = 1_700_000_000_000;
const T_SUBMIT = T_PRESENTED + 45_000;

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';
const CONSOLE_METHODS: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

function renderLogArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

/** Captura TODO lo que pase por console durante la prueba. */
function captureConsole(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spies = CONSOLE_METHODS.map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(renderLogArg).join(' '));
    }),
  );
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) };
}

const honeyInput = () =>
  document.querySelector<HTMLInputElement>('input[name="_honey"]');

async function fillAndSubmit(name = NAME, phone = PHONE) {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('+56 9 xxxxxxxx'), { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: /Unirse/i }));
  await waitFor(() => expect(invokeMock).toHaveBeenCalled());
}

describe('InstagramFeed → whatsapp-signup (caller activo de la Function pública)', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    invokeMock.mockReset();
    toastMock.mockReset();
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(T_PRESENTED);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('presenta un honeypot `_honey` real, fuera del flujo visual y del orden de tabulación', () => {
    render(<InstagramFeed />);
    const honey = honeyInput();
    expect(honey).not.toBeNull();
    expect(honey!.tabIndex).toBe(-1);
    expect(honey!.getAttribute('autocomplete')).toBe('off');
    expect(honey!.closest('[aria-hidden="true"]')).not.toBeNull();
    // El formulario visible no cambia: nombre, teléfono y el botón siguen ahí.
    expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+56 9 xxxxxxxx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unirse/i })).toBeInTheDocument();
  });

  it('invoca whatsapp-signup con name, phone, `_honey` vacío y `_timestamp` = instante de presentación', async () => {
    render(<InstagramFeed />);
    nowSpy.mockReturnValue(T_SUBMIT); // el reloj avanza; el timestamp NO debe seguirlo
    await fillAndSubmit();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [fn, opts] = invokeMock.mock.calls[0];
    expect(fn).toBe('whatsapp-signup');
    expect(opts.body).toEqual({
      name: NAME,
      phone: PHONE,
      _honey: '',
      _timestamp: T_PRESENTED,
    });
    await waitFor(() => expect(screen.getByText('¡Solicitud enviada!')).toBeInTheDocument());
  });

  it('un bot que rellena el honeypot lo envía con contenido', async () => {
    render(<InstagramFeed />);
    fireEvent.change(honeyInput()!, { target: { value: 'http://spam.example' } });
    await fillAndSubmit();

    expect(invokeMock.mock.calls[0][1].body._honey).toBe('http://spam.example');
  });

  it('tras un envío exitoso, el reset refresca `_timestamp` para el siguiente envío', async () => {
    render(<InstagramFeed />);
    nowSpy.mockReturnValue(T_SUBMIT);
    await fillAndSubmit();
    expect(invokeMock.mock.calls[0][1].body._timestamp).toBe(T_PRESENTED);

    // El formulario quedó vacío (reset) y el botón vuelve a "Unirse".
    await waitFor(() => {
      expect((screen.getByPlaceholderText('Tu nombre') as HTMLInputElement).value).toBe('');
      expect(screen.getByRole('button', { name: /Unirse/i })).not.toBeDisabled();
    });

    const T_SECOND_SUBMIT = T_SUBMIT + 60_000;
    nowSpy.mockReturnValue(T_SECOND_SUBMIT);
    await fillAndSubmit('Otra Persona', '+56 9 8765 4321');
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));

    const second = invokeMock.mock.calls[1][1].body;
    expect(second._timestamp).toBe(T_SUBMIT); // instante del reset, no el de la primera presentación
    expect(second._timestamp).toBeGreaterThan(T_PRESENTED);
    expect(second._honey).toBe('');
  });

  it('no escribe datos personales, respuestas ni errores crudos en console (éxito)', async () => {
    const capture = captureConsole();
    try {
      invokeMock.mockResolvedValue({
        data: { success: true, message: 'Solicitud recibida correctamente' },
        error: null,
      });
      render(<InstagramFeed />);
      await fillAndSubmit();
      await waitFor(() => expect(toastMock).toHaveBeenCalled());
    } finally {
      capture.restore();
    }
    for (const line of capture.lines) {
      expect(line, `console no debe llevar el nombre: ${line}`).not.toContain('Valentina');
      expect(line, `console no debe llevar el teléfono: ${line}`).not.toContain('1234');
      expect(line, `console no debe llevar la respuesta: ${line}`).not.toMatch(/Respuesta|Solicitud recibida|Enviando solicitud/);
    }
  });

  it('no escribe el error crudo en console cuando la Function falla; el usuario ve el mensaje', async () => {
    const capture = captureConsole();
    try {
      invokeMock.mockResolvedValue({
        data: null,
        error: { message: `provider detail for ${NAME} ${PHONE}` },
      });
      render(<InstagramFeed />);
      await fillAndSubmit();
      await waitFor(() =>
        expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
      );
    } finally {
      capture.restore();
    }
    for (const line of capture.lines) {
      expect(line, `console no debe llevar el error crudo: ${line}`).not.toContain('provider detail');
      expect(line).not.toContain('Valentina');
      expect(line).not.toContain('1234');
    }
  });
});
