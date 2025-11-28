import { AuthProvider } from '@/components/auth/AuthContext';
import { Footer } from '@/components/layout/Footer';
import { Header1 } from '@/components/ui/header';
import { EventsAdmin } from '@/components/events/EventsAdmin';

const EventsAdminPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Header1 />
        <main className="pt-24 pb-12 flex-1">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <EventsAdmin />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default EventsAdminPage;
