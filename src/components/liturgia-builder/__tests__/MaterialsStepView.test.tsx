/**
 * MaterialsStepView — props/interaction suite (Phase M3a, [B4] topology).
 *
 * The component is purely presentational, so this suite needs NO module mocks
 * at all: it renders with plain props and asserts rendered copy, ordering,
 * disabled state and the callbacks that fire. The only vi.fn()s here are the
 * callback props themselves ("callbacks out").
 *
 * Covers [A3]–[A8] of the M3a spec (PLAN-MATERIALES §Phase M3a).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialsStepView, { type MaterialsStepViewProps } from '../MaterialsStepView';
import type { ChildrenInventoryRow, InventoryCategory } from '@/types/childrenMinistry';

const makeItem = (
  id: string,
  name: string,
  category: InventoryCategory,
  quantity = 0,
): ChildrenInventoryRow => ({
  id,
  name,
  category,
  quantity,
  min_quantity: 0,
  location: 'Sala Infantil',
  notes: null,
  last_restocked_at: null,
  created_by: null,
  created_at: '2026-07-31T00:00:00.000Z',
  updated_at: '2026-07-31T00:00:00.000Z',
});

/**
 * Deliberately NOT name-sorted and NOT category-grouped in the input: the
 * parent owns ordering within a category (M-D12), the view owns the category
 * order and must preserve the given order inside each group.
 */
const ITEMS: ChildrenInventoryRow[] = [
  makeItem('i1', 'Zeta pincel', 'craft', 4),
  makeItem('i2', 'Proyector', 'equipment'),
  makeItem('i3', 'Alfa papel', 'craft'),
  makeItem('i4', 'Caja sorpresa', 'other'),
  makeItem('i5', 'Biblia infantil', 'book', 2),
  makeItem('i6', 'Pegamento', 'supply'),
];

const renderView = (overrides: Partial<MaterialsStepViewProps> = {}) => {
  const props: MaterialsStepViewProps = {
    groupNames: ['Pequeños', 'Medianos'],
    items: ITEMS,
    checkedIds: new Set<string>(),
    extras: [],
    savingExtra: null,
    isLoading: false,
    loadError: false,
    capReached: false,
    effectiveCount: 0,
    onToggleItem: vi.fn(),
    onToggleAll: vi.fn(),
    onAddExtra: vi.fn(),
    onSaveExtra: vi.fn(),
    ...overrides,
  };
  const utils = render(<MaterialsStepView {...props} />);
  return { props, ...utils };
};

/** Accessible names of the rendered checkboxes, in document order. */
const checkboxNames = () =>
  screen.getAllByRole('checkbox').map((node) => node.getAttribute('aria-label'));

