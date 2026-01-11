/**
 * LowerThirdManager - Panel para enviar lower-thirds
 * Soporta modo compact para uso dentro de CollapsiblePanel
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CASA_BRAND } from '@/lib/brand-kit';
import { LOWER_THIRD_TEMPLATES, type LowerThirdTemplate } from '@/lib/presentation/types';
import { Send, MessageSquare } from 'lucide-react';

interface LowerThirdManagerProps {
  onSend: (message: string, duration?: number, template?: LowerThirdTemplate) => void;
  onDismiss: () => void;
  isVisible: boolean;
  /** When true, renders without header (for use inside CollapsiblePanel) */
  compact?: boolean;
}

export const LowerThirdManager: React.FC<LowerThirdManagerProps> = ({
  onSend,
  onDismiss,
  isVisible,
  compact = false,
}) => {
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<LowerThirdTemplate>('custom');

  const handleSend = () => {
    if (!message.trim()) return;

    const template = LOWER_THIRD_TEMPLATES[selectedTemplate];
    const fullMessage = template.prefix + message + template.suffix;
    onSend(fullMessage, 10000, selectedTemplate);
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const content = (
    <>
      {/* Template buttons */}
      <div className="flex gap-2 mb-3">
        {(Object.keys(LOWER_THIRD_TEMPLATES) as LowerThirdTemplate[]).map((key) => {
          const template = LOWER_THIRD_TEMPLATES[key];
          const isActive = selectedTemplate === key;

          return (
            <button
              key={key}
              onClick={() => setSelectedTemplate(key)}
              className="px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                backgroundColor: isActive
                  ? CASA_BRAND.colors.primary.amber + '30'
                  : CASA_BRAND.colors.primary.black,
                color: isActive
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                fontFamily: CASA_BRAND.fonts.body,
                border: isActive
                  ? `1px solid ${CASA_BRAND.colors.primary.amber}`
                  : '1px solid transparent',
              }}
            >
              {key === 'custom' ? 'Personalizado' :
               key === 'mover-auto' ? 'Mover Auto' :
               'Llamada Urgente'}
            </button>
          );
        })}
      </div>

      {/* Input with template preview */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          {selectedTemplate !== 'custom' && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '14px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {LOWER_THIRD_TEMPLATES[selectedTemplate].prefix}
            </span>
          )}
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={LOWER_THIRD_TEMPLATES[selectedTemplate].placeholder}
            className="bg-black border-gray-700 text-white"
            style={{
              paddingLeft: selectedTemplate !== 'custom'
                ? `${LOWER_THIRD_TEMPLATES[selectedTemplate].prefix.length * 8 + 16}px`
                : undefined,
            }}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          className="gap-2"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Send size={14} />
          Enviar
        </Button>

        {isVisible && (
          <Button
            onClick={onDismiss}
            variant="outline"
            className="hover:bg-white/10"
            style={{
              borderColor: CASA_BRAND.colors.secondary.grayMedium,
              backgroundColor: CASA_BRAND.colors.secondary.grayDark,
              color: CASA_BRAND.colors.primary.white,
            }}
          >
            Ocultar
          </Button>
        )}
      </div>
    </>
  );

  // Compact mode: just render content without wrapper
  if (compact) {
    return content;
  }

  // Full mode: render with header and wrapper
  return (
    <div
      className="p-4"
      style={{
        backgroundColor: CASA_BRAND.colors.secondary.carbon,
        borderTop: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare
          size={16}
          style={{ color: CASA_BRAND.colors.primary.amber }}
        />
        <h3
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            fontWeight: 600,
            color: CASA_BRAND.colors.secondary.grayMedium,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Lower-Third
        </h3>
      </div>
      {content}
    </div>
  );
};

export default LowerThirdManager;
