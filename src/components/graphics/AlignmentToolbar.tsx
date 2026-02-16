import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { TextAlign } from './graphicsTypes';

interface AlignmentToolbarProps {
  value: TextAlign;
  onChange: (value: TextAlign) => void;
  disabled?: boolean;
}

export function AlignmentToolbar({ value, onChange, disabled }: AlignmentToolbarProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as TextAlign);
      }}
      className="justify-start"
      disabled={disabled}
    >
      <ToggleGroupItem value="left" aria-label="Alinear a la izquierda" size="sm">
        <AlignLeft className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Centrar" size="sm">
        <AlignCenter className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Alinear a la derecha" size="sm">
        <AlignRight className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
