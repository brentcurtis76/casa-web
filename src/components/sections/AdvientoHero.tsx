import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

// Calculate which Advent week we're in (1-4, or 0 if before Advent, 5 if Christmas)
const getAdventWeek = (): number => {
  const today = new Date();
  const year = today.getFullYear();

  // Christmas is Dec 25
  const christmas = new Date(year, 11, 25);

  // Find the 4th Sunday before Christmas (First Sunday of Advent)
  // Advent starts 4 Sundays before Christmas
  const christmasDay = christmas.getDay();
  const daysToFirstAdventSunday = christmasDay === 0 ? 28 : 28 - christmasDay + 7;
  const firstAdventSunday = new Date(christmas);
  firstAdventSunday.setDate(christmas.getDate() - daysToFirstAdventSunday + 7);

  // For 2025, Advent starts Nov 30, 2025 (First Sunday of Advent)
  const advent2025Start = new Date(2025, 10, 30); // Nov 30, 2025
  const advent2025Week2 = new Date(2025, 11, 7);  // Dec 7
  const advent2025Week3 = new Date(2025, 11, 14); // Dec 14
  const advent2025Week4 = new Date(2025, 11, 21); // Dec 21
  const christmas2025 = new Date(2025, 11, 25);   // Dec 25

  if (today < advent2025Start) return 0;
  if (today >= christmas2025) return 5;
  if (today >= advent2025Week4) return 4;
  if (today >= advent2025Week3) return 3;
  if (today >= advent2025Week2) return 2;
  if (today >= advent2025Start) return 1;

  return 0;
};

