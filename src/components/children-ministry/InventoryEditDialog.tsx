/**
 * InventoryEditDialog — Create or edit inventory items
 * Form fields: Nombre, Categoría, Cantidad, Cantidad Mínima, Ubicación, Notas
 */

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
} from '@/lib/children-ministry/inventoryService';
import type {
  ChildrenInventoryRow,
  ChildrenInventoryInsert,
  InventoryCategory,
} from '@/types/childrenMinistry';

interface InventoryEditDialogProps {
  itemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const InventoryEditDialog = ({
  itemId,
  open,
  onOpenChange,
  onSuccess,
}: InventoryEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!itemId);
  const [formData, setFormData] = useState({
    name: '',
    category: 'supply' as InventoryCategory,
    quantity: 0,
    min_quantity: 0,
    location: 'Sala Infantil',
    notes: '',
  });

  useEffect(() => {
    if (open && itemId) {
      loadItem();
    } else if (open && !itemId) {
      setFormData({
        name: '',
        category: 'supply',
        quantity: 0,
        min_quantity: 0,
        location: 'Sala Infantil',
        notes: '',
      });
      setFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    try {
      setFetching(true);
      const item = await getInventoryItem(itemId);
      setFormData({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        min_quantity: item.min_quantity,
        location: item.location,
        notes: item.notes || '',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el item',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (itemId) {
        await updateInventoryItem(itemId, {
          name: formData.name,
          category: formData.category,
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          location: formData.location,
          notes: formData.notes || null,
        });
        toast({
          title: 'Éxito',
          description: 'Item actualizado correctamente',
        });
      } else {
        await createInventoryItem({
          name: formData.name,
          category: formData.category,
          quantity: formData.quantity,
          min_quantity: formData.min_quantity,
          location: formData.location,
          notes: formData.notes || null,
          created_by: null,
          last_restocked_at: null,
        } as ChildrenInventoryInsert);
        toast({
          title: 'Éxito',
          description: 'Item creado correctamente',
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemId ? 'Editar Item' : 'Nuevo Item'}</DialogTitle>
          <DialogDescription>
            {itemId
              ? 'Actualizar información del item de inventario'
              : 'Crear un nuevo item de inventario'}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Ej: Lápices de colores"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select value={formData.category} onValueChange={(val) =>
                  setFormData({ ...formData, category: val as InventoryCategory })
                }>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="craft">Manualidades</SelectItem>
                    <SelectItem value="book">Libros</SelectItem>
                    <SelectItem value="supply">Suministros</SelectItem>
                    <SelectItem value="equipment">Equipamiento</SelectItem>
                    <SelectItem value="other">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Cantidad *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_quantity">Cantidad Mínima</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  min="0"
                  value={formData.min_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  placeholder="Sala Infantil"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {itemId ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryEditDialog;
