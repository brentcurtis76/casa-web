import { AuthProvider } from '@/components/auth/AuthContext';
import { EventsAdmin } from '@/components/events/EventsAdmin';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const EventsAdminPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminPageHeader
          title="Gestión de Eventos"
          subtitle="Crea, edita y publica eventos para la comunidad"
          breadcrumbs={[
            { label: 'General' },
            { label: 'Eventos' },
          ]}
          backTo="/admin"
        />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <EventsAdmin />
          </div>
        </main>
      </div>
    </AuthProvider>
  );
};

export default EventsAdminPage;
