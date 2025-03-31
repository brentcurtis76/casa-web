
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ 
          backgroundImage: "url('/lovable-uploads/c727ba25-a911-4170-8967-24376207a63a.png')" 
        }}
      >
        {/* Overlay with increased opacity for better text visibility */}
        <div className="absolute inset-0 bg-black bg-opacity-40 z-0"></div>
      </div>

      {/* Content */}
      <div className="container-custom relative z-10 text-center text-white mt-16">
        <h1 className="font-mont text-5xl md:text-7xl font-light tracking-wide mb-6">
          Bienvenido a CASA
        </h1>
        <p className="text-xl md:text-2xl max-w-3xl mx-auto font-light">
          Un espacio de amor, inclusión y esperanza para todos
        </p>
      </div>
    </div>
  );
}
