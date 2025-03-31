
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: "url('/lovable-uploads/04516aaf-6204-4820-bfd3-99475973c905.png')" 
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-30 z-0"></div>
      </div>

      {/* Content */}
      <div className="container-custom relative z-10 text-center text-white mt-16">
        <h1 className="font-mont text-5xl md:text-7xl font-light tracking-wide mb-6">
          Bienvenido a CASA
        </h1>
        <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-10 font-light">
          Un espacio de amor, inclusión y esperanza para todos
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-white text-black hover:bg-white/90">
            Conoce más
          </Button>
          <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
            Nuestros Servicios
          </Button>
        </div>
      </div>
    </div>
  );
}
