/**
 * ArchivoRecursosPage - Archive page for browsing all published resources
 * Allows users to search and filter through past Cuentacuentos and Reflexiones
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Book, FileText, Calendar, Search, Filter, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getArchivedResources, PublishedResource } from '@/lib/publishedResourcesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ITEMS_PER_PAGE = 12;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

export default function ArchivoRecursosPage() {
  const [resources, setResources] = useState<PublishedResource[]>([]);
  const [filteredResources, setFilteredResources] = useState<PublishedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | 'cuentacuento' | 'reflexion'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch resources
  useEffect(() => {
    const fetchResources = async () => {
      setIsLoading(true);
      try {
        const { data, count } = await getArchivedResources({
          type: typeFilter,
          limit: 100, // Fetch more for client-side search
          offset: 0,
        });
        setResources(data);
        setTotalCount(count);
      } catch (err) {
        console.error('[ArchivoRecursosPage] Error fetching resources:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [typeFilter]);

  // Filter by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredResources(resources);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = resources.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.liturgy_date.includes(query)
      );
      setFilteredResources(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, resources]);

  // Pagination
  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 text-[#8A8A8A] hover:text-[#1A1A1A] transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="font-mont text-sm">Volver al inicio</span>
              </Link>
            </div>
            <h1 className="font-serif text-xl text-[#1A1A1A]">Archivo de Recursos</h1>
            <div className="w-32" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {/* Title and description */}
        <div className="text-center mb-8">
          <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#1A1A1A] mb-3">
            Recursos Anteriores
          </h2>
          <p className="text-[#8A8A8A] font-mont max-w-xl mx-auto">
            Explora todos los cuentos y reflexiones publicados anteriormente
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" size={18} />
              <Input
                type="text"
                placeholder="Buscar por titulo o fecha..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-mont"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-[#8A8A8A]" />
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}
              >
                <SelectTrigger className="w-[180px] font-mont">
                  <SelectValue placeholder="Tipo de recurso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los recursos</SelectItem>
                  <SelectItem value="cuentacuento">Cuentos</SelectItem>
                  <SelectItem value="reflexion">Reflexiones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-[#8A8A8A] font-mont">
          {isLoading ? (
            'Cargando...'
          ) : (
            <>
              Mostrando {paginatedResources.length} de {filteredResources.length} recursos
              {searchQuery && ` para "${searchQuery}"`}
            </>
          )}
        </div>

        {/* Resources grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : paginatedResources.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#8A8A8A] font-mont">No se encontraron recursos</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            key={`${typeFilter}-${searchQuery}-${currentPage}`}
          >
            {paginatedResources.map((resource) => (
              <motion.div key={resource.id} variants={itemVariants}>
                <ResourceCard resource={resource} formatDate={formatDate} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

// Resource card component
function ResourceCard({
  resource,
  formatDate,
}: {
  resource: PublishedResource;
  formatDate: (date: string) => string;
}) {
  const Icon = resource.resource_type === 'cuentacuento' ? Book : FileText;
  const isCuentacuento = resource.resource_type === 'cuentacuento';

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header stripe */}
      <div
        className="h-2"
        style={{
          background: isCuentacuento
            ? 'linear-gradient(90deg, #D4A853 0%, #B8923D 100%)'
            : 'linear-gradient(90deg, #1A1A1A 0%, #333333 100%)',
        }}
      />

      <div className="p-5">
        {/* Type badge */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: isCuentacuento ? '#FEF3C7' : '#E5E7EB',
            }}
          >
            <Icon size={16} className={isCuentacuento ? 'text-[#B8923D]' : 'text-[#4B5563]'} />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A8A8A] font-mont">
            {isCuentacuento ? 'Cuento' : 'Reflexion'}
          </span>
          {resource.is_active && (
            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-mont">
              Actual
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-serif text-lg font-medium text-[#1A1A1A] mb-2 line-clamp-2">
          {resource.title}
        </h3>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-[#8A8A8A] mb-4 font-mont">
          <Calendar size={14} />
          <span>{formatDate(resource.liturgy_date)}</span>
        </div>

        {/* Download button */}
        <a
          href={resource.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 font-mont"
          style={{
            backgroundColor: isCuentacuento ? '#D4A853' : '#1A1A1A',
            color: '#FFFFFF',
          }}
        >
          <Download size={16} />
          Descargar
        </a>
      </div>
    </div>
  );
}

// Skeleton loader
function ResourceCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
      <div className="h-2 bg-gray-200" />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-200" />
          <div className="h-3 bg-gray-200 rounded w-16" />
        </div>
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-9 bg-gray-200 rounded-full w-28" />
      </div>
    </div>
  );
}
