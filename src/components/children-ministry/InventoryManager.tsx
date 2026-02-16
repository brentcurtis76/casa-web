/**
 * InventoryManager — Main inventory management tab
 * Displays inventory table with CRUD operations, filtering, and low-stock banner
 */

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import InventoryTable from './InventoryTable';
import InventoryEditDialog from './InventoryEditDialog';
import RestockDialog from './RestockDialog';
import {
  getInventory,
  getLowStockItems,
  deleteInventoryItem,
} from '@/lib/children-ministry/inventoryService';
import type { ChildrenInventoryRow, InventoryCategory } from '@/types/childrenMinistry';

const InventoryManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChildrenInventoryRow[]>([]);
  const [lowStockItems, setLowStockItems] = useState<ChildrenInventoryRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockingItemId, setRestockingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const [allItems, lowStocks] = await Promise.all([
        getInventory(),
        getLowStockItems(),
      ]);
      setItems(allItems);
      setLowStockItems(lowStocks);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el inventario',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteInventoryItem(itemId);
      toast({
        title: 'Éxito',
        description: 'Item eliminado correctamente',
      });
      loadItems();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el item',
        variant: 'destructive',
      });
    }
  };

  const filteredItems = items.filter((item) => {
    const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
    const searchMatch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const categoryMap: Record<string, string> = {
    all: 'Todos',
    craft: 'Manualidades',
    book: 'Libros',
    supply: 'Suministros',
    equipment: 'Equipamiento',
    other: 'Otros',
  };

  return (
    <>
      <div className="space-y-6">
        {/* Low Stock Banner */}
        {lowStockItems.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Hay {lowStockItems.length} item(s) con stock bajo. Considere hacer un reabastecimiento.
            </AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Gestionar Inventario</CardTitle>
              <Button
                onClick={() => {
                  setEditingItemId(null);
                  setEditDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Categoría</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="craft">Manualidades</SelectItem>
                    <SelectItem value="book">Libros</SelectItem>
                    <SelectItem value="supply">Suministros</SelectItem>
                    <SelectItem value="equipment">Equipamiento</SelectItem>
                    <SelectItem value="other">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Buscar por nombre</label>
                <Input
                  placeholder="Buscar item..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Items ({filteredItems.length} de {items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {items.length === 0 ? 'No hay items en inventario' : 'No se encontraron items'}
                </p>
                {items.length === 0 && (
                  <Button
                    onClick={() => {
                      setEditingItemId(null);
                      setEditDialogOpen(true);
                    }}
                  >
                    Agregar primer item
                  </Button>
                )}
              </div>
            ) : (
              <InventoryTable
                items={filteredItems}
                onEdit={(id) => {
                  setEditingItemId(id);
                  setEditDialogOpen(true);
                }}
                onRestock={(id) => {
                  const item = items.find((i) => i.id === id);
                  if (item) {
                    setRestockingItemId(id);
                    setRestockDialogOpen(true);
                  }
                }}
                onDelete={handleDelete}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <InventoryEditDialog
        itemId={editingItemId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={loadItems}
      />

      {restockingItemId && (
        <RestockDialog
          itemId={restockingItemId}
          currentQuantity={items.find((i) => i.id === restockingItemId)?.quantity || 0}
          itemName={items.find((i) => i.id === restockingItemId)?.name || ''}
          open={restockDialogOpen}
          onOpenChange={setRestockDialogOpen}
          onSuccess={loadItems}
        />
      )}
    </>
  );
};

export default InventoryManager;
