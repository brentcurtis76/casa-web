/**
 * PersonnelPage — Page shell for the personnel sub-route.
 *
 * Accessible at /admin/finanzas/nomina.
 * Two tabs: "Personal" (personnel management) and "Nómina" (payroll processing).
 */

import { AuthProvider } from '@/components/auth/AuthContext';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import { Users, Receipt, Loader2 } from 'lucide-react';
import PersonnelManager from '@/components/financial/PersonnelManager';
import PayrollManager from '@/components/financial/PayrollManager';

const PersonnelPageContent = () => {
  const { canRead, canWrite, loading } = usePermissions('financial');

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
          No tienes permisos para acceder a esta sección.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="personal" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-md">
        <TabsTrigger value="personal" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Personal
        </TabsTrigger>
        <TabsTrigger value="nomina" className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Nómina
        </TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <PersonnelManager canWrite={canWrite} />
      </TabsContent>

      <TabsContent value="nomina">
        <PayrollManager canWrite={canWrite} />
      </TabsContent>
    </Tabs>
  );
};

const PersonnelPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminPageHeader
          title="Personal y Nómina"
          subtitle="Gestión de personal y procesamiento de nómina"
          breadcrumbs={[
            { label: 'Administración' },
            { label: 'Finanzas', href: '/admin/finanzas' },
            { label: 'Personal' },
          ]}
          backTo="/admin/finanzas"
        />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <PersonnelPageContent />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
};

export default PersonnelPage;
