import { AuthProvider } from '@/components/auth/AuthContext';
import { MesaAbiertaAdmin } from '@/components/mesa-abierta/MesaAbiertaAdmin';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const MesaAbiertaAdminPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminPageHeader
          title="Mesa Abierta"
          subtitle="Administra las inscripciones y participantes de Mesa Abierta"
          breadcrumbs={[
            { label: 'General' },
            { label: 'Mesa Abierta' },
          ]}
          backTo="/admin"
        />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <MesaAbiertaAdmin />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
};

export default MesaAbiertaAdminPage;
