/**
 * RecursosParaFamilias - Section for displaying published liturgy resources on home page
 * Shows Cuentacuento and Reflexion PDFs with download buttons
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Book, FileText, Calendar, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Animation variants (matching Sermones.tsx pattern)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
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

interface PublishedResource {
  id: string;
  resource_type: 'cuentacuento' | 'reflexion';
  liturgy_date: string;
  title: string;
  description: string | null;
  pdf_url: string;
}

export function RecursosParaFamilias() {
  const [resources, setResources] = useState<PublishedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const { data, error } = await supabase
          .from('published_resources')
          .select('id, resource_type, liturgy_date, title, description, pdf_url')
          .eq('is_active', true);

        if (error) throw error;
        setResources(data || []);
      } catch (err) {
        console.error('[RecursosParaFamilias] Error fetching resources:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, []);

  const cuentacuento = resources.find((r) => r.resource_type === 'cuentacuento');
  const reflexion = resources.find((r) => r.resource_type === 'reflexion');

  // Don't render section if no resources and not loading
  if (!isLoading && !cuentacuento && !reflexion) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <section id="recursos-familias" className="section bg-[#F7F7F7] noise-texture overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-amber-100/30 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-28 h-28 border border-amber-200/40 rounded-full opacity-50" />
      <div className="absolute top-1/3 right-0 w-1 h-20 bg-gradient-to-b from-[#D4A853]/30 to-transparent" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {/* Decorative separator */}
          <motion.div className="flex items-center justify-center gap-4 mb-6" variants={itemVariants}>
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-[#D4A853]" />
            <div className="w-2 h-2 bg-[#D4A853] rounded-full" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-[#D4A853]" />
          </motion.div>

          <motion.h2
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-light text-[#1A1A1A] mb-4"
            variants={itemVariants}
          >
            Recursos para la Semana
          </motion.h2>

          <motion.p className="text-lg text-[#555555] max-w-2xl mx-auto leading-relaxed" variants={itemVariants}>
            Materiales de esta semana para continuar la reflexion en familia
          </motion.p>
        </motion.div>

        {/* Resource Cards Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Loading state */}
          {isLoading ? (
            <>
              <motion.div variants={cardVariants}>
                <ResourceCardSkeleton />
              </motion.div>
              <motion.div variants={cardVariants}>
                <ResourceCardSkeleton />
              </motion.div>
            </>
          ) : (
            <>
              {/* Cuentacuento Card */}
              {cuentacuento && (
                <motion.div
                  variants={cardVariants}
                  whileHover={{
                    y: -8,
                    scale: 1.02,
                    transition: { type: 'spring', stiffness: 300 },
                  }}
                >
                  <ResourceCard
                    type="cuentacuento"
                    title={cuentacuento.title}
                    description="Cuento ilustrado para leer en familia"
                    date={formatDate(cuentacuento.liturgy_date)}
                    pdfUrl={cuentacuento.pdf_url}
                  />
                </motion.div>
              )}

              {/* Reflexion Card */}
              {reflexion && (
                <motion.div
                  variants={cardVariants}
                  whileHover={{
                    y: -8,
                    scale: 1.02,
                    transition: { type: 'spring', stiffness: 300 },
                  }}
                >
                  <ResourceCard
                    type="reflexion"
                    title={reflexion.title}
                    description="Reflexion pastoral de la semana"
                    date={formatDate(reflexion.liturgy_date)}
                    pdfUrl={reflexion.pdf_url}
                  />
                </motion.div>
              )}
            </>
          )}
        </motion.div>

        {/* Archive link */}
        <motion.div
          className="text-center mt-10"
          variants={itemVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Link
            to="/recursos/archivo"
            className="inline-flex items-center gap-2 text-[#8A8A8A] hover:text-[#D4A853] transition-colors font-mont text-sm"
          >
            <Archive size={16} />
            Ver recursos anteriores
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// Sub-component for resource cards
function ResourceCard({
  type,
  title,
  description,
  date,
  pdfUrl,
}: {
  type: 'cuentacuento' | 'reflexion';
  title: string;
  description: string;
  date: string;
  pdfUrl: string;
}) {
  const Icon = type === 'cuentacuento' ? Book : FileText;
  const isCuentacuento = type === 'cuentacuento';

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Header with gradient */}
      <div
        className="p-6 flex items-center gap-4"
        style={{
          background: isCuentacuento
            ? 'linear-gradient(135deg, #D4A853 0%, #B8923D 100%)'
            : 'linear-gradient(135deg, #1A1A1A 0%, #333333 100%)',
        }}
      >
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
          <Icon size={28} className="text-white" />
        </div>
        <div>
          <p className="text-white/90 text-sm font-medium uppercase tracking-wider font-mont">
            {isCuentacuento ? 'Cuento para Familias' : 'Reflexion'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-serif text-xl font-medium text-[#1A1A1A] mb-2 line-clamp-2">{title}</h3>
        <p className="text-[#8A8A8A] text-sm mb-4 font-mont">{description}</p>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-[#8A8A8A] mb-5 font-mont">
          <Calendar size={14} />
          <span>{date}</span>
        </div>

        {/* Download button */}
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 font-mont text-sm"
          style={{
            backgroundColor: '#1A1A1A',
            color: '#F7F7F7',
          }}
        >
          <Download size={18} />
          Descargar PDF
        </a>
      </div>
    </div>
  );
}

// Skeleton for loading state
function ResourceCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
      <div className="h-24 bg-gray-200" />
      <div className="p-6">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-5" />
        <div className="h-10 bg-gray-200 rounded-full w-36" />
      </div>
    </div>
  );
}
