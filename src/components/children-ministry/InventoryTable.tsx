/**
 * InventoryTable — Display children's ministry inventory items
 * Columns: Nombre, Categoría (badge), Cantidad, Mínimo, Ubicación, Último Reabastecimiento, Acciones
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { Edit2, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChildrenInventoryRow, InventoryCategory } from '@/types/childrenMinistry';

interface InventoryTableProps {
  items: ChildrenInventoryRow[];
  onEdit: (id: string) => void;
  onRestock: (id: string) => void;
  onDelete: (id: string) => void;
}

const InventoryTable = ({ items, onEdit, onRestock, onDelete }: InventoryTableProps) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'category'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const categoryMap: Record<InventoryCategory, { label: string; bg: string; text: string }> = {
    craft: { label: 'Manualidades', bg: 'bg-purple-100', text: 'text-purple-800' },
    book: { label: 'Libros', bg: 'bg-blue-100', text: 'text-blue-800' },
    supply: { label: 'Suministros', bg: 'bg-green-100', text: 'text-green-800' },
    equipment: { label: 'Equipamiento', bg: 'bg-gray-100', text: 'text-gray-800' },
    other: { label: 'Otros', bg: 'bg-amber-100', text: 'text-amber-800' },
  };

  const sortedItems = [...items].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    if (sortBy === 'name') {
      aVal = a.name;
      bVal = b.name;
    } else if (sortBy === 'quantity') {
      aVal = a.quantity;
      bVal = b.quantity;
    } else if (sortBy === 'category') {
      aVal = a.category;
      bVal = b.category;
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (column: 'name' | 'quantity' | 'category') => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
  };

  return (
    <>
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
                aria-sort={sortBy === 'name' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Nombre
                  {sortBy === 'name' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
                aria-sort={sortBy === 'category' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center gap-2">
                  Categoría
                  {sortBy === 'category' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('quantity')}
                aria-sort={sortBy === 'quantity' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-end gap-2">
                  Cantidad
                  {sortBy === 'quantity' && (sortAsc ? ' ↑' : ' ↓')}
                </div>
              </TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="hidden md:table-cell">Ubicación</TableHead>
              <TableHead className="hidden md:table-cell">Último Reabastecimiento</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay items en inventario
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => {
                const isLowStock = item.quantity < item.min_quantity && item.min_quantity > 0;
                const categoryInfo = categoryMap[item.category];

                return (
                  <TableRow key={item.id} className={isLowStock ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge className={`${categoryInfo.bg} ${categoryInfo.text}`}>
                        {categoryInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={isLowStock ? 'text-red-700 font-semibold' : ''}>
                        {item.quantity}
                        {isLowStock && <AlertCircle className="inline ml-1 h-4 w-4 text-red-700" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{item.min_quantity}</TableCell>
                    <TableCell className="hidden md:table-cell text-gray-600">{item.location}</TableCell>
                    <TableCell className="hidden md:table-cell text-gray-600">
                      {item.last_restocked_at
                        ? format(new Date(item.last_restocked_at), 'dd/MM/yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item.id)}
                          aria-label={`Editar ${item.name}`}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRestock(item.id)}
                          aria-label={`Reabastecer ${item.name}`}
                          className="h-8 w-8 p-0"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(item.id)}
                          aria-label={`Eliminar ${item.name}`}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar item</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar este item? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InventoryTable;
