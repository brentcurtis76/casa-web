import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currentSeason as fallbackSeason } from "@/data/currentSeason";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

interface SeasonData {
  id: string;
  name: string;
  scripture: {
    reference: string;
    text: string;
  };
  theme: string;
  accentColor: string;
}

export function LiturgicalHero() {
  const [season, setSeason] = useState<SeasonData>(fallbackSeason);

  useEffect(() => {
    const fetchSeason = async () => {
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'liturgical_season')
        .single();

      if (!error && data?.value) {
        setSeason(data.value as SeasonData);
      }
    };

    fetchSeason();
  }, []);

  const accentColor = season.accentColor || "#D4A853";

  const scrollToProposito = () => {
    const propositoSection = document.getElementById('proposito');
    if (propositoSection) {
      const headerOffset = 80;
      const elementPosition = propositoSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="section relative overflow-hidden bg-gradient-to-b from-[#F7F7F7] via-white to-white noise-texture min-h-[90vh] flex items-center">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${accentColor}14 0%, ${accentColor}08 40%, ${accentColor}00 70%)`
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Decorative geometric elements */}
      <div
        className="absolute top-20 left-10 w-32 h-32 border rounded-full opacity-40"
        style={{ borderColor: `${accentColor}33` }}
      />
      <div className="absolute bottom-32 right-16 w-20 h-20 border border-[#E5E5E5] rotate-45 opacity-30" />
      <div
        className="absolute top-1/3 right-10 w-1 h-16 opacity-100"
        style={{ background: `linear-gradient(to bottom, ${accentColor}26, transparent)` }}
      />

      <div className="container-custom relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {/* Overline with decorative elements */}
          <motion.div
            className="flex items-center justify-center gap-4 mb-6"
            variants={itemVariants}
          >
            <div
              className="w-12 h-px"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}80)` }}
            />
            <p className="text-sm tracking-[0.2em] uppercase text-[#8A8A8A] font-mont font-medium">
              {season.name}
            </p>
            <div
              className="w-12 h-px"
              style={{ background: `linear-gradient(to left, transparent, ${accentColor}80)` }}
            />
          </motion.div>

          {/* Scripture Reference */}
          <motion.p
            variants={itemVariants}
            className="text-[#8A8A8A] text-sm md:text-base font-serif italic mb-6 tracking-wide"
          >
            {season.scripture.reference}
          </motion.p>

          {/* Main Scripture Quote */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight text-[#1A1A1A]">
              <span style={{ color: accentColor }}>"</span>
              {season.scripture.text}
              <span style={{ color: accentColor }}>"</span>
            </h1>
          </motion.div>

          {/* Decorative Separator - Brand Style */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-3 mb-10"
          >
            <div className="w-16 h-px bg-[#E5E5E5]" />
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <div className="w-16 h-px bg-[#E5E5E5]" />
          </motion.div>

          {/* Theme Text */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl lg:text-2xl text-[#555555] font-mont font-light mb-12 max-w-xl mx-auto leading-relaxed"
          >
            {season.theme}
          </motion.p>

          {/* CTA Button - Brand Primary Style */}
          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              className="bg-[#1A1A1A] hover:bg-[#333333] text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 px-10 py-6 text-base font-mont font-medium rounded-full"
              onClick={scrollToProposito}
            >
              Conócenos
            </Button>
          </motion.div>

          {/* Tagline */}
          <motion.p
            variants={itemVariants}
            className="mt-10 text-[#8A8A8A] text-sm font-mont tracking-wide italic"
          >
            Un espacio de amor, inclusión y esperanza para todos
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
