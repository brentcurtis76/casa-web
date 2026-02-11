/**
 * FinancialAdmin — Main tabbed container for the financial module.
 *
 * Uses usePermissions('financial') to gate access:
 * - canRead required to view anything
 * - canWrite passed down for child components to conditionally show action buttons
 *
 * 5 tabs: Resumen, Transacciones, Presupuesto, Importar, Reportes.
 * Includes a link to the Personnel sub-route (/admin/finanzas/nomina).
 */

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import {
  BarChart3,
  ArrowLeftRight,
  Target,
  Upload,
  FileText,
  Loader2,
  Settings,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FinancialDashboard from './FinancialDashboard';
import TransactionList from './TransactionList';
import TransactionForm from './TransactionForm';
import CategoryManager from './CategoryManager';
import BudgetManager from './BudgetManager';
import BankImport from './BankImport';
import FinancialReports from './FinancialReports';

const FinancialAdmin = () => {
  const { canRead, canWrite, loading } = usePermissions('financial');

  // Controlled tab state for "Ver todas" navigation from dashboard
  const [activeTab, setActiveTab] = useState('resumen');

  // Category Manager sheet state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  // Quick-add transaction from dashboard
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('income');

  const handleNavigateToTransactions = useCallback(() => {
    setActiveTab('transacciones');
  }, []);

  const handleNewTransaction = useCallback((type: 'income' | 'expense') => {
    setQuickAddType(type);
    setQuickAddOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          No tienes permisos para acceder al módulo financiero.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="resumen" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="transacciones" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="presupuesto" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Presupuesto
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        {/* Resumen Tab */}
        <TabsContent value="resumen">
          <FinancialDashboard
            canWrite={canWrite}
            onNavigateToTransactions={handleNavigateToTransactions}
            onNewTransaction={handleNewTransaction}
          />
        </TabsContent>

        {/* Transacciones Tab */}
        <TabsContent value="transacciones">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Transacciones</h2>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCategorySheetOpen(true)}
                  title="Administrar categorías"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
            <TransactionList canWrite={canWrite} />
          </div>
          <CategoryManager
            open={categorySheetOpen}
            onOpenChange={setCategorySheetOpen}
            canWrite={canWrite}
          />
        </TabsContent>

        {/* Presupuesto Tab */}
        <TabsContent value="presupuesto">
          <BudgetManager canWrite={canWrite} />
        </TabsContent>

        {/* Importar Tab */}
        <TabsContent value="importar">
          <BankImport canWrite={canWrite} />
        </TabsContent>

        {/* Reportes Tab */}
        <TabsContent value="reportes">
          <FinancialReports canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      {/* Personnel navigation link */}
      <div className="mt-6 border-t pt-4">
        <Link
          to="/admin/finanzas/nomina"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Users className="h-4 w-4" />
          Personal y Nómina
        </Link>
      </div>

      {/* Quick-add transaction dialog from dashboard */}
      <TransactionForm
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        transactionType={quickAddType}
      />
    </>
  );
};

export default FinancialAdmin;
