
import { MoveRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRef } from "react";

function Hero() {
  const participarRef = useRef<HTMLDivElement>(null);
  
  const scrollToParticipar = () => {
    const participarSection = document.getElementById('participar');
    if (participarSection) {
      participarSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  
  return (
    <section className="w-full py-20 lg:py-40" aria-labelledby="hero-heading">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 items-center md:grid-cols-2">
          <div className="flex gap-4 flex-col">
            <div>
              <Badge variant="outline">Bienvenido a CASA</Badge>
            </div>
            <div className="flex gap-4 flex-col">
              <h1 id="hero-heading" className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-regular">
                Un espacio de amor, inclusión y esperanza para todos
              </h1>
              <p className="text-xl leading-relaxed tracking-tight text-muted-foreground max-w-md text-left">
                Una comunidad abierta, inspirada en Jesús, donde cada persona es vista y celebrada 
                en su singularidad; un espacio seguro para explorar tu espiritualidad, crecer con otros y vivir con propósito.
              </p>
            </div>
            <div className="flex flex-row gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-4" variant="outline" aria-label="Ver ubicación de la iglesia">
                    Visítanos <MapPin className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuestras Liturgias</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div>
                      <h3 className="font-medium">Día y Hora</h3>
                      <p className="text-muted-foreground">Domingos, 11:00 AM</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Dirección</h3>
                      <p className="text-muted-foreground">Vicente Pérez Rosales 1765, La Reina, Santiago</p>
                    </div>
                    <div className="mt-2">
                      <iframe 
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3329.938189752371!2d-70.5666986!3d-33.4207245!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9662cfa94f2e7d41%3A0x8e14039b12e5c74b!2sVicente%20P%C3%A9rez%20Rosales%201765%2C%20La%20Reina%2C%20Regi%C3%B3n%20Metropolitana!5e0!3m2!1ses!2scl!4v1719528142344!5m2!1ses!2scl" 
                        width="100%" 
                        height="300" 
                        style={{border: 0}} 
                        allowFullScreen 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Mapa de ubicación de la Iglesia CASA"
                        aria-label="Mapa de Google con la ubicación de la Iglesia CASA en Vicente Pérez Rosales 1765, La Reina, Santiago"
                      >
                      </iframe>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                size="lg" 
                className="gap-4" 
                onClick={scrollToParticipar}
                aria-label="Ir a la sección de participación"
              >
                Participa <MoveRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                alt="Iglesia CASA con cruz en su edificio" 
                className="w-full h-full object-cover" 
                src="/lovable-uploads/80737c28-0e51-41ab-9749-01bc313de2a8.jpg"
                loading="eager"
                width="400"
                height="400"
              />
            </div>
            <div className="bg-muted rounded-md row-span-2 overflow-hidden">
              <img 
                alt="Niño y adulto interactuando en la comunidad de CASA" 
                src="/lovable-uploads/5902a974-c6e8-4fe6-aa5c-0a33eb6dce5c.png" 
                className="w-full h-full object-contain"
                loading="eager" 
                width="400"
                height="800"
              />
            </div>
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                src="/lovable-uploads/26b28f0b-f024-4f8d-98e8-52227c068246.png" 
                alt="Personas abrazándose en un momento de comunidad en CASA" 
                className="w-full h-full object-cover"
                loading="eager"
                width="400"
                height="400"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Hero };
