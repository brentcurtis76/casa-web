import { motion, useReducedMotion, type Transition } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, type LucideIcon } from "lucide-react";

/**
 * Hero "Día del Niño" — importado desde Claude Design
 * (`Header Dia del Nino.dc.html`, design system CASA "Silencio Sagrado").
 *
 * Hero de temporada, igual que AdvientoHero o RetiroSemanaSanta: se monta en
 * Index.tsx en lugar de <LiturgicalHero /> mientras dura la ocasión, y se
 * desmonta al terminar para que vuelva el calendario litúrgico.
 *
 * Actualmente DESMONTADO (la edición del 9 de agosto de 2026 ya pasó). Para
 * reutilizarlo el próximo año hay que actualizar EVENT_DETAILS con la fecha,
 * la hora y el lugar nuevos.
 */

export type ArtTreatment = "frame" | "halo" | "both" | "plain";

export interface DiaDelNinoHeroProps {
  /** Tratamiento decorativo de la ilustración. */
  artTreatment?: ArtTreatment;
  /** Anima el halo ámbar con el efecto "respiración". */
  breathingHalo?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  /** Acción del botón "Ven con tu familia". Por defecto lleva a Eventos. */
  onAsistir?: () => void;
}

const EVENT_DETAILS: { Icon: LucideIcon; label: string }[] = [
  { Icon: Calendar, label: "Domingo 9 de agosto" },
  { Icon: Clock, label: "11:00 hrs" },
  { Icon: MapPin, label: "Vicente Pérez Rosales 1765, La Reina" },
];

// casaRise — el mismo easing que usa el resto de las secciones de la marca.
const riseVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const RISE_TRANSITION: Transition = {
  duration: 0.7,
  ease: [0.25, 0.46, 0.45, 0.94],
};

/** Desplazamiento suave hacia una sección, compensando la cabecera fija. */
function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
  window.scrollTo({ top, behavior: "smooth" });
}

