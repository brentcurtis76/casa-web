import { motion } from "framer-motion";

export function Proposito() {
  return (
    <section id="proposito" className="section bg-casa-50">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-casa-700 mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              Sentido & Propósito
            </motion.h2>
            <div className="prose prose-lg">
              <motion.p
                className="mb-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                Nuestra CASA surge como un faro de inclusión, igualdad y amor incondicional. Fundados en la visión de un cristianismo renovado y acogedor, nos esforzamos por ser un refugio para aquellos en busca de una espiritualidad que valora y celebra nuestras singularidades.
              </motion.p>
              <motion.p
                className="mb-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                En CASA, creemos que la fe es una conversación en constante evolución, permitiéndonos reflejar una imagen de Dios compasiva y llena de gracia.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
              >
                Podríamos contarte más sobre lo que creemos, pero pensamos que la mejor forma de averiguarlo es conociéndonos. ¡Ven a visitarnos!
              </motion.p>
            </div>
          </div>
          <motion.div
            className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
          >
            <img
              alt="Comunidad CASA"
              className="absolute inset-0 w-full h-full object-cover"
              src="/lovable-uploads/edce4927-d243-4828-83bc-9bd3c8d52b8f.jpg"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
