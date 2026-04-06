import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, BookOpen, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignupFormGrupos } from './SignupFormGrupos';
import { SignupFormLectura } from './SignupFormLectura';
import { SignupFormApoyo } from './SignupFormApoyo';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

type DialogType = 'grupos' | 'lectura' | 'apoyo' | null;

export function InscripcionesSection() {
  const [openDialog, setOpenDialog] = useState<DialogType>(null);

  const closeDialog = () => setOpenDialog(null);

  return (
    <section className="section bg-gradient-to-b from-casa-800 to-casa-900 noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-amber-900/20 to-transparent rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-radial from-casa-700/30 to-transparent rounded-full blur-2xl opacity-40" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
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
            className="heading-dramatic font-light text-white mb-6"
            variants={itemVariants}
          >
            Inscripciones
          </motion.h2>

          <motion.p
            className="text-xl text-casa-300 max-w-2xl mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Inscribete en nuestros programas comunitarios. Completa el formulario y te contactaremos pronto.
          </motion.p>
        </motion.div>

        {/* Cards Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Card 1: Grupos en CASA */}
          <motion.div
            variants={cardVariants}
            whileHover={{
              y: -8,
              transition: { type: 'spring', stiffness: 300 },
            }}
          >
            <Card className="h-full border-none bg-casa-700/50 backdrop-blur-sm shadow-elevated hover:shadow-dramatic transition-all duration-300 rounded-2xl overflow-hidden group">
              <CardHeader className="pb-3">
                <motion.div
                  className="w-14 h-14 flex items-center justify-center mb-5 rounded-xl bg-gradient-to-br from-amber-800/40 to-amber-900/30 text-amber-400 group-hover:from-amber-700/50 group-hover:to-amber-800/40 transition-all duration-300"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <Users size={26} />
                </motion.div>
                <CardTitle className="text-xl font-medium text-white group-hover:text-amber-200 transition-colors">
                  Grupos en CASA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-base text-casa-300 leading-relaxed">
                  Unete a nuestros grupos de comunidad en distintas comunas de Santiago. Un espacio para crecer juntos en fe y amistad.
                </CardDescription>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-amber-900/30 text-amber-300 border-amber-700/50">
                    Las Condes
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-900/30 text-amber-300 border-amber-700/50">
                    La Reina
                  </Badge>
                </div>
                <Button
                  onClick={() => setOpenDialog('grupos')}
                  className="w-full bg-[#D4A853] hover:bg-[#B8923D] text-white"
                >
                  Inscribirme
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Club de Lectura */}
          <motion.div
            variants={cardVariants}
            whileHover={{
              y: -8,
              transition: { type: 'spring', stiffness: 300 },
            }}
          >
            <Card className="h-full border-none bg-casa-700/50 backdrop-blur-sm shadow-elevated hover:shadow-dramatic transition-all duration-300 rounded-2xl overflow-hidden group">
              <CardHeader className="pb-3">
                <motion.div
                  className="w-14 h-14 flex items-center justify-center mb-5 rounded-xl bg-gradient-to-br from-amber-800/40 to-amber-900/30 text-amber-400 group-hover:from-amber-700/50 group-hover:to-amber-800/40 transition-all duration-300"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <BookOpen size={26} />
                </motion.div>
                <CardTitle className="text-xl font-medium text-white group-hover:text-amber-200 transition-colors">
                  Club de Lectura
                </CardTitle>
                <p className="text-sm text-amber-400 font-medium">
                  El Cristo Universal — Richard Rohr
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-base text-casa-300 leading-relaxed">
                  Cada semestre leemos un libro que nos desafia en nuestro caminar con Cristo. Un espacio de reflexion y dialogo abierto a todos.
                </CardDescription>
                <Button
                  onClick={() => setOpenDialog('lectura')}
                  className="w-full bg-[#D4A853] hover:bg-[#B8923D] text-white"
                >
                  Inscribirme
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 3: Grupo de Apoyo Psicoemocional */}
          <motion.div
            variants={cardVariants}
            whileHover={{
              y: -8,
              transition: { type: 'spring', stiffness: 300 },
            }}
          >
            <Card className="h-full border-none bg-casa-700/50 backdrop-blur-sm shadow-elevated hover:shadow-dramatic transition-all duration-300 rounded-2xl overflow-hidden group">
              <CardHeader className="pb-3">
                <motion.div
                  className="w-14 h-14 flex items-center justify-center mb-5 rounded-xl bg-gradient-to-br from-amber-800/40 to-amber-900/30 text-amber-400 group-hover:from-amber-700/50 group-hover:to-amber-800/40 transition-all duration-300"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <Heart size={26} />
                </motion.div>
                <CardTitle className="text-xl font-medium text-white group-hover:text-amber-200 transition-colors">
                  Grupo de Apoyo Psicoemocional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-base text-casa-300 leading-relaxed">
                  Un espacio seguro para quienes sienten que la vida pesa demasiado. Aqui puedes hablar, ser escuchado y sentirte acompanado.
                </CardDescription>
                <div className="space-y-1 text-sm text-casa-300">
                  <p className="flex items-center gap-2">
                    <span className="text-amber-400 font-medium">Jueves</span> 19:00 - 21:00 hrs
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-amber-400 font-medium">Martes</span> 10:00 - 12:00 hrs
                  </p>
                </div>
                <Button
                  onClick={() => setOpenDialog('apoyo')}
                  className="w-full bg-[#D4A853] hover:bg-[#B8923D] text-white"
                >
                  Inscribirme
                </Button>
              </CardContent>
            </Card>
          </motion.div>
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
              Inscribete en nuestro club de lectura: El Cristo Universal — Richard Rohr.
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
