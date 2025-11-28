import { motion } from "framer-motion";

export function Equipo() {
  return (
    <section id="equipo" className="section bg-white">
      <div className="container-custom">
        <motion.h2
          className="text-3xl md:text-4xl font-light text-center text-casa-800 mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Equipo y Liderazgo
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Imágenes de la comunidad */}
          <div className="relative h-[400px] flex items-start justify-between flex-wrap">
            <motion.div
              className="w-[48%] h-[48%] overflow-hidden shadow-md rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <img alt="Comunidad CASA" className="object-cover w-full h-full" src="/lovable-uploads/6557351c-1481-42de-b3be-b9077ea618d7.png" />
            </motion.div>
            <motion.div
              className="w-[48%] h-[48%] overflow-hidden shadow-md rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <img alt="Comunidad CASA" className="object-cover w-full h-full" src="/lovable-uploads/8fb1b293-53ea-495a-8af0-80ca5e683c9b.png" />
            </motion.div>
            <motion.div
              className="w-[48%] h-[48%] mx-auto mt-4 overflow-hidden shadow-md rounded-lg"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <img src="/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png" alt="Comunidad CASA" className="object-cover w-full h-full" />
            </motion.div>
          </div>

          {/* Descripción del equipo pastoral */}
          <motion.div
            className="prose prose-lg max-w-none"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-light mb-4 text-casa-800">Equipo Pastoral</h3>
            <p className="text-casa-700">
              El acompañamiento espiritual de nuestra <strong>CASA</strong> reside en su apasionado Equipo Pastoral,
              liderado por Brent Curtis. A su lado, co-lideran Patricio Browne (que sigue como pastor
              titular ante la diócesis mientras dure el proceso de ordenación de Brent), Fiona Fraser,
              Claudia Araya, Arnoldo Cisternas, Mónica Van Ginderthaelen y Tomás Diéguez, cada uno
              aportando sus propias luces y perspectivas para enriquecer la misión de la iglesia.
            </p>
            <p className="text-casa-700">
              Eugenia Riffo gestiona con precisión y dedicación las áreas de Administración y Finanzas,
              garantizando la sostenibilidad y crecimiento de nuestra comunidad.
            </p>
          </motion.div>
        </div>

        {/* Concilio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Texto del concilio */}
          <motion.div
            className="prose prose-lg max-w-none"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-light mb-6 text-casa-800">Concilio</h3>
            <p className="text-casa-700">
              En cuanto a las decisiones y guías estratégicas, el Concilio de <strong>CASA</strong>, compuesto por
              Andrew Warren, Victor Córdova, Aurora Fontecilla, Anita Pinchart, Georgina García,
              Nevenka Echegaray, Mónica Van Gindertaelen, Melanie Sharman, Pablo Rebolledo y José Martínez,
              desempeña un papel crucial, velando por la integridad y el rumbo de nuestra comunidad.
              Juntos, cada miembro de nuestro equipo y concilio dedica su energía y amor para asegurar
              que <strong>CASA</strong> sea un hogar inclusivo, acogedor y en constante evolución.
            </p>
          </motion.div>

          {/* Imagen del concilio */}
          <motion.div
            className="aspect-video relative overflow-hidden rounded"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
          >
            <img alt="Concilio de CASA" className="w-full h-full object-cover" src="/lovable-uploads/92c3ec9a-16cb-405a-86d6-0914b11e5f70.jpg" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
