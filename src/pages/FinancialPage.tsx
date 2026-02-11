/**
 * FinancialPage — Page shell for the financial module.
 *
 * Follows the exact pattern from MesaAbiertaAdmin.tsx:
 * AuthProvider > div > AdminPageHeader > main > FinancialAdmin
 */

import { AuthProvider } from '@/components/auth/AuthContext';
import FinancialAdmin from '@/components/financial/FinancialAdmin';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const FinancialPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminPageHeader
          title="Finanzas"
          subtitle="Gestión financiera de CASA"
          breadcrumbs={[
            { label: 'Administración' },
            { label: 'Finanzas' },
          ]}
          backTo="/admin"
        />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <FinancialAdmin />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
};

export default FinancialPage;
