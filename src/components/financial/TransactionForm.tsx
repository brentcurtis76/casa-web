/**
 * TransactionForm — Dialog form for creating/editing transactions.
 *
 * Uses react-hook-form + zodResolver with the transactionSchema.
 * CLPInput for amount, hierarchical category select filtered by type.
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import CLPInput from './CLPInput';
import { transactionSchema, type TransactionFormData } from '@/lib/financial/schemas';
import {
  useActiveCategories,
  useAccounts,
  useCreateTransaction,
  useUpdateTransaction,
} from '@/lib/financial/hooks';
import type { FinancialTransaction, TransactionType } from '@/types/financial';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionType: TransactionType;
  editTransaction?: FinancialTransaction | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

const TransactionForm = ({
  open,
  onOpenChange,
  transactionType,
  editTransaction,
}: TransactionFormProps) => {
  const isEditing = !!editTransaction;
  const { data: categories = [] } = useActiveCategories();
  const { data: accounts = [] } = useAccounts();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: 0,
      type: transactionType,
      category_id: null,
      account_id: null,
      reference: null,
      notes: null,
    },
  });

  // Reset form when dialog opens with edit data or new defaults
  useEffect(() => {
    if (open) {
      if (editTransaction) {
        form.reset({
          date: editTransaction.date,
          description: editTransaction.description,
          amount: editTransaction.amount,
          type: editTransaction.type,
          category_id: editTransaction.category_id,
          account_id: editTransaction.account_id,
          reference: editTransaction.reference,
          notes: editTransaction.notes,
        });
      } else {
        form.reset({
          date: new Date().toISOString().split('T')[0],
          description: '',
          amount: 0,
          type: transactionType,
          category_id: null,
          account_id: null,
          reference: null,
          notes: null,
        });
      }
    }
  }, [open, editTransaction, transactionType, form]);

  // Filter categories by the current transaction type
  const currentType = form.watch('type');
  const filteredCategories = useMemo(() => {
    const catType = currentType === 'income' ? 'income' : 'expense';
    return categories.filter((c) => c.type === catType);
  }, [categories, currentType]);

  // Group categories: parents first, children indented
  const parentCategories = useMemo(
    () => filteredCategories.filter((c) => !c.parent_id),
    [filteredCategories]
  );

  const onSubmit = async (data: TransactionFormData) => {
    const payload = {
      ...data,
      created_by: null as string | null,
    };

    if (isEditing && editTransaction) {
      await updateMutation.mutateAsync({
        id: editTransaction.id,
        data: payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const typeLabel = currentType === 'income' ? 'Ingreso' : 'Gasto';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Transacción' : `Nuevo ${typeLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los campos y guarda los cambios.'
              : `Registra un nuevo ${typeLabel.toLowerCase()} financiero.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Fecha */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción de la transacción" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monto */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <CLPInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo (hidden if pre-set, visible on edit) */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Ingreso</SelectItem>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Categoria */}
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {parentCategories.map((parent) => {
                        const children = filteredCategories.filter(
                          (c) => c.parent_id === parent.id
                        );
                        if (children.length === 0) {
                          return (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name}
                            </SelectItem>
                          );
                        }
                        return (
                          <SelectGroup key={parent.id}>
                            <SelectLabel>{parent.name}</SelectLabel>
                            <SelectItem value={parent.id}>
                              {parent.name} (general)
                            </SelectItem>
                            {children.map((child) => (
                              <SelectItem key={child.id} value={child.id}>
                                &nbsp;&nbsp;{child.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cuenta (opcional) */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta (opcional)</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cuenta</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Referencia (opcional) */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="N. de documento, cheque, etc."
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notas (opcional) */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : `Crear ${typeLabel}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionForm;