describe('MaterialsStepView', () => {
  it('[D8] muestra la línea de contexto y la introducción', () => {
    renderView();

    expect(screen.getByText('Generarás para: Pequeños, Medianos')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Selecciona los materiales con los que cuenta la iglesia. La actividad se diseñará usando solo estos materiales.',
      ),
    ).toBeInTheDocument();
  });

  it('[A3] agrupa bajo los cinco encabezados en el orden M-D12', () => {
    renderView();

    const headers = screen.getAllByText(
      /^(Manualidades|Libros|Suministros|Equipamiento|Otros)$/,
    );
    expect(headers.map((node) => node.textContent)).toEqual([
      'Manualidades',
      'Libros',
      'Suministros',
      'Equipamiento',
      'Otros',
    ]);
  });

  it('[A3] preserva el orden dado dentro de cada categoría', () => {
    renderView();

    // Craft keeps the input order (Zeta before Alfa — no re-sorting here),
    // and the categories follow craft → book → supply → equipment → other.
    expect(checkboxNames()).toEqual([
      'Zeta pincel',
      'Alfa papel',
      'Biblia infantil',
      'Pegamento',
      'Proyector',
      'Caja sorpresa',
    ]);
  });

  it('[A3] toma el estado marcado de props y emite onToggleItem con el id', () => {
    const { props } = renderView({ checkedIds: new Set(['i3']) });

    expect(screen.getByRole('checkbox', { name: 'Alfa papel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Pegamento' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Pegamento' }));
    expect(props.onToggleItem).toHaveBeenCalledTimes(1);
    expect(props.onToggleItem).toHaveBeenCalledWith('i6');
  });

  it('muestra la insignia x{quantity} sólo cuando quantity > 0', () => {
    renderView();

    expect(screen.getByText('x4')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();
    expect(screen.queryByText('x0')).not.toBeInTheDocument();
  });

  it('[A4] con el tope alcanzado deshabilita las casillas no marcadas y muestra la línea del límite', () => {
    renderView({ capReached: true, checkedIds: new Set(['i1']) });

    expect(screen.getByRole('checkbox', { name: 'Zeta pincel' })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Alfa papel' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Proyector' })).toBeDisabled();
    expect(
      screen.getByText('Límite de 60 materiales alcanzado. Quita alguno para agregar otros.'),
    ).toBeInTheDocument();
  });

  it('[A4] con el tope alcanzado los marcados siguen siendo desmarcables y Agregar queda deshabilitado', () => {
    const { props } = renderView({ capReached: true, checkedIds: new Set(['i1']) });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Zeta pincel' }));
    expect(props.onToggleItem).toHaveBeenCalledWith('i1');

    // Even with a valid name typed, the one-off control stays blocked.
    fireEvent.change(screen.getByPlaceholderText('Agregar material adicional…'), {
      target: { value: 'Lana de colores' },
    });
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('[A4] sin tope alcanzado no hay casillas deshabilitadas ni línea de límite', () => {
    renderView({ checkedIds: new Set(['i1']) });

    screen.getAllByRole('checkbox').forEach((node) => expect(node).not.toBeDisabled());
    expect(
      screen.queryByText('Límite de 60 materiales alcanzado. Quita alguno para agregar otros.'),
    ).not.toBeInTheDocument();
  });

  it('[A5] los botones masivos emiten onToggleAll(true) y onToggleAll(false)', () => {
    const { props } = renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }));

    expect(props.onToggleAll).toHaveBeenCalledTimes(2);
    expect(props.onToggleAll).toHaveBeenNthCalledWith(1, true);
    expect(props.onToggleAll).toHaveBeenNthCalledWith(2, false);
  });

  it('[A5] el contador muestra {effectiveCount}/60 materiales seleccionados', () => {
    const { rerender, props } = renderView({ effectiveCount: 3 });
    expect(screen.getByText('3/60 materiales seleccionados')).toBeInTheDocument();

    rerender(<MaterialsStepView {...props} effectiveCount={60} />);
    expect(screen.getByText('60/60 materiales seleccionados')).toBeInTheDocument();
  });

  it('[A6] estado de carga: copia exacta con spinner y sin lista', () => {
    const { container } = renderView({ isLoading: true });

    expect(screen.getByText('Cargando materiales disponibles…')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText('0/60 materiales seleccionados')).not.toBeInTheDocument();
  });

  it('[A6] estado de error: copia exacta con tinte destructivo', () => {
    renderView({ loadError: true, items: [] });

    const line = screen.getByText(
      'No se pudieron cargar los materiales del inventario. Puedes generar sin restricción de materiales.',
    );
    expect(line).toBeInTheDocument();
    expect(line).toHaveClass('text-destructive');
    // The error path never claims the inventory is merely empty.
    expect(
      screen.queryByText(
        'El inventario de materiales está vacío. Agrega materiales aquí o genera sin restricción.',
      ),
    ).not.toBeInTheDocument();
  });

  it('[A6] inventario vacío: copia exacta y sin encabezados de categoría', () => {
    renderView({ items: [] });

    expect(
      screen.getByText(
        'El inventario de materiales está vacío. Agrega materiales aquí o genera sin restricción.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Manualidades')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seleccionar todos' })).not.toBeInTheDocument();
  });

  it('[A7] Agregar emite onAddExtra con el valor escrito y limpia el campo', () => {
    const { props } = renderView();
    const input = screen.getByPlaceholderText('Agregar material adicional…');

    fireEvent.change(input, { target: { value: 'Cinta washi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(props.onAddExtra).toHaveBeenCalledTimes(1);
    expect(props.onAddExtra).toHaveBeenCalledWith('Cinta washi');
    expect(input).toHaveValue('');
  });

  it('[A7] el campo aplica maxLength 120 y Agregar exige texto', () => {
    const { props } = renderView();
    const input = screen.getByPlaceholderText('Agregar material adicional…');

    expect(input).toHaveAttribute('maxlength', '120');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();

    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Lana' } });
    expect(screen.getByRole('button', { name: 'Agregar' })).not.toBeDisabled();
    expect(props.onAddExtra).not.toHaveBeenCalled();
  });

  it('[A7] los adicionales se muestran marcados y Guardar en inventario emite onSaveExtra', () => {
    const { props } = renderView({ extras: ['Cinta washi', 'Globos'] });

    expect(screen.getByText('Adicionales (solo esta vez)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cinta washi' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Globos' })).toBeChecked();

    const saveButtons = screen.getAllByRole('button', { name: 'Guardar en inventario' });
    expect(saveButtons).toHaveLength(2);

    fireEvent.click(saveButtons[0]);
    expect(props.onSaveExtra).toHaveBeenCalledTimes(1);
    expect(props.onSaveExtra).toHaveBeenCalledWith('Cinta washi');
  });

  it('[A7] savingExtra deshabilita y muestra spinner sólo en ese adicional', () => {
    renderView({ extras: ['Cinta washi', 'Globos'], savingExtra: 'Globos' });

    const saveButtons = screen.getAllByRole('button', { name: 'Guardar en inventario' });
    expect(saveButtons[0]).not.toBeDisabled();
    expect(saveButtons[0].querySelector('.animate-spin')).toBeNull();
    expect(saveButtons[1]).toBeDisabled();
    expect(saveButtons[1].querySelector('.animate-spin')).not.toBeNull();
  });

  it('[A8] la pista (se usará abreviado) aparece sólo sobre 120 unidades UTF-16', () => {
    const name121 = 'A'.repeat(121);
    const name120 = 'B'.repeat(120);
    renderView({
      items: [makeItem('l1', name121, 'craft'), makeItem('l2', name120, 'craft')],
    });

    const hints = screen.getAllByText('(se usará abreviado)');
    expect(hints).toHaveLength(1);
    expect(hints[0].closest('label')).toHaveTextContent(name121);
  });

  /**
   * El caso ASCII de arriba no distingue la unidad congelada: con sólo letras
   * ASCII, unidades UTF-16 y puntos de código coinciden. Este testigo usa
   * caracteres del plano suplementario (1 punto de código = 2 unidades UTF-16)
   * para fijar M-D5 en unidades UTF-16: 61 caracteres son 122 unidades (pista)
   * y 60 son exactamente 120 (sin pista). Una implementación por puntos de
   * código contaría 61 y 60 y no mostraría ninguna pista.
   */
  it('[A8] la pista cuenta unidades UTF-16, no puntos de código', () => {
    const astral = String.fromCodePoint(0x1f3a8);
    const units122 = astral.repeat(61);
    const units120 = astral.repeat(60);
    renderView({
      items: [makeItem('u1', units122, 'craft'), makeItem('u2', units120, 'craft')],
    });

    const hints = screen.getAllByText('(se usará abreviado)');
    expect(hints).toHaveLength(1);
    expect(hints[0].closest('label')).toHaveTextContent(units122);

    expect(screen.getByText(units120).closest('label')).not.toHaveTextContent(
      '(se usará abreviado)',
    );
  });

  it('muestra la nota de cero selección sólo cuando effectiveCount es 0', () => {
    const { rerender, props } = renderView({ effectiveCount: 0 });
    expect(
      screen.getByText(
        'Sin materiales seleccionados: la actividad se generará sin restricción de materiales.',
      ),
    ).toBeInTheDocument();

    rerender(<MaterialsStepView {...props} effectiveCount={1} />);
    expect(
      screen.queryByText(
        'Sin materiales seleccionados: la actividad se generará sin restricción de materiales.',
      ),
    ).not.toBeInTheDocument();
  });
});
