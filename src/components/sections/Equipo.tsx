
import { Card, CardContent } from "@/components/ui/card";
export function Equipo() {
  return <section id="equipo" className="section bg-white">
      <div className="container-custom">
        <h2 className="text-3xl md:text-4xl font-light text-center text-casa-800 mb-8">
          Equipo y Liderazgo
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Imágenes de la comunidad - con mejor distribución para ver las tres */}
          <div className="relative h-[400px] flex items-center justify-center">
            <div className="absolute left-0 top-0 w-[60%] h-[60%] overflow-hidden shadow-md rounded-lg z-10 transition-transform hover:scale-105">
              <img alt="Comunidad CASA" className="object-cover w-full h-full" src="/lovable-uploads/a8df8ec1-5023-4c67-8abb-52c3d59098cc.jpg" />
            </div>
            <div className="absolute right-0 top-[20%] w-[60%] h-[60%] overflow-hidden shadow-md rounded-lg z-20 transition-transform hover:scale-105">
              <img src="/lovable-uploads/4590165d-08cf-4cf7-8a81-482f0ebbf654.png" alt="Comunidad CASA" className="object-cover w-full h-full" />
            </div>
            <div className="absolute left-[20%] bottom-0 w-[60%] h-[60%] overflow-hidden shadow-md rounded-lg z-30 transition-transform hover:scale-105">
              <img src="/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png" alt="Comunidad CASA" className="object-cover w-full h-full" />
            </div>
          </div>

          {/* Descripción del equipo pastoral */}
          <div className="prose prose-lg max-w-none">
            <h3 className="text-2xl font-light mb-4 text-casa-800">Equipo Pastoral</h3>
            <p className="text-casa-700">
              El acompañamiento espiritual de nuestra <strong>CASA</strong> reside en su apasionado Equipo Pastoral, 
              liderado por Brent Curtis. A su lado, co-lideran Patricio Browne (que sigue como pastor 
              titular ante la diócesis mientras dure el proceso de ordenación de Brent), Fiona Fraser, 
              Claudia Araya y Arnoldo Cisternas, cada uno aportando sus propias luces y perspectivas 
              para enriquecer la misión de la iglesia.
            </p>
            <p className="text-casa-700">
              Eugenia Riffo gestiona con precisión y dedicación las áreas de Administración y Finanzas, 
              garantizando la sostenibilidad y crecimiento de nuestra comunidad.
            </p>
          </div>
        </div>

        {/* Concilio */}
        <div>
          <h3 className="text-2xl font-light mb-6 text-casa-800">Concilio</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Texto del concilio - ahora primero (izquierda) */}
            <div className="prose prose-lg max-w-none">
              <p className="text-casa-700">
                En cuanto a las decisiones y guías estratégicas, el Concilio de <strong>CASA</strong>, compuesto por 
                Andrew Warren, Victor Córdova, Aurora Fontecilla, Anita Pinchart, Georgina García, 
                Nevenka Echegaray, Mónica Van Gindertaelen, Melanie Sharman y Pablo Rebolledo, 
                desempeña un papel crucial, velando por la integridad y el rumbo de nuestra comunidad. 
                Juntos, cada miembro de nuestro equipo y concilio dedica su energía y amor para asegurar 
                que <strong>CASA</strong> sea un hogar inclusivo, acogedor y en constante evolución.
              </p>
            </div>
            
            {/* Imagen del concilio - ahora segundo (derecha) */}
            <div className="aspect-video relative overflow-hidden rounded">
              <img alt="Concilio de CASA" className="w-full h-full object-cover" src="/lovable-uploads/92c3ec9a-16cb-405a-86d6-0914b11e5f70.jpg" />
            </div>
          </div>
        </div>
      </div>
    </section>;
}
