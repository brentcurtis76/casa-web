/**
 * AdminPageHeader - Componente de header estandarizado para páginas de administración
 * Incluye navegación, breadcrumbs, título y acciones
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminPageHeaderProps {
  /** Título principal de la página */
  title: string;
  /** Subtítulo o descripción (opcional) */
  subtitle?: string;
  /** Items del breadcrumb (el primero siempre es "Admin") */
  breadcrumbs?: BreadcrumbItem[];
  /** Ruta a la que navegar al hacer click en "Volver" (default: /admin) */
  backTo?: string;
  /** Callback personalizado para el botón volver (override de backTo) */
  onBack?: () => void;
  /** Acciones adicionales (botones) a mostrar a la derecha */
  actions?: React.ReactNode;
  /** Si el header debe ser sticky (default: true) */
  sticky?: boolean;
  /** Mostrar indicador de cambios sin guardar */
  hasUnsavedChanges?: boolean;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs = [],
  backTo = '/admin',
  onBack,
  actions,
  sticky = true,
  hasUnsavedChanges = false,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backTo);
    }
  };

  const handleBreadcrumbClick = (href?: string) => {
    if (href) {
      navigate(href);
    }
  };

  // Build full breadcrumb list (always starts with Admin)
  const fullBreadcrumbs: BreadcrumbItem[] = [
    { label: 'Admin', href: '/admin' },
    ...breadcrumbs,
  ];

  return (
    <header
      className={`bg-white border-b z-20 ${sticky ? 'sticky top-0' : ''}`}
      style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
    >
      {/* Top bar with back button and breadcrumbs */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Left: Back button + Breadcrumbs */}
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Volver</span>
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden md:flex items-center gap-1">
              {fullBreadcrumbs.map((item, index) => {
                const isLast = index === fullBreadcrumbs.length - 1;
                const isFirst = index === 0;

                return (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <ChevronRight
                        size={14}
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                      />
                    )}
                    {isFirst ? (
                      <button
                        onClick={() => handleBreadcrumbClick(item.href)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-gray-100"
                        style={{
                          fontFamily: CASA_BRAND.fonts.body,
                          fontSize: '13px',
                          color: CASA_BRAND.colors.secondary.grayMedium,
                        }}
                      >
                        <Home size={14} />
                      </button>
                    ) : isLast ? (
                      <span
                        className="px-2 py-1"
                        style={{
                          fontFamily: CASA_BRAND.fonts.body,
                          fontSize: '13px',
                          color: CASA_BRAND.colors.primary.black,
                          fontWeight: 500,
                        }}
                      >
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBreadcrumbClick(item.href)}
                        className="px-2 py-1 rounded transition-colors hover:bg-gray-100"
                        style={{
                          fontFamily: CASA_BRAND.fonts.body,
                          fontSize: '13px',
                          color: CASA_BRAND.colors.secondary.grayMedium,
                        }}
                      >
                        {item.label}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right: Unsaved indicator */}
          {hasUnsavedChanges && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full"
              style={{
                backgroundColor: `${CASA_BRAND.colors.primary.amber}20`,
                color: CASA_BRAND.colors.primary.amber,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '12px',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Cambios sin guardar
            </div>
          )}
        </div>
      </div>

      {/* Main header with title and actions */}
      <div
        className="container mx-auto px-4 pb-4"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Title section */}
          <div className="flex-1 min-w-0">
            <h1
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '24px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.black,
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-1"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminPageHeader;
