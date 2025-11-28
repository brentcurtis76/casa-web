import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1"
          animate={{
            d: [
              "M15 8 Q12 12, 12 16 Q12 20, 15 22 Q18 20, 18 16 Q18 12, 15 8",
              "M15 7 Q11 12, 12 16 Q12 20, 15 23 Q18 20, 18 16 Q19 12, 15 7",
              "M15 8 Q12 12, 12 16 Q12 20, 15 22 Q18 20, 18 16 Q18 12, 15 8",
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
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
  const scrollToEventos = () => {
    const eventosSection = document.getElementById('eventos');
    if (eventosSection) {
      eventosSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const candles = [
    { label: "Esperanza", isLit: false },
    { label: "Paz", isLit: false },
    { label: "Cristo", isLit: false, isTall: true },
    { label: "Gozo", isLit: false },
    { label: "Amor", isLit: false },
  ];

  return (
    <section className="section bg-white">
      <div className="container-custom">
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
          <div className="flex justify-center items-end gap-4 md:gap-8 my-12">
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
                <Candle
                  className={`${candle.isTall ? 'w-10 h-24 md:w-12 md:h-28' : 'w-8 h-20 md:w-10 md:h-24'} text-casa-400`}
                  isLit={candle.isLit}
                  isTall={candle.isTall}
                />
                <motion.span
                  className="text-[10px] md:text-xs text-casa-400 mt-3 tracking-wide"
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
