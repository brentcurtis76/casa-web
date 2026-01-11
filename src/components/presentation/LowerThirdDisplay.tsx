/**
 * Lower-Third Display - Muestra mensajes animados sobre el slide
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { LowerThirdState } from '@/lib/presentation/types';

interface LowerThirdDisplayProps {
  state: LowerThirdState;
  onDismiss: () => void;
}

export const LowerThirdDisplay: React.FC<LowerThirdDisplayProps> = ({
  state,
  onDismiss,
}) => {
  // Auto-dismiss after duration
  useEffect(() => {
    if (!state.visible || !state.duration) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, state.duration);

    return () => clearTimeout(timer);
  }, [state.visible, state.duration, onDismiss]);

  return (
    <AnimatePresence>
      {state.visible && state.message && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 200,
          }}
          className="absolute bottom-0 left-0 right-0 z-50"
          style={{
            padding: '24px 48px',
          }}
        >
          <div
            className="rounded-lg shadow-2xl"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.95)',
              backdropFilter: 'blur(8px)',
              padding: '20px 32px',
              borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}`,
            }}
          >
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '28px',
                fontWeight: 500,
                color: CASA_BRAND.colors.primary.white,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {state.message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LowerThirdDisplay;
