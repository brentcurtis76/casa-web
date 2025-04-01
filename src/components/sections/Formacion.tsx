import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
export function Formacion() {
  return <section id="formacion" className="section bg-casa-50">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="prose prose-lg max-w-none">
            <h2 className="text-3xl md:text-4xl font-light text-casa-800 mb-6">
              Inscríbete en nuestra formación Bienvenidos a La Familia
            </h2>
            <p className="text-casa-700">
              Bienvenidos a La Familia de CASA es un programa diseñado para quienes desean conocer más sobre nuestra comunidad y descubrir respuestas a preguntas clave como: ¿Quién somos?, ¿De dónde venimos?, ¿Hacia dónde vamos?, y ¿Cuál es mi lugar en CASA?.
            </p>
            <p className="text-casa-700">
              A través de 6 sesiones bimensuales, que comenzarán en la segunda quincena de abril de 2025, exploraremos juntos nuestra historia, presente, visión de futuro y cómo cada persona puede encontrar un espacio significativo dentro de nuestra familia espiritual.
            </p>
            <p className="text-casa-700">
              Es una invitación a ser parte activa de este hogar donde celebramos la singularidad de cada individuo y caminamos juntos en el amor, la inclusión y la fe en Jesucrito. ¡Te esperamos con los brazos abiertos!
            </p>
            
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-2 text-casa-700">
                <span className="font-medium">Lugar:</span> Iglesia Anglicana San Andrés
              </div>
              <div className="flex items-center gap-2 text-casa-700">
                <span className="font-medium">Duración:</span> 6 sesiones bimensuales de 2 horas C/U
              </div>
            </div>
            
            <div className="mt-8">
              <Button asChild className="bg-casa-700 hover:bg-casa-800">
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSdxmlALgHhB4dgxlQ92bYIE9VFxS1pU-n6abRfYr2aRPyDgew/viewform" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  Inscríbete aquí <ExternalLink size={16} />
                </a>
              </Button>
            </div>
          </div>
          
          <div className="relative h-[400px] rounded-lg overflow-hidden shadow-xl">
            <img alt="Formación Bienvenidos a La Familia" className="absolute inset-0 w-full h-full object-cover" src="/lovable-uploads/a02c439d-5a66-4b2f-8bd0-7897d174069f.jpg" />
          </div>
        </div>
      </div>
    </section>;
}