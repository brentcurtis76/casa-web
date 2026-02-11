/**
 * CategoryManager — Sheet (side panel) for category management.
 *
 * Displays a tree view of categories split into Income and Expense sections.
 * Each category shows its icon, name, and sort order. Children are indented.
 * Actions: edit, deactivate toggle (if canWrite).
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
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
  Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCategories, useUpdateCategory } from '@/lib/financial/hooks';
import type { FinancialCategory, CategoryType } from '@/types/financial';
import CategoryForm from './CategoryForm';

// ─── Icon Map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  zap: Zap,
  droplets: Droplets,
  flame: Flame,
  wifi: Wifi,
  users: Users,
  heart: Heart,
  car: Car,
  'shopping-cart': ShoppingCart,
  wrench: Wrench,
  music: Music,
  'book-open': BookOpen,
  gift: Gift,
  building: Building,
  'dollar-sign': DollarSign,
  'hand-coins': HandCoins,
  church: Church,
  landmark: Landmark,
  package: Package,
  lightbulb: Lightbulb,
  'hand-heart': HeartHandshake,
  'plus-circle': PlusCircle,
  'users-round': UsersRound,
  'hand-helping': HandHelping,
  'more-horizontal': MoreHorizontal,
};

function getCategoryIcon(iconName: string | null): LucideIcon {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return Tag;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const CategoryManager = ({ open, onOpenChange, canWrite }: CategoryManagerProps) => {
  const { data: categories = [], isLoading } = useCategories();
  const updateMutation = useUpdateCategory();

  // Category form state
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<CategoryType>('income');
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  // Split categories by type
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const handleNewCategory = useCallback((type: CategoryType) => {
    setEditingCategory(null);
    setFormType(type);
    setFormOpen(true);
  }, []);

  const handleEditCategory = useCallback((cat: FinancialCategory) => {
    setEditingCategory(cat);
    setFormType(cat.type);
    setFormOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (cat: FinancialCategory) => {
      updateMutation.mutate({
        id: cat.id,
        data: { is_active: !cat.is_active },
      });
    },
    [updateMutation]
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Administrar Categorías</SheetTitle>
            <SheetDescription>
              Gestiona las categorías de ingresos y gastos.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Income Categories */}
                <CategorySection
                  title="Categorías de Ingreso"
                  categories={incomeCategories}
                  canWrite={canWrite}
                  onNew={() => handleNewCategory('income')}
                  onEdit={handleEditCategory}
                  onToggleActive={handleToggleActive}
                />

                <Separator />

                {/* Expense Categories */}
                <CategorySection
                  title="Categorías de Gasto"
                  categories={expenseCategories}
                  canWrite={canWrite}
                  onNew={() => handleNewCategory('expense')}
                  onEdit={handleEditCategory}
                  onToggleActive={handleToggleActive}
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Category Form Dialog */}
      <CategoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categoryType={formType}
        editCategory={editingCategory}
      />
    </>
  );
};

// ─── CategorySection sub-component ──────────────────────────────────────────

interface CategorySectionProps {
  title: string;
  categories: FinancialCategory[];
  canWrite: boolean;
  onNew: () => void;
  onEdit: (cat: FinancialCategory) => void;
  onToggleActive: (cat: FinancialCategory) => void;
}

const CategorySection = ({
  title,
  categories,
  canWrite,
  onNew,
  onEdit,
  onToggleActive,
}: CategorySectionProps) => {
  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {canWrite && (
          <Button variant="ghost" size="sm" onClick={onNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nueva Categoría
          </Button>
        )}
      </div>

      {parents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin categorías</p>
      ) : (
        <div className="space-y-1">
          {parents.map((parent) => {
            const children = categories.filter((c) => c.parent_id === parent.id);
            const Icon = getCategoryIcon(parent.icon);

            return (
              <div key={parent.id}>
                <CategoryRow
                  category={parent}
                  Icon={Icon}
                  indent={false}
                  canWrite={canWrite}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                />
                {children.map((child) => {
                  const ChildIcon = getCategoryIcon(child.icon);
                  return (
                    <CategoryRow
                      key={child.id}
                      category={child}
                      Icon={ChildIcon}
                      indent
                      canWrite={canWrite}
                      onEdit={onEdit}
                      onToggleActive={onToggleActive}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── CategoryRow sub-component ──────────────────────────────────────────────

interface CategoryRowProps {
  category: FinancialCategory;
  Icon: LucideIcon;
  indent: boolean;
  canWrite: boolean;
  onEdit: (cat: FinancialCategory) => void;
  onToggleActive: (cat: FinancialCategory) => void;
}

const CategoryRow = ({
  category,
  Icon,
  indent,
  canWrite,
  onEdit,
  onToggleActive,
}: CategoryRowProps) => {
  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group ${
        indent ? 'ml-6' : ''
      } ${!category.is_active ? 'opacity-50' : ''}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-sm flex-1 truncate">{category.name}</span>
      <span className="text-xs text-muted-foreground">{category.sort_order}</span>
      {!category.is_active && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          Inactiva
        </Badge>
      )}
      {canWrite && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(category)}
            aria-label={`Editar categoría ${category.name}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onToggleActive(category)}
            title={category.is_active ? 'Desactivar' : 'Activar'}
            aria-label={category.is_active ? `Desactivar ${category.name}` : `Activar ${category.name}`}
          >
            {category.is_active ? (
              <ToggleRight className="h-3 w-3" />
            ) : (
              <ToggleLeft className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
