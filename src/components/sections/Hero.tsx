
import { Button } from '@/components/ui/button';
import { ImagesSlider } from '@/components/ui/images-slider';
import { motion } from 'framer-motion';

export function Hero() {
  // Update these image paths to the images you want to use
  const images = [
    "/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png",
    "/lovable-uploads/92c3ec9a-16cb-405a-86d6-0914b11e5f70.jpg",
    "/lovable-uploads/9ea1c3e6-66ec-4a6c-a94d-6eeb0f18d281.png"
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
