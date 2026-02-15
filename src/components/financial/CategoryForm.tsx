/**
 * CategoryForm — Dialog form for creating/editing categories.
 *
 * Uses react-hook-form + zodResolver with categorySchema.
 * Includes an icon picker grid with ~20 lucide icons.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  Home,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Users,
  Heart,
  Car,
  ShoppingCart,
  Wrench,
  Music,
  BookOpen,
  Gift,
  Building,
  DollarSign,
  HandCoins,
  Church,
  Landmark,
  Package,
  Lightbulb,
  HeartHandshake,
  PlusCircle,
  UsersRound,
  HandHelping,
  MoreHorizontal,
} from 'lucide-react';
import { categorySchema, type CategoryFormData } from '@/lib/financial/schemas';
import { useCategories, useCreateCategory, useUpdateCategory } from '@/lib/financial/hooks';
import type { FinancialCategory, CategoryType } from '@/types/financial';
import { cn } from '@/lib/utils';

// ─── Icon Picker Data ───────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { name: 'home', icon: Home, label: 'Casa' },
  { name: 'zap', icon: Zap, label: 'Energía' },
  { name: 'droplets', icon: Droplets, label: 'Agua' },
  { name: 'flame', icon: Flame, label: 'Gas' },
  { name: 'wifi', icon: Wifi, label: 'Internet' },
  { name: 'users', icon: Users, label: 'Personas' },
  { name: 'heart', icon: Heart, label: 'Diaconía' },
  { name: 'car', icon: Car, label: 'Transporte' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Compras' },
  { name: 'wrench', icon: Wrench, label: 'Mantención' },
  { name: 'music', icon: Music, label: 'Música' },
  { name: 'book-open', icon: BookOpen, label: 'Educación' },
  { name: 'gift', icon: Gift, label: 'Donaciones' },
  { name: 'building', icon: Building, label: 'Edificio' },
  { name: 'dollar-sign', icon: DollarSign, label: 'Dinero' },
  { name: 'hand-coins', icon: HandCoins, label: 'Ofrendas' },
  { name: 'church', icon: Church, label: 'Iglesia' },
  { name: 'landmark', icon: Landmark, label: 'Institución' },
  { name: 'package', icon: Package, label: 'Materiales' },
  { name: 'lightbulb', icon: Lightbulb, label: 'Luz' },
  { name: 'hand-heart', icon: HeartHandshake, label: 'Caridad' },
  { name: 'plus-circle', icon: PlusCircle, label: 'Agregar' },
  { name: 'users-round', icon: UsersRound, label: 'Comunidad' },
  { name: 'hand-helping', icon: HandHelping, label: 'Ayuda' },
  { name: 'more-horizontal', icon: MoreHorizontal, label: 'Más' },
] as const;

// ─── Props ──────────────────────────────────────────────────────────────────

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryType: CategoryType;
  editCategory?: FinancialCategory | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CategoryForm = ({
  open,
  onOpenChange,
  categoryType,
  editCategory,
}: CategoryFormProps) => {
  const isEditing = !!editCategory;
  const { data: allCategories = [] } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: categoryType,
      parent_id: null,
      icon: null,
      sort_order: 0,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editCategory) {
        form.reset({
          name: editCategory.name,
          type: editCategory.type,
          parent_id: editCategory.parent_id,
          icon: editCategory.icon,
          sort_order: editCategory.sort_order,
        });
      } else {
        form.reset({
          name: '',
          type: categoryType,
          parent_id: null,
          icon: null,
          sort_order: 0,
        });
      }
    }
  }, [open, editCategory, categoryType, form]);

  // Filter parent categories by the current type, exclude self
  const currentType = form.watch('type');
  const parentOptions = useMemo(() => {
    return allCategories.filter(
      (c) =>
        c.type === currentType &&
        !c.parent_id &&
        c.is_active &&
        c.id !== editCategory?.id
    );
  }, [allCategories, currentType, editCategory]);

  const onSubmit = async (data: CategoryFormData) => {
    if (isEditing && editCategory) {
      await updateMutation.mutateAsync({
        id: editCategory.id,
        data: {
          name: data.name,
          type: data.type,
          parent_id: data.parent_id ?? null,
          icon: data.icon ?? null,
          sort_order: data.sort_order ?? 0,
          is_active: true,
        },
      });
    } else {
      await createMutation.mutateAsync({
        name: data.name,
        type: data.type,
        parent_id: data.parent_id ?? null,
        icon: data.icon ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: true,
      });
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los campos de la categoría.'
              : 'Crea una nueva categoría financiera.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nombre */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la categoría" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Ingreso</SelectItem>
                      <SelectItem value="expense">Gasto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Categoría padre */}
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría padre (opcional)</FormLabel>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin padre (raíz)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin padre (raíz)</SelectItem>
                      {parentOptions.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icono */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icono</FormLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {ICON_OPTIONS.map(({ name, icon: Icon, label }) => (
                      <button
                        key={name}
                        type="button"
                        title={label}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors',
                          field.value === name
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted'
                        )}
                        onClick={() => field.onChange(name)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate w-full text-center text-[10px]">{label}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Orden */}
            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
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
                {isEditing ? 'Guardar Cambios' : 'Crear Categoría'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryForm;
