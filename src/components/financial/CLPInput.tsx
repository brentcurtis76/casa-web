/**
 * CLPInput — Chilean peso currency input with formatting.
 *
 * Displays amounts with "$" prefix and dots as thousands separators
 * (e.g., "$1.234.567"). On focus, formatting is stripped for editing.
 * On blur, formatting is re-applied. Only numeric input accepted.
 */

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CLPInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function formatWithDots(num: number): string {
  if (num === 0) return '';
  return num.toLocaleString('es-CL');
}

const CLPInput = ({
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  className,
}: CLPInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState(String(value || ''));

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setRawValue(value ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseInt(rawValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    } else {
      onChange(0);
    }
  }, [rawValue, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Strip all non-digit characters
      const cleaned = e.target.value.replace(/\D/g, '');
      setRawValue(cleaned);
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed)) {
        onChange(parsed);
      } else {
        onChange(0);
      }
    },
    [onChange]
  );

  const displayValue = isFocused
    ? rawValue
    : value > 0
      ? `$${formatWithDots(value)}`
      : '';

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={`$${placeholder}`}
      disabled={disabled}
      className={cn('font-mono', className)}
    />
  );
};

export default CLPInput;
