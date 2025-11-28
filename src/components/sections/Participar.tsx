import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, BookOpen, Music, HomeIcon, BookOpen as BookIcon } from "lucide-react";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

interface ActivityCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

function ActivityCard({ title, description, icon }: ActivityCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{
        y: -8,
        transition: { type: "spring", stiffness: 300 }
      }}
    >
      <Card className="h-full border-none bg-white/80 backdrop-blur-sm shadow-elevated hover:shadow-dramatic transition-all duration-300 rounded-2xl overflow-hidden group">
        <CardHeader className="pb-3">
          <motion.div
            className="w-14 h-14 flex items-center justify-center mb-5 rounded-xl bg-gradient-to-br from-casa-100 to-casa-50 text-casa-700 group-hover:from-amber-100 group-hover:to-amber-50 group-hover:text-amber-700 transition-all duration-300"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {icon}
          </motion.div>
          <CardTitle className="text-xl font-medium text-casa-800 group-hover:text-casa-900 transition-colors">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base text-casa-600 leading-relaxed">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function Participar() {
  const activities = [
    {
      title: "La Hora",
      description: "Cada domingo, nuestros pequeños exploran historias bíblicas a través de actividades dinámicas y reflexivas, adaptadas a sus edades. En un ambiente seguro y amoroso, fomentamos la curiosidad, el compartir y el crecimiento espiritual. ¡Todos son bienvenidos!",
      icon: <Users size={26} />
    },
    {
      title: "Scouts",
      description: "Hace más de 15 años que nuestra comunidad cuenta con un excelente grupo Scout llamado Hanu O Atua. Puedes encontrarlos cada sábado a partir de las 3:30 P.M. en la plaza Ossandon. En este entorno los chicos forjan amistades que durarán toda la vida y aprenden valores que guiarán sus decisiones.",
      icon: <MapPin size={26} />
    },
    {
      title: "Camino a Emaús",
      description: "Una o dos veces al año, nos sumergimos en el retiro 'Camino a Emaús', un viaje transformador para redescubrir la espiritualidad de Jesús desde perspectivas frescas y renovadoras. Una oportunidad única para profundizar en la fe y conectarse íntimamente con su mensaje.",
      icon: <BookOpen size={26} />
    },
    {
      title: "Música",
      description: "Cada domingo, nuestro dedicado equipo de música guía el canto, elevando corazones y voces en alabanza unificada. Además, preparan con pasión los 'Respira', fusionando melodías y reflexiones para una experiencia espiritual enriquecedora.",
      icon: <Music size={26} />
    },
    {
      title: "Grupos En CASA",
      description: "Dos veces al mes, los Grupos en CASA se reúnen para compartir vivencias y profundizar en la espiritualidad de Jesús. Es un espacio íntimo y cálido donde la comunidad se fortalece, explorando juntos la fe y apoyándose en el camino de la vida.",
      icon: <HomeIcon size={26} />
    },
    {
      title: "Cursos",
      description: "Semanalmente, ofrecemos cursos presenciales diseñados para equiparte en tu camino. Estas sesiones interactivas brindan herramientas y perspectivas valiosas, fortaleciendo nuestra fe colectiva mientras aprendemos juntos en comunidad.",
      icon: <BookIcon size={26} />
    }
  ];

  return (
    <section id="participar" className="section bg-gradient-to-b from-casa-50 to-white noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-amber-100/30 to-transparent rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-radial from-casa-100/40 to-transparent rounded-full blur-2xl opacity-40" />
      <div className="absolute top-40 left-10 w-20 h-20 border border-amber-200/30 rounded-full opacity-40" />
      <div className="absolute bottom-32 right-20 w-3 h-20 bg-gradient-to-b from-casa-200/30 to-transparent" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-amber-400/60" />
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-amber-400/60" />
          </motion.div>

          <motion.h2
            className="heading-dramatic font-light text-casa-800 mb-6"
            variants={itemVariants}
          >
            Sé parte de CASA
          </motion.h2>

          <motion.p
            className="text-xl text-casa-600 max-w-2xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            En CASA hay muchas maneras de estar y participar. Explora la que más te acomode a ti.
          </motion.p>
        </motion.div>

        {/* Activities Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {activities.map((activity) => (
            <ActivityCard
              key={activity.title}
              title={activity.title}
              description={activity.description}
              icon={activity.icon}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
