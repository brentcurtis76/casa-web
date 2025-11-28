import { Mail, MapPin, Phone, Instagram, Youtube, Facebook } from "lucide-react";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export function Footer() {
  return (
    <footer className="bg-casa-800 text-white pt-20 pb-8 relative overflow-hidden">
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-32 h-32 border border-casa-700/50 rounded-full opacity-30" />
      <div className="absolute bottom-32 left-10 w-20 h-20 border border-casa-700/40 rounded-full opacity-20" />

      <div className="container-custom relative z-10">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Brand Column */}
          <motion.div variants={itemVariants}>
            <div className="mb-6">
              <motion.img
                alt="CASA Logo"
                className="h-16 w-auto"
                src="/lovable-uploads/675de6a8-e016-487d-87ce-0c956d83bdc3.png"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            </div>
            <p className="text-casa-300 mb-8 leading-relaxed">
              Un espacio de amor, inclusión y esperanza para todos. Donde cada persona es bienvenida tal como es.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-4">
              <motion.a
                href="https://www.instagram.com/casa_iach/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-casa-700/50 flex items-center justify-center text-casa-300 hover:bg-amber-500/20 hover:text-amber-400 transition-all duration-300"
                whileHover={{ scale: 1.1, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Instagram className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="https://www.youtube.com/@casaiach"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-casa-700/50 flex items-center justify-center text-casa-300 hover:bg-amber-500/20 hover:text-amber-400 transition-all duration-300"
                whileHover={{ scale: 1.1, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Youtube className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="https://www.facebook.com/casaiach"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-casa-700/50 flex items-center justify-center text-casa-300 hover:bg-amber-500/20 hover:text-amber-400 transition-all duration-300"
                whileHover={{ scale: 1.1, y: -2 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Facebook className="w-5 h-5" />
              </motion.a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={itemVariants}>
            <h4 className="font-medium text-lg mb-6 text-white flex items-center gap-2">
              <span className="w-6 h-px bg-amber-400/60" />
              Enlaces Rápidos
            </h4>
            <ul className="space-y-3">
              {[
                { href: "#proposito", label: "Sentido & Propósito" },
                { href: "#equipo", label: "Equipo y Liderazgo" },
                { href: "#mesa-abierta", label: "La Mesa Abierta" },
                { href: "#sermones", label: "Reflexiones" },
                { href: "#participar", label: "Participar" },
                { href: "#eventos", label: "Eventos" },
                { href: "#oracion", label: "Oración" },
              ].map((link) => (
                <li key={link.href}>
                  <motion.a
                    href={link.href}
                    className="text-casa-300 hover:text-amber-400 transition-colors duration-300 inline-flex items-center gap-2 group"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <span className="w-0 h-px bg-amber-400 group-hover:w-3 transition-all duration-300" />
                    {link.label}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Schedule */}
          <motion.div variants={itemVariants}>
            <h4 className="font-medium text-lg mb-6 text-white flex items-center gap-2">
              <span className="w-6 h-px bg-amber-400/60" />
              Horarios
            </h4>
            <div className="space-y-5">
              <div className="group">
                <p className="font-medium text-white group-hover:text-amber-400 transition-colors">
                  Liturgia Dominical
                </p>
                <p className="text-casa-300">Domingos 11:00 AM</p>
              </div>
              <div className="group">
                <p className="font-medium text-white group-hover:text-amber-400 transition-colors">
                  Grupos en CASA
                </p>
                <p className="text-casa-300">Jueves por medio 7:00 PM</p>
              </div>
              <div className="group">
                <p className="font-medium text-white group-hover:text-amber-400 transition-colors">
                  Oficina
                </p>
                <p className="text-casa-300">Lunes a Viernes con cita previa</p>
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div variants={itemVariants}>
            <h4 className="font-medium text-lg mb-6 text-white flex items-center gap-2">
              <span className="w-6 h-px bg-amber-400/60" />
              Contacto
            </h4>
            <ul className="space-y-4">
              <motion.li
                className="flex group cursor-pointer"
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="w-10 h-10 rounded-lg bg-casa-700/50 flex items-center justify-center mr-4 flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <MapPin className="h-5 w-5 text-casa-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="text-casa-300 group-hover:text-casa-200 transition-colors">
                  Av. Vicente Pérez Rosales 1765, La Reina, Santiago
                </span>
              </motion.li>
              <motion.li
                className="flex group cursor-pointer"
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="w-10 h-10 rounded-lg bg-casa-700/50 flex items-center justify-center mr-4 flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <Phone className="h-5 w-5 text-casa-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="text-casa-300 group-hover:text-casa-200 transition-colors">
                  +56941623577
                </span>
              </motion.li>
              <motion.li
                className="flex group cursor-pointer"
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="w-10 h-10 rounded-lg bg-casa-700/50 flex items-center justify-center mr-4 flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <Mail className="h-5 w-5 text-casa-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="text-casa-300 group-hover:text-casa-200 transition-colors">
                  sanandres@iach.cl
                </span>
              </motion.li>
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          className="border-t border-casa-700/50 pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-casa-400 text-sm">
              &copy; {new Date().getFullYear()} CASA. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-2 text-casa-500 text-sm">
              <span className="w-2 h-2 bg-amber-400/60 rounded-full" />
              <span>Comunidad Anglicana San Andrés</span>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
