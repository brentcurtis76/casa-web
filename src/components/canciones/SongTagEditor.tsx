/**
 * SongTagEditor - Componente para editar tags de una canción
 * Permite asignar tempo, temas y momentos litúrgicos sugeridos
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import { Tag, Music, Clock, Calendar, X, Check } from 'lucide-react';
import type {
  Song,
  SongTags,
  SongTempo,
  SongTheme,
  LiturgicalMoment,
} from '@/types/shared/song';
import {
  TEMPO_LABELS,
  THEME_LABELS,
  MOMENT_LABELS,
  THEME_COLORS,
  createEmptySongTags,
  getSongUsageStats,
} from '@/lib/canciones/songTagsManager';

interface SongTagEditorProps {
  song: Song;
  onSave: (songTags: SongTags) => void;
  onCancel?: () => void;
}

const TEMPOS: SongTempo[] = ['lento', 'moderado', 'alegre', 'muy-alegre'];
const THEMES: SongTheme[] = [
  'alabanza', 'adoracion', 'arrepentimiento', 'esperanza', 'fe',
  'amor', 'gracia', 'paz', 'gozo', 'comunidad', 'servicio',
  'navidad', 'semana-santa', 'pascua', 'pentecostes', 'adviento', 'cuaresma',
];
const MOMENTS: LiturgicalMoment[] = [
  'himno-entrada', 'himno-gloria', 'cancion-meditacion', 'himno-salida',
  'comunion', 'ofrenda', 'adoracion', 'reflexion',
];

const SongTagEditor: React.FC<SongTagEditorProps> = ({ song, onSave, onCancel }) => {
  const [tags, setTags] = useState<SongTags>(
    song.songTags || createEmptySongTags()
  );

  const usageStats = getSongUsageStats(tags);

  // Toggle tempo
  const setTempo = (tempo: SongTempo | undefined) => {
    setTags((prev) => ({
      ...prev,
      tempo: prev.tempo === tempo ? undefined : tempo,
    }));
  };

  // Toggle theme
  const toggleTheme = (theme: SongTheme) => {
    setTags((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  };

  // Toggle moment
  const toggleMoment = (moment: LiturgicalMoment) => {
    setTags((prev) => ({
      ...prev,
      suggestedMoments: prev.suggestedMoments.includes(moment)
        ? prev.suggestedMoments.filter((m) => m !== moment)
        : [...prev.suggestedMoments, moment],
    }));
  };

  // Handle save
  const handleSave = () => {
    onSave(tags);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
        >
          <Tag size={20} color={CASA_BRAND.colors.primary.white} />
        </div>
        <div>
          <h3
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '20px',
              fontWeight: 400,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            Editar Tags
          </h3>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '13px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {song.title}
          </p>
        </div>
      </div>

      {/* Usage Stats */}
      {usageStats.totalUsage > 0 && (
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${CASA_BRAND.colors.amber.light}20` }}
        >
          <div className="flex items-center gap-4 text-sm">
            <span
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              <Calendar size={14} className="inline mr-1" />
              Usada {usageStats.totalUsage} {usageStats.totalUsage === 1 ? 'vez' : 'veces'}
            </span>
            {usageStats.daysSinceLastUse !== null && (
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                <Clock size={14} className="inline mr-1" />
                Última vez hace {usageStats.daysSinceLastUse} días
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tempo Section */}
      <div>
        <label
          className="flex items-center gap-2 mb-3"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Music size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          Tempo
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPOS.map((tempo) => {
            const isSelected = tags.tempo === tempo;
            return (
              <button
                key={tempo}
                type="button"
                onClick={() => setTempo(tempo)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: isSelected
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.secondary.grayLight,
                  color: isSelected
                    ? CASA_BRAND.colors.primary.white
                    : CASA_BRAND.colors.primary.black,
                  fontFamily: CASA_BRAND.fonts.body,
                  ringColor: CASA_BRAND.colors.primary.amber,
                }}
              >
                {TEMPO_LABELS[tempo]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Themes Section */}
      <div>
        <label
          className="flex items-center gap-2 mb-3"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Tag size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          Temas Espirituales
        </label>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => {
            const isSelected = tags.themes.includes(theme);
            return (
              <button
                key={theme}
                type="button"
                onClick={() => toggleTheme(theme)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  backgroundColor: isSelected
                    ? THEME_COLORS[theme]
                    : CASA_BRAND.colors.secondary.grayLight,
                  color: isSelected ? 'white' : CASA_BRAND.colors.primary.black,
                  fontFamily: CASA_BRAND.fonts.body,
                  ringColor: THEME_COLORS[theme],
                }}
              >
                {isSelected && <Check size={12} />}
                {THEME_LABELS[theme]}
              </button>
            );
          })}
        </div>
        {tags.themes.length > 0 && (
          <p
            className="mt-2 text-xs"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          >
            {tags.themes.length} tema{tags.themes.length > 1 ? 's' : ''} seleccionado{tags.themes.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Liturgical Moments Section */}
      <div>
        <label
          className="flex items-center gap-2 mb-3"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <Calendar size={16} style={{ color: CASA_BRAND.colors.primary.amber }} />
          Momentos Litúrgicos Sugeridos
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MOMENTS.map((moment) => {
            const isSelected = tags.suggestedMoments.includes(moment);
            return (
              <button
                key={moment}
                type="button"
                onClick={() => toggleMoment(moment)}
                className={`px-4 py-2 rounded-lg text-sm transition-all border-2 flex items-center gap-2 ${
                  isSelected ? '' : 'border-transparent'
                }`}
                style={{
                  backgroundColor: isSelected
                    ? `${CASA_BRAND.colors.amber.light}30`
                    : CASA_BRAND.colors.secondary.grayLight,
                  borderColor: isSelected
                    ? CASA_BRAND.colors.primary.amber
                    : 'transparent',
                  color: isSelected
                    ? CASA_BRAND.colors.primary.amber
                    : CASA_BRAND.colors.primary.black,
                  fontFamily: CASA_BRAND.fonts.body,
                }}
              >
                {isSelected && <Check size={14} />}
                {MOMENT_LABELS[moment]}
              </button>
            );
          })}
        </div>
        {tags.suggestedMoments.length > 0 && (
          <p
            className="mt-2 text-xs"
            style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
          >
            Sugerida para {tags.suggestedMoments.length} momento{tags.suggestedMoments.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-gray-100"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            <X size={16} />
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 rounded-full transition-colors"
          style={{
            backgroundColor: CASA_BRAND.colors.primary.amber,
            color: CASA_BRAND.colors.primary.white,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Check size={16} />
          Guardar Tags
        </button>
      </div>
    </div>
  );
};

export default SongTagEditor;
