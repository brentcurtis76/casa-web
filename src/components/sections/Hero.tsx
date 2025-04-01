
import { Button } from '@/components/ui/button';
import { ImagesSlider } from '@/components/ui/images-slider';
import { motion } from 'framer-motion';

export function Hero() {
  // Updated image paths with the newly uploaded images
  const images = [
    "/lovable-uploads/b62bc067-c77b-4afc-9abe-20a7167432a9.png",
    "/lovable-uploads/46ebbb38-7488-4df5-b6f4-09496189d80d.png",
    "/lovable-uploads/2f54e668-5a35-4f9c-82b5-89ee945afc91.png",
    "/lovable-uploads/344b7408-ade9-406e-ba5d-5fe5bf9e16cd.png",
    "/lovable-uploads/e1b65cc9-5c46-444a-a3ce-2617b4276cd4.png"
  ];

  return (
    <div className="relative min-h-screen">
      <ImagesSlider 
        images={images}
        className="min-h-screen"
        autoplay={true}
        direction="up"
        overlayClassName="bg-black/50"
      >
        <motion.div
          initial={{
            opacity: 0,
            y: -80,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.6,
          }}
          className="z-50 flex flex-col justify-center items-center"
        >
          <motion.h1 
            className="font-mont text-5xl md:text-7xl font-light tracking-wide mb-6 text-center bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-300"
          >
            Bienvenido a CASA
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl max-w-3xl mx-auto font-light text-center text-white/90 mb-8"
          >
            Un espacio de amor, inclusión y esperanza para todos
          </motion.p>
          <Button 
            className="bg-casa-800/90 hover:bg-casa-800 text-white px-6 py-6 rounded-full text-lg border border-white/20 hover:scale-105 transition-all"
          >
            Conócenos →
          </Button>
        </motion.div>
      </ImagesSlider>
    </div>
  );
}
