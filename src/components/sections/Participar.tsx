import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, MapPin, BookOpen, Music, Coffee, BookOpen as BookIcon, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { SignupFormGrupos } from "../home/SignupFormGrupos";
import { SignupFormLectura } from "../home/SignupFormLectura";
import { SignupFormApoyo } from "../home/SignupFormApoyo";

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
  onClick?: () => void;
  cta?: string;
}

function ActivityCard({ title, description, icon, onClick, cta }: ActivityCardProps) {
  const isClickable = !!onClick;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{
        y: -8,
        transition: { type: "spring", stiffness: 300 }
      }}
    >
      <Card
        className={`h-full border-none bg-white/80 backdrop-blur-sm shadow-elevated hover:shadow-dramatic transition-all duration-300 rounded-2xl overflow-hidden group ${isClickable ? "cursor-pointer" : ""}`}
        onClick={onClick}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        } : undefined}
      >
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
          {cta && (
            <p className="text-sm font-medium text-amber-700 mt-3">
              {cta} →
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

type DialogType = 'grupos' | 'lectura' | 'apoyo' | null;

export function Participar() {
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const closeDialog = () => setOpenDialog(null);

  const activities = [
    {
      title: "Grupos en CASA",
      description: "En abril comenzamos un nuevo ciclo de grupos comunitarios. Un espacio para crecer juntos en fe y amistad, reuniéndonos quincenalmente en hogares de Las Condes y La Reina. ¡Es un excelente momento para sumarte!",
      icon: <Users size={26} />,
      signupType: 'grupos' as DialogType,
    },
    {
      title: "La Hora",
      description: "Cada domingo, nuestros pequeños exploran historias bíblicas a través de actividades dinámicas y reflexivas, adaptadas a sus edades. En un ambiente seguro y amoroso, fomentamos la curiosidad, el compartir y el crecimiento espiritual. ¡Todos son bienvenidos!",
      icon: <Users size={26} />,
      signupType: null as DialogType,
    },
    {
      title: "Scouts",
      description: "Hace más de 15 años que nuestra comunidad cuenta con un excelente grupo Scout llamado Hanu O Atua. Puedes encontrarlos cada sábado a partir de las 3:30 P.M. en la plaza Ossandon. En este entorno los chicos forjan amistades que durarán toda la vida y aprenden valores que guiarán sus decisiones.",
      icon: <MapPin size={26} />,
      signupType: null as DialogType,
    },
    {
      title: "Grupo de Apoyo Psicoemocional",
      description: "Ofrecemos dos grupos semanales moderados por la psicóloga Paz Costagliola: jueves de 19:00 a 21:00 hrs y martes de 10:00 a 12:00 hrs. Un espacio seguro para hablar, ser escuchado y sentirte acompañado. No estás solo/a.",
      icon: <Heart size={26} />,
      signupType: 'apoyo' as DialogType,
    },
    {
      title: "Música",
      description: "Cada domingo, nuestro dedicado equipo de música guía el canto, elevando corazones y voces en alabanza unificada. Además, preparan con pasión los 'Respira', fusionando melodías y reflexiones para una experiencia espiritual enriquecedora.",
      icon: <Music size={26} />,
      signupType: null as DialogType,
    },
    {
      title: "Desayuno de Hombres",
      description: "Una vez al mes, un domingo a las 9:30 hrs, los hombres de la comunidad están invitados a un desayuno donde conversamos temas relevantes a lo que significa ser un hombre que sigue a Cristo en los tiempos que vivimos.",
      icon: <Coffee size={26} />,
      signupType: null as DialogType,
    },
    {
      title: "Club de Lectura",
      description: "Cada dos meses leemos un libro que nos desafía en nuestro caminar con Cristo. Es un espacio online para incluir a quienes están fuera de Santiago. En abril comenzamos El Cristo Universal de Richard Rohr.",
      icon: <BookIcon size={26} />,
      signupType: 'lectura' as DialogType,
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
              onClick={activity.signupType ? () => setOpenDialog(activity.signupType) : undefined}
              cta={activity.signupType ? "Inscribirme" : undefined}
            />
          ))}
        </motion.div>
      </div>

      {/* Dialog: Grupos en CASA */}
      <Dialog open={openDialog === 'grupos'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-serif tracking-normal">
              Grupos en CASA
            </DialogTitle>
            <DialogDescription className="text-center">
              Completa el formulario para inscribirte en un grupo comunitario.
            </DialogDescription>
          </DialogHeader>
          <SignupFormGrupos onSuccess={closeDialog} />
        </DialogContent>
      </Dialog>

      {/* Dialog: Club de Lectura */}
      <Dialog open={openDialog === 'lectura'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-serif tracking-normal">
              Club de Lectura
            </DialogTitle>
            <DialogDescription className="text-center">
              Inscríbete en nuestro club de lectura: El Cristo Universal — Richard Rohr.
            </DialogDescription>
          </DialogHeader>
          <SignupFormLectura onSuccess={closeDialog} />
        </DialogContent>
      </Dialog>

      {/* Dialog: Apoyo Psicoemocional */}
      <Dialog open={openDialog === 'apoyo'} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-serif tracking-normal">
              Grupo de Apoyo Psicoemocional
            </DialogTitle>
            <DialogDescription className="text-center">
              Selecciona tu horario preferido y completa el formulario.
            </DialogDescription>
          </DialogHeader>
          <SignupFormApoyo onSuccess={closeDialog} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
