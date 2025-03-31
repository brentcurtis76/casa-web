
import { Card, CardContent } from "@/components/ui/card";
import { PrayerRequestForm } from "@/components/prayers/PrayerRequestForm";

export function Oracion() {
  return (
    <section id="oracion" className="section">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-casa-700 mb-6">
              Peticiones de Oración
            </h2>
            <p className="text-lg mb-8">
              En CASA creemos en el poder de la oración compartida. Comparte tus peticiones con nuestra comunidad y juntos las llevaremos ante Dios.
            </p>
            
            <div className="flex flex-col space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-casa-100 text-casa-600 flex-shrink-0">
                  <span className="text-xl">🙏</span>
                </div>
                <div>
                  <h3 className="font-medium">Confidencialidad</h3>
                  <p className="text-muted-foreground">Tus peticiones serán tratadas con absoluta confidencialidad y respeto.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-casa-100 text-casa-600 flex-shrink-0">
                  <span className="text-xl">❤️</span>
                </div>
                <div>
                  <h3 className="font-medium">Comunidad en Oración</h3>
                  <p className="text-muted-foreground">Nuestro equipo de oración estará intercediendo por tus necesidades.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-casa-100 text-casa-600 flex-shrink-0">
                  <span className="text-xl">✨</span>
                </div>
                <div>
                  <h3 className="font-medium">Esperanza Renovada</h3>
                  <p className="text-muted-foreground">Cree con nosotros que hay poder en la oración comunitaria y en la fe compartida.</p>
                </div>
              </div>
            </div>
          </div>
          
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <PrayerRequestForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
