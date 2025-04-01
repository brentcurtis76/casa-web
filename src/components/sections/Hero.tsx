
import { Button } from '@/components/ui/button';
import { ImagesSlider } from '@/components/ui/images-slider';
import { motion } from 'framer-motion';

export function Hero() {
  // Update these image paths to the images you want to use
  const images = [
    "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png",
    "/lovable-uploads/a8df8ec1-5023-4c67-8abb-52c3d59098cc.jpg",
    "/lovable-uploads/c7632011-97ff-46fc-8d5c-279a4ab4d6b1.png"
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
