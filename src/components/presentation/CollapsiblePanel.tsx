/**
 * CollapsiblePanel - Panel colapsable reutilizable para la sidebar
 * Usa Framer Motion para animaciones suaves
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="border-b"
      style={{
        borderColor: CASA_BRAND.colors.secondary.grayDark,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-all duration-200"
        style={{
          borderLeft: `3px solid ${isOpen ? CASA_BRAND.colors.primary.amber : 'transparent'}`,
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && (
            <span
              className="transition-colors duration-200 flex-shrink-0"
              style={{ color: isOpen ? CASA_BRAND.colors.primary.amber : CASA_BRAND.colors.secondary.grayMedium }}
            >
              {icon}
            </span>
          )}
          <span
            className="transition-colors duration-200"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '12px',
              fontWeight: 600,
              color: isOpen ? CASA_BRAND.colors.primary.white : CASA_BRAND.colors.secondary.grayMedium,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
          {badge && <div className="flex items-center gap-1 ml-2">{badge}</div>}
        </div>
        <span
          className="transition-transform duration-200 flex-shrink-0"
          style={{
            color: CASA_BRAND.colors.secondary.grayMedium,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronDown size={16} />
        </span>
      </button>

      {/* Content with animation */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsiblePanel;
