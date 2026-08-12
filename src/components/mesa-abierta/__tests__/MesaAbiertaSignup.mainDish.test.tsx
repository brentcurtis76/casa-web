// P5a — el miembro declara la exclusión en el paso 3 y la ve reflejada en el
// resumen del paso 5. El switch nace APAGADO: quien no lo toca queda como hoy,
// es decir `can_bring_main_dish: true` (D2).

import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MesaAbiertaSignup } from '../MesaAbiertaSignup';

const participantInserts: Array<Record<string, unknown>> = [];

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-id', email: 'test@example.com' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// El mock global de `src/test/setup.ts` devuelve `undefined` de los terminadores,
// así que `const { data } = await …single()` revienta. Éste sí resuelve, y captura
// la fila que el asistente manda a `.insert()`.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      // Comprobación de inscripción previa: nunca hay una.
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
      // `profiles`: actualización del nombre.
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: (payload: Record<string, unknown>) => {
        if (table === 'mesa_abierta_participants') {
          participantInserts.push(payload);
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: 'participante-1' }, error: null }),
            }),
          };
        }
        // `mesa_abierta_dietary_restrictions` se espera directamente.
        return Promise.resolve({ error: null });
      },
    }),
    auth: {},
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

const mainDishSwitch = () =>
  screen.getByRole('switch', { name: /No puedo traer el plato principal/i });

const next = () => fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

/** Deja el asistente en el paso 3 (como invitado, que no exige dirección). */
function advanceToStep3() {
  render(<MesaAbiertaSignup open onClose={vi.fn()} monthId="month-1" />);

  next(); // paso 1 → 2
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Persona de prueba' },
  });
  fireEvent.change(screen.getByLabelText('Correo electrónico *'), {
    target: { value: 'persona@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Número de teléfono *'), {
    target: { value: '+56 9 1234 5678' },
  });
  next(); // paso 2 → 3
}

/**
 * Deja el asistente en el paso 3 **como anfitrión**. A diferencia del invitado,
 * el anfitrión sí tiene que rellenar la dirección: `canProceedFromStep3`
 * (`MesaAbiertaSignup.tsx:53`) la exige, y sin ella «Siguiente» va deshabilitado.
 */
function advanceToStep3AsHost() {
  render(
    <MesaAbiertaSignup open onClose={vi.fn()} monthId="month-1" preferredRole="host" />
  );

  next(); // paso 1 → 2
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Anfitriona de prueba' },
  });
  fireEvent.change(screen.getByLabelText('Correo electrónico *'), {
    target: { value: 'anfitriona@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Número de teléfono *'), {
    target: { value: '+56 9 1234 5678' },
  });
  next(); // paso 2 → 3

  fireEvent.change(screen.getByLabelText('Dirección de tu hogar *'), {
    target: { value: 'Calle Falsa 123' },
  });
}

/**
 * Deja el asistente en el paso 3 como anfitrión, **entrando como invitado y
 * cambiando de idea en el paso 1** — el camino de «pinché inscribirme y luego
 * decidí ser anfitrión».
 *
 * Entra con `preferredRole="guest"` **a propósito**: en producción el prop
 * SIEMPRE llega (`MesaAbiertaSection.tsx:730` pasa `signupRole`, cuyo estado
 * arranca en `'guest'`), así que `undefined` es un caso que la aplicación no
 * produce nunca. Aquí el prop dice `guest` y el estado acaba en `host`, que es
 * la única combinación donde una condición escrita sobre el **prop** se
 * comporta distinto de una escrita sobre el **estado**.
 */
function advanceToStep3ChoosingHostInStep1() {
  render(
    <MesaAbiertaSignup open onClose={vi.fn()} monthId="month-1" preferredRole="guest" />
  );

  fireEvent.click(screen.getByRole('radio', { name: /Quiero ser anfitrión/i }));

  next(); // paso 1 → 2
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Anfitriona de prueba' },
  });
  fireEvent.change(screen.getByLabelText('Correo electrónico *'), {
    target: { value: 'anfitriona@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Número de teléfono *'), {
    target: { value: '+56 9 1234 5678' },
  });
  next(); // paso 2 → 3

  fireEvent.change(screen.getByLabelText('Dirección de tu hogar *'), {
    target: { value: 'Calle Falsa 123' },
  });
}

/**
 * El invitado **tal como llega en producción**: con `preferredRole="guest"`
 * explícito.
 *
 * Los cuatro tests de P5a entran SIN el prop. Eso es un caso que la aplicación
 * no produce nunca, así que una condición sobre `preferredRole === 'guest'`
 * escondería el switch a **todo invitado real** y los dejaría a los cuatro
 * verdes. Este recorrido es el que lo caza.
 */
function advanceToStep3AsProductionGuest() {
  render(
    <MesaAbiertaSignup open onClose={vi.fn()} monthId="month-1" preferredRole="guest" />
  );

  next(); // paso 1 → 2
  fireEvent.change(screen.getByLabelText('Nombre completo *'), {
    target: { value: 'Invitada de prueba' },
  });
  fireEvent.change(screen.getByLabelText('Correo electrónico *'), {
    target: { value: 'invitada@ejemplo.com' },
  });
  fireEvent.change(screen.getByLabelText('Número de teléfono *'), {
    target: { value: '+56 9 1234 5678' },
  });
  next(); // paso 2 → 3
}

