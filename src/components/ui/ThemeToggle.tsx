'use client';

import { Sun, Moon } from 'lucide-react';
import { PresentationTheme } from '@/lib/presentation/themes';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  value: PresentationTheme;
  onChange: (theme: PresentationTheme) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    container: 'p-0.5 gap-1',
    button: 'p-1',
    icon: 14,
  },
  md: {
    container: 'p-1 gap-2',
    button: 'p-2',
    icon: 18,
  },
  lg: {
    container: 'p-1.5 gap-2',
    button: 'p-2.5',
    icon: 22,
  },
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  value,
  onChange,
  className,
  size = 'md',
}) => {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex items-center rounded-lg bg-secondary',
        sizes.container,
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange('light')}
        className={cn(
          'rounded transition-all duration-200',
          sizes.button,
          value === 'light'
            ? 'bg-white shadow-sm'
            : 'hover:bg-white/50'
        )}
        title="Tema Claro"
        aria-label="Tema Claro"
        aria-pressed={value === 'light'}
      >
        <Sun
          size={sizes.icon}
          className={cn(
            'transition-colors duration-200',
            value === 'light' ? 'text-amber-500' : 'text-gray-400'
          )}
        />
      </button>
      <button
        type="button"
        onClick={() => onChange('dark')}
        className={cn(
          'rounded transition-all duration-200',
          sizes.button,
          value === 'dark'
            ? 'bg-gray-800 shadow-sm'
            : 'hover:bg-gray-800/30'
        )}
        title="Tema Oscuro"
        aria-label="Tema Oscuro"
        aria-pressed={value === 'dark'}
      >
        <Moon
          size={sizes.icon}
          className={cn(
            'transition-colors duration-200',
            value === 'dark' ? 'text-amber-500' : 'text-gray-400'
          )}
        />
      </button>
    </div>
  );
};

export default ThemeToggle;