/** Ficha con icono de los datos del evento (fecha, hora, lugar). */
function EventDetail({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl border border-casa-200 bg-[linear-gradient(135deg,#EFEFEF,#F7F7F7)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:rotate-[5deg] hover:scale-[1.08] hover:border-[#D4A853]/50 hover:bg-[linear-gradient(135deg,rgba(212,168,83,0.32),rgba(232,201,122,0.16))]"
        aria-hidden="true"
      >
        <Icon className="h-[19px] w-[19px] text-[#1A1A1A] opacity-75" />
      </span>
      <span className="text-[15.5px] leading-[1.5] tracking-[0.01em] text-casa-700">{label}</span>
    </div>
  );
}

export function DiaDelNinoHero({
  artTreatment = "frame",
  breathingHalo = true,
  imageSrc = "/images/dia-del-nino.jpg",
  imageAlt = "Ilustración de niñas y niños jugando",
  onAsistir,
}: DiaDelNinoHeroProps) {
  // Misma lógica que `renderVals()` en el archivo de diseño.
  const showFrame = artTreatment === "frame" || artTreatment === "both";
  const showHalo =
    breathingHalo &&
    (artTreatment === "halo" || artTreatment === "both" || artTreatment === "frame");

  // Respeta "Reducir movimiento" del sistema operativo.
  const prefersReducedMotion = useReducedMotion();
  const riseInitial = prefersReducedMotion ? false : "hidden";

  const handleAsistir = onAsistir ?? (() => scrollToId("eventos"));

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(to_bottom,#F7F7F7,#FFFFFF_70%,#FFFFFF)] font-mont">
      {showHalo && (
        <motion.div
          className="pointer-events-none absolute -top-20 right-[8%] h-[720px] w-[720px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.20) 0%, rgba(212,168,83,0.08) 42%, transparent 70%)",
          }}
          animate={
            prefersReducedMotion
              ? { scale: 1, opacity: 0.7 }
              : { scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 6, repeat: Infinity, ease: "easeInOut" }
          }
        />
      )}
      {/* Elementos geométricos decorativos */}
      <div className="pointer-events-none absolute left-10 top-32 h-32 w-32 rounded-full border border-[#D4A853]/25 opacity-50" />
      <div className="pointer-events-none absolute bottom-24 left-1/4 h-[72px] w-[72px] rotate-45 border border-casa-200 opacity-[0.35]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-8 pb-24 pt-[120px] lg:grid-cols-[1.02fr_0.98fr]">
        <motion.div
          variants={riseVariants}
          initial={riseInitial}
          animate="visible"
          transition={RISE_TRANSITION}
        >
          {/* Antetítulo */}
          <div className="mb-[26px] inline-flex items-center gap-4">
            <span className="h-px w-11 bg-gradient-to-r from-transparent to-[#D4A853]/80" />
            <span className="text-[12.5px] font-medium uppercase tracking-[0.22em] text-casa-500">
              Día del Niño en CASA
            </span>
          </div>

          <h1 className="mb-3 font-serif text-[clamp(40px,4.6vw,68px)] font-light leading-[1.12] tracking-[0.04em] text-[#1A1A1A] [text-wrap:pretty]">
            El Abrigo
            <br />
            de Colores
          </h1>

          <p className="mb-7 font-serif text-xl italic tracking-[0.02em] text-[#B8923D]">
            Un culto para toda la familia
          </p>

          {/* Separador de marca: línea — punto — línea */}
          <div className="mb-7 inline-flex items-center gap-3">
            <span className="h-px w-16 bg-casa-200" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4A853]" />
            <span className="h-px w-16 bg-casa-200" />
          </div>

          <p className="mb-10 max-w-[460px] text-lg font-light leading-[1.7] text-casa-600 [text-wrap:pretty]">
            Este domingo celebramos a las niñas y los niños de nuestra comunidad. Habrá cuentos,
            juegos y tiempo para compartir — cada uno con su color, todos bajo el mismo abrigo.
          </p>

          <div className="mb-11 grid gap-[18px]">
            {EVENT_DETAILS.map((detail) => (
              <EventDetail key={detail.label} Icon={detail.Icon} label={detail.label} />
            ))}
          </div>

          <Button
            onClick={handleAsistir}
            className="h-auto rounded-full bg-[#1A1A1A] px-11 py-[18px] text-[15px] font-medium tracking-[0.02em] text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.04] hover:bg-casa-700 hover:shadow-[0_10px_26px_rgba(0,0,0,0.16)] active:scale-[0.98]"
          >
            Ven con tu familia
          </Button>
        </motion.div>

        <motion.div
          className="relative"
          variants={riseVariants}
          initial={riseInitial}
          animate="visible"
          transition={{ ...RISE_TRANSITION, delay: 0.12 }}
        >
          {showFrame && (
            <div className="pointer-events-none absolute -right-[18px] -top-[18px] bottom-[34px] left-[34px] rounded-3xl border-2 border-[#D4A853]/40" />
          )}
          <div className="relative overflow-hidden rounded-3xl bg-[#FBFAF3] shadow-float">
            <img
              src={imageSrc}
              alt={imageAlt}
              width={1024}
              height={1024}
              className="block h-auto w-full"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(17,17,17,0.06),transparent_45%)]" />
          </div>
          <div className="mt-[22px] flex items-center justify-end gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[#D4A853]" />
            <span className="h-1 w-1 rounded-full bg-casa-300" />
            <span className="h-1 w-1 rounded-full bg-casa-200" />
          </div>
        </motion.div>
      </div>

      <div className="relative mx-auto max-w-6xl px-8 pb-[72px]">
        <div className="flex flex-wrap items-baseline justify-between gap-8 border-t border-casa-100 pt-7">
          <p className="font-serif text-[15px] italic tracking-[0.02em] text-casa-500">
            Un espacio de amor, inclusión y esperanza para todos
          </p>
          <p className="text-[12.5px] font-medium uppercase tracking-[0.2em] text-casa-400">
            Comunidad Anglicana San Andrés
          </p>
        </div>
      </div>
    </section>
  );
}
