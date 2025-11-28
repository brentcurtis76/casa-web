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
    <section className="section relative overflow-hidden bg-gradient-to-b from-amber-50/30 via-white to-white">
      {/* Subtle radial glow behind candles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0) 70%)"
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.6, 0.8, 0.6]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Overline */}
          <motion.p
            className="text-sm tracking-widest uppercase text-casa-500 mb-4"
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            CASA te invita
          </motion.p>

          {/* Title */}
          <motion.h1
            className="text-5xl md:text-7xl font-serif font-bold text-casa-800 mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Adviento 2025
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-casa-600 mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Un tiempo de espera, esperanza y preparación.
            <br className="hidden md:block" />
            Acompáñanos en este camino hacia la luz.
          </motion.p>

          {/* Candles */}
          <div className="relative my-12">
            {/* Candles row */}
            <div className="relative flex justify-center items-end gap-4 md:gap-8">
              {candles.map((candle, index) => (
                <motion.div
                  key={index}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.3 + index * 0.1,
                    ease: "easeOut"
                  }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  {/* Glow effect for lit candles */}
                  {candle.isLit && (
                    <motion.div
                      className="absolute -top-4 w-8 h-12 rounded-full"
                      style={{
                        background: "radial-gradient(ellipse at center, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0) 70%)"
                      }}
                      animate={{
                        opacity: [0.5, 0.8, 0.5],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.3
                      }}
                    />
                  )}
                  <Candle
                    className={`${candle.isTall ? 'w-10 h-24 md:w-12 md:h-28' : 'w-8 h-20 md:w-10 md:h-24'} ${
                      candle.isLit ? 'text-amber-600' : 'text-casa-400'
                    } transition-colors duration-500`}
                    isLit={candle.isLit}
                    isTall={candle.isTall}
                  />
                  <motion.span
                    className={`text-[10px] md:text-xs mt-3 tracking-wide transition-colors duration-500 ${
                      candle.isLit ? 'text-amber-700 font-medium' : 'text-casa-400'
                    }`}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    {candle.label}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Week indicator */}
          {adventWeek > 0 && adventWeek < 5 && (
            <motion.p
              className="text-sm text-amber-700 mb-6 font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              viewport={{ once: true }}
            >
              Semana {adventWeek} de Adviento
            </motion.p>
          )}
          {adventWeek === 5 && (
            <motion.p
              className="text-sm text-amber-700 mb-6 font-medium"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              viewport={{ once: true }}
            >
              ¡Feliz Navidad!
            </motion.p>
          )}

          {/* Description */}
          <motion.p
            className="text-casa-500 mb-10 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            viewport={{ once: true }}
          >
            Cada domingo encendemos una nueva vela, recordando las promesas
            que culminan en el nacimiento de Cristo.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            viewport={{ once: true }}
          >
            <Button
              size="lg"
              className="bg-casa-700 hover:bg-casa-800 text-white transition-transform hover:scale-105"
              onClick={scrollToEventos}
            >
              Ver Eventos de Adviento
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
