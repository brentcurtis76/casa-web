
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: "url('/lovable-uploads/48238d7f-afb0-4e41-bd75-ed4de26d59af.png')" 
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-60 z-0"></div>
      </div>

      {/* Content */}
      <div className="container-custom relative z-10 text-center text-white mt-16">
        <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6">
          Bienvenido a CASA
        </h1>
        <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-10">
          Un espacio de amor, inclusión y esperanza para todos
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-casa-500 hover:bg-casa-600">
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