/** Desde el paso 3, avanza hasta el resumen del paso 5. */
function advanceToStep5() {
  next(); // paso 3 → 4
  next(); // paso 4 → 5
  expect(screen.getByText('¡Casi listo!')).toBeInTheDocument();
}

/** Pulsa «Completar Inscripción» y espera a que la fila llegue al `.insert()`. */
async function submitAndCaptureInsert() {
  fireEvent.click(screen.getByRole('button', { name: /Completar Inscripción/i }));
  await waitFor(() => expect(participantInserts).toHaveLength(1));
  return participantInserts[0];
}

describe('MesaAbiertaSignup — plato principal', () => {
  it('el switch aparece en el paso 3 y está apagado por defecto', () => {
    advanceToStep3();

    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText('Te asignaremos ensalada, bebidas o postre en su lugar')
    ).toBeInTheDocument();
  });

  it('el resumen del paso 5 no menciona el plato principal si no se excluyó', () => {
    advanceToStep3();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    advanceToStep5();

    expect(screen.queryByText(/plato principal/i)).not.toBeInTheDocument();
  });

  it('el resumen del paso 5 lo menciona cuando el usuario se excluye', () => {
    advanceToStep3();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    advanceToStep5();

    expect(screen.getByText('No traeré el plato principal')).toBeInTheDocument();
  });

  // El resumen puede acertar mientras la fila miente: lo único que la base ve es
  // el `.insert()`. Este test lo mira directamente, en las dos polaridades.
  it('el estado del switch llega al insert', async () => {
    participantInserts.length = 0;

    // Sin tocar el switch ⇒ el miembro conserva la capacidad (D2).
    advanceToStep3();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');
    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      can_bring_main_dish: true,
    });

    cleanup();
    participantInserts.length = 0;

    // Con el switch encendido ⇒ la exclusión tiene que llegar a la fila.
    advanceToStep3();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');
    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      can_bring_main_dish: false,
    });
  });

  // Los cuatro tests de arriba recorren el asistente sólo como invitado, así que
  // esconder el switch al anfitrión los dejaría a los cuatro en verde (B-18). Y
  // el anfitrión es justo el caso que importa: por D7 es el primer candidato a
  // `main_course`, así que un anfitrión que no puede cocinarlo es lo que esta
  // funcionalidad existe para resolver.
  it('el anfitrión también puede excluirse', async () => {
    participantInserts.length = 0;

    advanceToStep3AsHost();

    // Estamos de verdad en el paso 3 del anfitrión, no en el del invitado.
    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
    expect(screen.getByText('Información de anfitrión')).toBeInTheDocument();

    // El switch existe para el anfitrión y nace apagado, igual que para el invitado (D2).
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    advanceToStep5();

    // Las DOS polaridades, como en el test del invitado. Sin este primer submit
    // el test no distingue "el anfitrión puede excluirse" de "el anfitrión queda
    // excluido siempre": excluir a todo anfitrión que no toca el switch viola D2
    // y dejaba verde la versión de la r1.
    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'host',
      can_bring_main_dish: true,
    });

    cleanup();
    participantInserts.length = 0;

    advanceToStep3AsHost();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    advanceToStep5();

    // Y la exclusión llega a la fila: es lo único que la base ve.
    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'host',
      can_bring_main_dish: false,
    });
  });

  // El test de arriba entra con `preferredRole="host"`, así que nunca recorre el
  // paso 1. Quien abre el asistente por el botón genérico sí: arranca como
  // invitado y elige anfitrión ahí. Una condición escrita sobre el **prop**
  // `preferredRole` en vez de sobre el **estado** `rolePreference` esconde el
  // opt-out sólo por este camino, y dejaba los cinco tests anteriores verdes.
  // Las dos polaridades otra vez, y por la misma razón que en el test anterior:
  // sin el caso por defecto, forzar la exclusión en este camino pasaría inadvertido.
  // Cierra la última celda alcanzable de la rejilla rol × entrada × polaridad.
  // Ver la cabecera del fichero: en producción `preferredRole` SIEMPRE llega, y
  // sin este test una condición sobre el prop apagaría el opt-out a todos los
  // invitados reales sin poner nada en rojo.
  it('el invitado de producción entra con preferredRole y conserva el opt-out', async () => {
    participantInserts.length = 0;

    advanceToStep3AsProductionGuest();

    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'guest',
      can_bring_main_dish: true,
    });

    cleanup();
    participantInserts.length = 0;

    advanceToStep3AsProductionGuest();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'guest',
      can_bring_main_dish: false,
    });
  });

  it('el anfitrión elegido en el paso 1 también puede excluirse', async () => {
    participantInserts.length = 0;

    advanceToStep3ChoosingHostInStep1();

    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument();
    expect(screen.getByText('Información de anfitrión')).toBeInTheDocument();
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'false');

    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'host',
      can_bring_main_dish: true,
    });

    cleanup();
    participantInserts.length = 0;

    advanceToStep3ChoosingHostInStep1();
    fireEvent.click(mainDishSwitch());
    expect(mainDishSwitch()).toHaveAttribute('aria-checked', 'true');

    advanceToStep5();

    expect(await submitAndCaptureInsert()).toMatchObject({
      role_preference: 'host',
      can_bring_main_dish: false,
    });
  });
});
