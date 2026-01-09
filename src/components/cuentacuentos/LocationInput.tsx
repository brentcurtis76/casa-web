/**
 * LocationInput - Input para lugar del cuento con sugerencias de Chile
 */

import React, { useState, useRef, useEffect } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { MapPin, ChevronDown } from 'lucide-react';
import locationsData from '@/data/cuentacuentos/example-locations.json';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({
  value,
  onChange,
  placeholder = 'Ej: Bahía Inglesa, Valle del Elqui, Torres del Paine...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Obtener todas las ubicaciones aplanadas
  const allLocations = locationsData.categories.flatMap((cat) => cat.locations);

  useEffect(() => {
    // Filtrar ubicaciones basado en el input
    if (value.trim()) {
      const filtered = allLocations.filter((loc) =>
        loc.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations([]);
    }
  }, [value]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (location: string) => {
    onChange(location);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <label
        className="block"
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '14px',
          fontWeight: 600,
          color: CASA_BRAND.colors.primary.black,
        }}
      >
        Lugar del Cuento (Chile)
      </label>

      <div className="relative">
        <div className="relative">
          <MapPin
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              borderColor: CASA_BRAND.colors.secondary.grayLight,
              backgroundColor: CASA_BRAND.colors.primary.white,
            }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Dropdown de sugerencias */}
        {isOpen && (
          <div
            className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-64 overflow-y-auto"
            style={{
              backgroundColor: CASA_BRAND.colors.primary.white,
              borderColor: CASA_BRAND.colors.secondary.grayLight,
            }}
          >
            {filteredLocations.length > 0 ? (
              // Mostrar ubicaciones filtradas
              <div className="p-2">
                {filteredLocations.map((location) => (
                  <button
                    key={location}
                    type="button"
                    onClick={() => handleSelectLocation(location)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-amber-50"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '14px',
                      color: CASA_BRAND.colors.primary.black,
                    }}
                  >
                    {location}
                  </button>
                ))}
              </div>
            ) : (
              // Mostrar todas las categorías
              <div className="p-2">
                {locationsData.categories.map((category) => (
                  <div key={category.category} className="mb-3 last:mb-0">
                    <div
                      className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      {category.category}
                    </div>
                    <div className="mt-1">
                      {category.locations.slice(0, 5).map((location) => (
                        <button
                          key={location}
                          type="button"
                          onClick={() => handleSelectLocation(location)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-amber-50"
                          style={{
                            fontFamily: CASA_BRAND.fonts.body,
                            fontSize: '14px',
                            color: CASA_BRAND.colors.primary.black,
                          }}
                        >
                          {location}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '12px',
          color: CASA_BRAND.colors.secondary.grayMedium,
        }}
      >
        Escribe cualquier lugar de Chile. El sistema investigará sus características.
      </p>
    </div>
  );
};

export default LocationInput;
