
import { AuthProvider } from '@/components/auth/AuthContext';
import { Footer } from '@/components/layout/Footer';
import { Header1 } from '@/components/ui/header';
import { AdvientoHero } from '@/components/sections/AdvientoHero';
import { Equipo } from '@/components/sections/Equipo';
import { Eventos } from '@/components/sections/Eventos';
import { InstagramFeed } from '@/components/sections/InstagramFeed';
import { Oracion } from '@/components/sections/Oracion';
import { Participar } from '@/components/sections/Participar';
import { Proposito } from '@/components/sections/Proposito';
import { Sermones } from '@/components/sections/Sermones';
import { Hero } from '@/components/ui/hero-with-group-of-images-text-and-two-buttons';
import { MesaAbiertaSection } from '@/components/mesa-abierta/MesaAbiertaSection';

const Index = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Header1 />
        <main className="pt-0">
          <AdvientoHero />
          <Hero />
          <Proposito />
          <Equipo />
          <MesaAbiertaSection />
          <Sermones />
          <Participar />
          <Eventos />
          <Oracion />
          <InstagramFeed />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default Index;
