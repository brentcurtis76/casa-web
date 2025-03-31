
export function Proposito() {
  return (
    <section id="proposito" className="section bg-secondary/50">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-casa-700 mb-6">
              Sentido & Propósito
            </h2>
            <div className="prose prose-lg">
              <p className="mb-4">
                Nuestra CASA surge como un faro de inclusión, igualdad y amor incondicional. Fundados en la visión de un cristianismo renovado y acogedor, nos esforzamos por ser un refugio para aquellos en busca de una espiritualidad que valora y celebra nuestras singularidades.
              </p>
              <p className="mb-4">
                En CASA, creemos que la teología es una conversación en constante evolución, permitiéndonos reflejar una imagen de Dios más compasiva y acogedora.
              </p>
              <p>
                Podríamos contarte más sobre lo que creemos, pero pensamos que la mejor forma de averiguarlo es conociéndonos. ¡Ven a visitarnos!
              </p>
            </div>
          </div>
          <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-xl">
            <img 
              src="/lovable-uploads/4590165d-08cf-4cf7-8a81-482f0ebbf654.png" 
              alt="Comunidad CASA" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