// Line-drawn candle SVG component matching Mesa Abierta style
const Candle = ({
  className,
  isLit = false,
  isTall = false
}: {
  className?: string;
  isLit?: boolean;
  isTall?: boolean;
}) => {
  const height = isTall ? 80 : 60;
  const candleTop = isTall ? 25 : 20;

  return (
    <svg
      viewBox={`0 0 30 ${height}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {/* Flame */}
      {isLit && (
        <motion.path
          d="M15 8 Q12 12, 12 16 Q12 20, 15 22 Q18 20, 18 16 Q18 12, 15 8"
          fill="currentColor"
          fillOpacity="0.3"
          stroke="currentColor"
          strokeWidth="1"
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: 1,
            scale: 1,
            d: [
              "M15 8 Q12 12, 12 16 Q12 20, 15 22 Q18 20, 18 16 Q18 12, 15 8",
              "M15 7 Q11 12, 12 16 Q12 20, 15 23 Q18 20, 18 16 Q19 12, 15 7",
              "M15 8 Q12 12, 12 16 Q12 20, 15 22 Q18 20, 18 16 Q18 12, 15 8",
            ]
          }}
          transition={{
            opacity: { duration: 0.5 },
            scale: { duration: 0.5 },
            d: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
        />
      )}

      {/* Wick */}
      <line x1="15" y1={candleTop} x2="15" y2={candleTop - 4} strokeLinecap="round" />

      {/* Candle body */}
      <rect
        x="8"
        y={candleTop}
        width="14"
        height={height - candleTop - 8}
        rx="1"
        strokeLinecap="round"
      />

      {/* Candle holder/base */}
      <ellipse cx="15" cy={height - 6} rx="10" ry="3" />
      <line x1="5" y1={height - 6} x2="5" y2={height - 3} strokeLinecap="round" />
      <line x1="25" y1={height - 6} x2="25" y2={height - 3} strokeLinecap="round" />
      <ellipse cx="15" cy={height - 3} rx="10" ry="3" />
    </svg>
  );
};

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

const candleContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.5
    }
  }
};

const candleVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.8 },
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

export function AdvientoHero() {
  const adventWeek = useMemo(() => getAdventWeek(), []);

  const scrollToEventos = () => {
    const eventosSection = document.getElementById('eventos');
    if (eventosSection) {
      const headerOffset = 80;
      const elementPosition = eventosSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Candles light up based on Advent week
  // Order: 1st (Hope), 2nd (Peace), 4th (Love), 3rd (Joy), then Christ candle on Christmas
  const candles = [
    { label: "Esperanza", isLit: adventWeek >= 1 },
    { label: "Paz", isLit: adventWeek >= 2 },
    { label: "Cristo", isLit: adventWeek >= 5, isTall: true },
    { label: "Gozo", isLit: adventWeek >= 3 },
    { label: "Amor", isLit: adventWeek >= 4 },
  ];

  return (
    <section className="section relative overflow-hidden bg-gradient-to-b from-amber-50/40 via-white to-white noise-texture min-h-[90vh] flex items-center">
      {/* Enhanced radial glow behind candles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 40%, rgba(251,191,36,0) 70%)"
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.6, 0.9, 0.6]
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Decorative geometric elements */}
      <div className="absolute top-20 left-10 w-32 h-32 border border-amber-200/30 rounded-full opacity-50" />
      <div className="absolute bottom-32 right-16 w-20 h-20 border border-casa-200/40 rotate-45 opacity-40" />
      <div className="absolute top-1/3 right-10 w-2 h-16 bg-gradient-to-b from-amber-200/20 to-transparent" />

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
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-amber-400/60" />
            <p className="text-sm tracking-[0.2em] uppercase text-casa-500 font-medium">
              CASA te invita
            </p>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-amber-400/60" />
          </motion.div>

          {/* Title - Larger and more dramatic */}
          <motion.h1
            className="heading-xl font-serif font-bold text-casa-800 mb-8"
            variants={itemVariants}
          >
            Adviento 2025
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-xl md:text-2xl text-casa-600 mb-10 leading-relaxed max-w-xl mx-auto"
            variants={itemVariants}
          >
            Un tiempo de espera, esperanza y preparación.
            <br />
            <span className="text-amber-700">Acompáñanos en este camino hacia la luz.</span>
          </motion.p>

          {/* Candles with enhanced animation */}
          <motion.div
            className="relative my-16"
            variants={candleContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Candles row */}
            <div className="relative flex justify-center items-end gap-6 md:gap-10">
              {candles.map((candle, index) => (
                <motion.div
                  key={index}
                  className="flex flex-col items-center cursor-pointer"
                  variants={candleVariants}
                  whileHover={{
                    y: -8,
                    transition: { type: "spring", stiffness: 400 }
                  }}
                >
                  {/* Enhanced glow effect for lit candles */}
                  {candle.isLit && (
                    <motion.div
                      className="absolute -top-6 w-12 h-16 rounded-full"
                      style={{
                        background: "radial-gradient(ellipse at center, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.2) 40%, rgba(251,191,36,0) 70%)"
                      }}
                      animate={{
                        opacity: [0.4, 0.9, 0.4],
                        scale: [1, 1.15, 1]
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.25
                      }}
                    />
                  )}
                  <Candle
                    className={`${candle.isTall ? 'w-12 h-28 md:w-14 md:h-32' : 'w-10 h-24 md:w-12 md:h-28'} ${
                      candle.isLit ? 'text-amber-600' : 'text-casa-400'
                    } transition-colors duration-500`}
                    isLit={candle.isLit}
                    isTall={candle.isTall}
                  />
                  <motion.span
                    className={`text-xs md:text-sm mt-4 tracking-wide transition-colors duration-500 ${
                      candle.isLit ? 'text-amber-700 font-semibold' : 'text-casa-400'
                    }`}
                  >
                    {candle.label}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Week indicator */}
          {adventWeek > 0 && adventWeek < 5 && (
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100/60 rounded-full mb-8"
              variants={itemVariants}
            >
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <p className="text-sm text-amber-800 font-medium">
                Semana {adventWeek} de Adviento
              </p>
            </motion.div>
          )}
          {adventWeek === 5 && (
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100/60 rounded-full mb-8"
              variants={itemVariants}
            >
              <span className="text-lg">✨</span>
              <p className="text-sm text-amber-800 font-medium">
                ¡Feliz Navidad!
              </p>
            </motion.div>
          )}

          {/* Description */}
          <motion.p
            className="text-casa-500 mb-12 max-w-lg mx-auto leading-relaxed"
            variants={itemVariants}
          >
            Cada domingo encendemos una nueva vela, recordando las promesas
            que culminan en el nacimiento de Cristo.
          </motion.p>

          {/* CTA */}
          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              className="bg-casa-700 hover:bg-casa-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 px-8"
              onClick={scrollToEventos}
            >
              Ver Eventos de Adviento
            </Button>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
