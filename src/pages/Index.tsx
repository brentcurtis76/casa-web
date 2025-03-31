
import { AuthProvider } from '@/components/auth/AuthContext';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Equipo } from '@/components/sections/Equipo';
import { Eventos } from '@/components/sections/Eventos';
import { Hero } from '@/components/sections/Hero';
import { InstagramFeed } from '@/components/sections/InstagramFeed';
import { Oracion } from '@/components/sections/Oracion';
import { Participar } from '@/components/sections/Participar';
import { Proposito } from '@/components/sections/Proposito';
import { Sermones } from '@/components/sections/Sermones';

const Index = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main>
          <Hero />
          <Proposito />
          <Equipo />
          <Participar />
          <Eventos />
          <Sermones />
          <Oracion />
          <InstagramFeed />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default Index;
