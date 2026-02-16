/**
 * RestockDialog — Quick restock quantity update
 * Shows current quantity, input for new quantity, and saves via restockItem()
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
import { restockItem } from '@/lib/children-ministry/inventoryService';

interface RestockDialogProps {
  itemId: string;
  currentQuantity: number;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const RestockDialog = ({
  itemId,
  currentQuantity,
  itemName,
  open,
  onOpenChange,
  onSuccess,
}: RestockDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newQuantity, setNewQuantity] = useState(currentQuantity);

  useEffect(() => {
    if (open) {
      setNewQuantity(currentQuantity);
    }
  }, [open, currentQuantity]);

  const handleRestock = async () => {
    if (newQuantity < 0) {
      toast({
        title: 'Error',
        description: 'La cantidad debe ser mayor o igual a 0',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await restockItem(itemId, newQuantity);
      toast({
        title: 'Éxito',
        description: 'Item reabastecido correctamente',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo reabastecer el item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reabastecer Item</DialogTitle>
          <DialogDescription>
            Actualizar cantidad para: <span className="font-semibold">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cantidad Actual</Label>
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {currentQuantity} unidades
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newQuantity">Nueva Cantidad *</Label>
            <Input
              id="newQuantity"
              type="number"
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
              placeholder="Ingrese la nueva cantidad"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleRestock} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reabastecer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RestockDialog;
