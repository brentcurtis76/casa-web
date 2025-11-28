
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, BookOpen, Music, HomeIcon, BookOpen as BookIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ActivityCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}

function ActivityCard({ title, description, icon, index }: ActivityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1,
        ease: "easeOut" 
      }}
      viewport={{ once: true }}
    >
      <Card className="h-full border-none shadow-none hover:bg-casa-50 transition-colors">
        <CardHeader className="pb-2">
          <motion.div 
            className="w-12 h-12 flex items-center justify-center mb-6 text-casa-800"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.div>
          <CardTitle className="text-xl font-medium text-casa-800">{title}</CardTitle>
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
      icon: <Users size={24} className="text-casa-800" />
    },
    {
      title: "Scouts",
      description: "Hace más de 15 años que nuestra comunidad cuenta con un excelente grupo Scout llamado Hanu O Atua. Puedes encontrarlos cada sábado a partir de las 3:30 P.M. en la plaza Ossandon. En este entorno los chicos forjan amistades que durarán toda la vida y aprenden valores que guiarán sus decisiones.",
      icon: <MapPin size={24} className="text-casa-800" />
    },
    {
      title: "Camino a Emaús",
      description: "Una o dos veces al año, nos sumergimos en el retiro 'Camino a Emaús', un viaje transformador para redescubrir la espiritualidad de Jesús desde perspectivas frescas y renovadoras. Una oportunidad única para profundizar en la fe y conectarse íntimamente con su mensaje.",
      icon: <BookOpen size={24} className="text-casa-800" />
    },
    {
      title: "Música",
      description: "Cada domingo, nuestro dedicado equipo de música guía el canto, elevando corazones y voces en alabanza unificada. Además, preparan con pasión los 'Respira', fusionando melodías y reflexiones para una experiencia espiritual enriquecedora.",
      icon: <Music size={24} className="text-casa-800" />
    },
    {
      title: "Grupos En CASA",
      description: "Dos veces al mes, los Grupos en CASA se reúnen para compartir vivencias y profundizar en la espiritualidad de Jesús. Es un espacio íntimo y cálido donde la comunidad se fortalece, explorando juntos la fe y apoyándose en el camino de la vida.",
      icon: <HomeIcon size={24} className="text-casa-800" />
    },
    {
      title: "Cursos",
      description: "Semanalmente, ofrecemos cursos presenciales diseñados para equiparte en tu camino. Estas sesiones interactivas brindan herramientas y perspectivas valiosas, fortaleciendo nuestra fe colectiva mientras aprendemos juntos en comunidad.",
      icon: <BookIcon size={24} className="text-casa-800" />
    }
  ];

  return (
    <section id="participar" className="section bg-casa-50">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-light text-center text-casa-800 mb-8">
            Sé parte de CASA
          </h2>
          <p className="text-lg text-center text-casa-600 max-w-2xl mx-auto mb-16">
            En CASA hay muchas maneras de estar y participar. Explora la que más te acomode a ti.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
          {activities.map((activity, index) => (
            <ActivityCard
              key={activity.title}
              title={activity.title}
              description={activity.description}
              icon={activity.icon}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
