
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function RetiroSemanaSanta() {
  return (
    <section id="retiro" className="section bg-white">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 relative h-[400px] rounded-lg overflow-hidden shadow-xl">
            <img 
              alt="Retiro Semana Santa" 
              className="absolute inset-0 w-full h-full object-cover" 
              src="/lovable-uploads/92c3ec9a-16cb-405a-86d6-0914b11e5f70.jpg" 
            />
          </div>
          
          <div className="order-1 md:order-2 prose prose-lg max-w-none">
            <h2 className="text-3xl md:text-4xl font-light text-casa-800 mb-6">
              Participa en nuestro retiro de Semana Santa
            </h2>
            <p className="text-casa-700">
              Esta Semana Santa, en CASA, viviremos un retiro especial desde el Viernes Santo, 18 de abril, hasta después del almuerzo del domingo 20 de abril. Será un tiempo único para profundizar nuestra fe, reflexionar juntos y conectar con el amor incondicional que nos une como comunidad.
            </p>
            <p className="text-casa-700">
              Habrá actividades significativas para todas las edades y grupos, asegurando que cada persona encuentre un espacio para crecer, compartir y sentirse vista y valorada. Este retiro será uno de los momentos más importantes en la vida de nuestra comunidad este año, una oportunidad para detenernos, escuchar y experimentar a Dios de una manera viva y transformadora. ¡Te invitamos a vivir esta experiencia con nosotros!
            </p>
            
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-2 text-casa-700">
                <span className="font-medium">Lugar:</span> Centro de Espiritualidad Loyola - Av. José Luis Caro 210, Padre Hurtado, Región Metropolitana
              </div>
              <div className="flex items-center gap-2 text-casa-700">
                <span className="font-medium">Fecha:</span> 18/04 17:00 hrs - 20/04 15:00 hrs
              </div>
              <div className="flex items-center gap-2 text-casa-700">
                <span className="font-medium">Costo:</span> $70.000 adultos y $40.000 niños
              </div>
            </div>
            
            <div className="mt-8">
              <Button asChild className="bg-casa-700 hover:bg-casa-800">
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSet_iWuMAQIjZeSidQnwKUiW1ztsYuCd3nuEnW5_hw1O6X-1A/viewform" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  Inscríbete aquí <ExternalLink size={16} />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
