/**
 * CharacterInput - Input para definir personajes del cuento
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Plus, Trash2, User, Users } from 'lucide-react';
import { isNameForbidden } from '@/lib/cuentacuentos/promptBuilders';

interface Character {
  description: string;
  name?: string;
}

interface CharacterInputProps {
  characters: Character[];
  onChange: (characters: Character[]) => void;
  maxCharacters?: number;
}

const CharacterInput: React.FC<CharacterInputProps> = ({
  characters,
  onChange,
  maxCharacters = 4,
}) => {
  const addCharacter = () => {
    if (characters.length < maxCharacters) {
      onChange([...characters, { description: '', name: '' }]);
    }
  };

  const removeCharacter = (index: number) => {
    if (characters.length > 1) {
      onChange(characters.filter((_, i) => i !== index));
    }
  };

  const updateCharacter = (index: number, field: keyof Character, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label
          className="block"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          Personajes
        </label>
        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '12px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {characters.length}/{maxCharacters}
        </span>
      </div>

      <p
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          fontSize: '13px',
          color: CASA_BRAND.colors.secondary.grayMedium,
        }}
      >
        Define los personajes de tu cuento. El primero será el protagonista.
      </p>

      <div className="space-y-4">
        {characters.map((character, index) => {
          const isProtagonist = index === 0;
          const nameIsForbidden = character.name && isNameForbidden(character.name);

          return (
            <div
              key={index}
              className="p-4 rounded-lg border"
              style={{
                borderColor: isProtagonist
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayLight,
                backgroundColor: CASA_BRAND.colors.primary.white,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: isProtagonist
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayLight,
                    color: isProtagonist
                      ? CASA_BRAND.colors.primary.white
                      : CASA_BRAND.colors.secondary.grayDark,
                  }}
                >
                  {isProtagonist ? <User size={16} /> : <Users size={16} />}
                </div>
                <span
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '14px',
                    fontWeight: 600,
                    color: CASA_BRAND.colors.primary.black,
                  }}
                >
                  {isProtagonist ? 'Protagonista' : `Personaje ${index + 1}`}
                </span>
                {!isProtagonist && characters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCharacter(index)}
                    className="ml-auto p-1 rounded hover:bg-gray-100"
                    style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    className="block mb-1"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Descripción *
                  </label>
                  <input
                    type="text"
                    value={character.description}
                    onChange={(e) => updateCharacter(index, 'description', e.target.value)}
                    placeholder={
                      isProtagonist
                        ? 'Ej: Niña de 8 años curiosa y valiente'
                        : 'Ej: Su hermano menor de 5 años'
                    }
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '14px',
                      borderColor: CASA_BRAND.colors.secondary.grayLight,
                      backgroundColor: CASA_BRAND.colors.primary.white,
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block mb-1"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Nombre sugerido (opcional)
                  </label>
                  <input
                    type="text"
                    value={character.name || ''}
                    onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                    placeholder="Dejar vacío para que Claude elija"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                      nameIsForbidden ? 'border-red-500' : ''
                    }`}
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '14px',
                      borderColor: nameIsForbidden
                        ? '#EF4444'
                        : CASA_BRAND.colors.secondary.grayLight,
                      backgroundColor: CASA_BRAND.colors.primary.white,
                    }}
                  />
                  {nameIsForbidden && (
                    <p
                      className="mt-1"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        fontSize: '12px',
                        color: '#EF4444',
                      }}
                    >
                      Este nombre está reservado (pertenece a un niño de la comunidad)
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {characters.length < maxCharacters && (
        <button
          type="button"
          onClick={addCharacter}
          className="w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:border-amber-400"
          style={{
            borderColor: CASA_BRAND.colors.secondary.grayLight,
            color: CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
          }}
        >
          <Plus size={18} />
          Agregar personaje secundario
        </button>
      )}
    </div>
  );
};

export default CharacterInput;
