
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
      participarSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 items-center md:grid-cols-2">
          <div className="flex gap-4 flex-col">
            <div>
              <Badge variant="outline">Bienvenido a CASA</Badge>
            </div>
            <div className="flex gap-4 flex-col">
              <h1 className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-regular">
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
                  <Button size="lg" className="gap-4" variant="outline">
                    Visítanos <MapPin className="w-4 h-4" />
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
                        style={{ border: 0 }} 
                        allowFullScreen 
                        loading="lazy" 
                        referrerPolicy="no-referrer-when-downgrade">
                      </iframe>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button size="lg" className="gap-4" onClick={scrollToParticipar}>
                Participa <MoveRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                src="/lovable-uploads/bf924b41-2c5a-41f6-9774-09c75868c107.png" 
                alt="Church building with cross" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-muted rounded-md row-span-2 overflow-hidden">
              <img 
                src="/lovable-uploads/8b822767-4e31-4760-b15e-264a2086a357.png" 
                alt="Child and adult interacting" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                src="/lovable-uploads/26b28f0b-f024-4f8d-98e8-52227c068246.png" 
                alt="People embracing" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
