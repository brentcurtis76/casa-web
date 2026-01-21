/**
 * QuickAddButton - Floating action button for creating slides on-the-fly
 * Opens the SlideCreatorModal when clicked
 *
 * UI/UX REDESIGN (PROMPT_018):
 * - Repositioned from bottom-36 right-[350px] to bottom-6 right-6
 * - Added hover rotation animation
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Plus } from 'lucide-react';

interface QuickAddButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const QuickAddButton: React.FC<QuickAddButtonProps> = ({
  onClick,
  disabled = false,
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl transition-all duration-200 hover:scale-110 hover:rotate-90"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.amber,
        color: CASA_BRAND.colors.primary.black,
        boxShadow: `0 4px 24px ${CASA_BRAND.colors.primary.amber}40`,
      }}
      title="Crear diapositiva rápida"
      aria-label="Crear diapositiva rápida"
    >
      <Plus size={24} strokeWidth={2.5} />
    </Button>
  );
};

export default QuickAddButton;
