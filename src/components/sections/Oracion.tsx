
import { Card, CardContent } from "@/components/ui/card";
import { PrayerRequestForm } from "@/components/prayers/PrayerRequestForm";
import { LockKeyhole, Users, Sparkles } from 'lucide-react';
import { motion } from "framer-motion";

const features = [
  {
    icon: LockKeyhole,
    title: "Confidencialidad",
    description: "Tus peticiones serán tratadas con absoluta confidencialidad y respeto."
  },
  {
    icon: Users,
    title: "Comunidad en Oración",
    description: "Nuestro equipo de oración estará intercediendo por tus necesidades."
  },
  {
    icon: Sparkles,
    title: "Esperanza Renovada",
    description: "Cree con nosotros que hay poder en la oración comunitaria y en la fe compartida."
  }
];

export function Oracion() {
  return (
    <section id="oracion" className="section bg-casa-50">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2
              className="text-3xl md:text-4xl font-light text-casa-800 mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Peticiones de Oración
            </motion.h2>
            <motion.p
              className="text-lg mb-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              En CASA creemos en el poder de la oración compartida. Comparte tus peticiones con nuestra comunidad y juntos las llevaremos ante Dios.
            </motion.p>

            <div className="flex flex-col space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  className="flex items-start space-x-4"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <motion.div
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-casa-100 text-casa-600 flex-shrink-0"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <feature.icon size={20} />
                  </motion.div>
                  <div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <PrayerRequestForm />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
