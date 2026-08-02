/**
 * MaterialsStepView — "materiales disponibles" step of the children activity flow.
 *
 * PURELY PRESENTATIONAL ([B4] topology): props in, callbacks out. It never
 * fetches, never touches supabase and imports no service module — the dialog
 * (M3b) owns the inventory lifecycle, the checked-id set, the extras list and
 * the canonical effective list (M-D5). The only local state here is the text
 * currently typed into the one-off input.
 *
 * Ordering follows M-D12: fixed category order craft → book → supply →
 * equipment → other, preserving the order in which the parent supplies the
 * rows within each category, then extras in entry order.
 *
 * Pattern: ChildrenActivityDialog (shadcn primitives + CASA_BRAND accents).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  MAX_AVAILABLE_MATERIALS,
  MAX_MATERIAL_NAME_LENGTH,
} from '@/lib/children-ministry/materialsList';
import type { ChildrenInventoryRow, InventoryCategory } from '@/types/childrenMinistry';

export interface MaterialsStepViewProps {
  /** Age-group names the generation will run for — context line only. */
  groupNames: string[];
  /** Inventory rows, already name-ordered by the parent (M-D12). */
  items: ChildrenInventoryRow[];
  /** Ids of the currently selected inventory rows. */
  checkedIds: Set<string>;
  /** One-off material names, in entry order. */
  extras: string[];
  /** Name of the extra currently being saved to inventory, if any. */
  savingExtra: string | null;
  isLoading: boolean;
  loadError: boolean;
  /** True when the effective list already holds MAX_AVAILABLE_MATERIALS names. */
  capReached: boolean;
  /** Size of the canonical effective list (M-D5) — computed by the parent. */
  effectiveCount: number;
  onToggleItem: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onAddExtra: (name: string) => void;
  onSaveExtra: (name: string) => void;
}

/** M-D12 fixed category order. */
const CATEGORY_ORDER: InventoryCategory[] = ['craft', 'book', 'supply', 'equipment', 'other'];

/** Same Spanish labels the inventory admin table uses (InventoryTable.tsx). */
const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  craft: 'Manualidades',
  book: 'Libros',
  supply: 'Suministros',
  equipment: 'Equipamiento',
  other: 'Otros',
};

const MaterialsStepView = ({
  groupNames,
  items,
  checkedIds,
  extras,
  savingExtra,
  isLoading,
  loadError,
  capReached,
  effectiveCount,
  onToggleItem,
  onToggleAll,
  onAddExtra,
  onSaveExtra,
}: MaterialsStepViewProps) => {
  const [extraName, setExtraName] = useState('');

  // Whitespace-only names are dropped by the M-D5 canonicalizer anyway, so a
  // blank-ish input never enables the button (it would be a dead click).
  const canAddExtra = extraName.trim().length > 0 && !capReached;

  const handleAddExtra = () => {
    if (!canAddExtra) return;
    // The raw typed value: canonicalization (trim/truncate/dedupe) is M-D5's
    // job, and it lives with the parent.
    onAddExtra(extraName);
    setExtraName('');
  };

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    rows: items.filter((item) => item.category === category),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
      {groupNames.length > 0 && (
        <p className="text-sm font-medium">{`Generarás para: ${groupNames.join(', ')}`}</p>
      )}

      <p className="text-xs" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
        Selecciona los materiales con los que cuenta la iglesia. La actividad se diseñará usando
        solo estos materiales.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando materiales disponibles…</span>
        </div>
      ) : (
        <>
          {loadError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                No se pudieron cargar los materiales del inventario. Puedes generar sin restricción
                de materiales.
              </p>
            </div>
          )}

          {!loadError && items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              El inventario de materiales está vacío. Agrega materiales aquí o genera sin
              restricción.
            </p>
          )}

          {items.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onToggleAll(true)}>
                  Seleccionar todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleAll(false)}
                >
                  Quitar selección
                </Button>
              </div>

              <div className="space-y-4">
                {groups.map(({ category, rows }) => (
                  <div key={category} className="space-y-2">
                    <p
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                    >
                      {CATEGORY_LABEL[category]}
                    </p>
                    {rows.map((item) => {
                      const checked = checkedIds.has(item.id);
                      const checkboxId = `material-${item.id}`;
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          {/* aria-label mirrors the visible label so the Radix
                              checkbox always has an accessible name. */}
                          <Checkbox
                            id={checkboxId}
                            aria-label={item.name}
                            checked={checked}
                            disabled={capReached && !checked}
                            onCheckedChange={() => onToggleItem(item.id)}
                            className="mt-0.5"
                          />
                          <label htmlFor={checkboxId} className="flex-1 cursor-pointer text-sm">
                            <span>{item.name}</span>
                            {item.quantity > 0 && (
                              <span
                                className="ml-2 rounded px-1.5 py-0.5 text-xs"
                                style={{
                                  backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}80`,
                                  color: CASA_BRAND.colors.secondary.grayDark,
                                }}
                              >
                                {`x${item.quantity}`}
                              </span>
                            )}
                            {item.name.length > MAX_MATERIAL_NAME_LENGTH && (
                              <span
                                className="ml-2 text-xs"
                                style={{ color: CASA_BRAND.colors.secondary.grayDark }}
                              >
                                (se usará abreviado)
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-xs font-medium">
            {`${effectiveCount}/${MAX_AVAILABLE_MATERIALS} materiales seleccionados`}
          </p>

          {capReached && (
            <p className="text-xs" style={{ color: CASA_BRAND.colors.primary.amber }}>
              {`Límite de ${MAX_AVAILABLE_MATERIALS} materiales alcanzado. Quita alguno para agregar otros.`}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={extraName}
              onChange={(event) => setExtraName(event.target.value)}
              placeholder="Agregar material adicional…"
              maxLength={MAX_MATERIAL_NAME_LENGTH}
              className="h-9 text-sm"
            />
            <Button type="button" size="sm" onClick={handleAddExtra} disabled={!canAddExtra}>
              Agregar
            </Button>
          </div>

          {extras.length > 0 && (
            <div
              className="space-y-2 rounded-md border p-3"
              style={{
                borderColor: `${CASA_BRAND.colors.secondary.grayLight}`,
                backgroundColor: `${CASA_BRAND.colors.secondary.grayLight}15`,
              }}
            >
              <p className="text-xs font-semibold">Adicionales (solo esta vez)</p>
              {extras.map((name, index) => {
                const saving = savingExtra === name;
                return (
                  <div key={`${name}-${index}`} className="flex items-center gap-3">
                    {/* Extras are always part of the effective list; there is no
                        un-check callback in this step's contract. */}
                    <Checkbox checked disabled aria-label={name} />
                    <span className="flex-1 text-sm">{name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSaveExtra(name)}
                      disabled={saving}
                    >
                      {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Guardar en inventario
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {effectiveCount === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin materiales seleccionados: la actividad se generará sin restricción de materiales.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default MaterialsStepView;
