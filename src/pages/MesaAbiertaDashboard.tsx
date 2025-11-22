import { AuthProvider } from '@/components/auth/AuthContext';
import { Footer } from '@/components/layout/Footer';
import { Header1 } from '@/components/ui/header';
import { MesaAbiertaDashboard } from '@/components/mesa-abierta/MesaAbiertaDashboard';

const MesaAbiertaDashboardPage = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Header1 />
        <main className="pt-24 pb-12 flex-1">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold text-casa-700 mb-8 text-center">
                La Mesa Abierta - Mi Participación
              </h1>
              <MesaAbiertaDashboard />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default MesaAbiertaDashboardPage;
