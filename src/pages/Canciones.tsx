/**
 * Página de Canciones - Repositorio y Editor
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CASA_BRAND } from '@/lib/brand-kit';
import { SongRepository, NewSongEditor } from '@/components/canciones';
import type { Song, SongIndexEntry } from '@/types/shared/song';

type Tab = 'repository' | 'new';

const CancionesPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('repository');
  const [selectedSong, setSelectedSong] = useState<SongIndexEntry | null>(null);

  const handleSongSelect = (song: SongIndexEntry) => {
    setSelectedSong(song);
  };

  const handleSaveSong = (song: Song) => {
    console.log('Canción guardada:', song);
    setActiveTab('repository');
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: CASA_BRAND.colors.primary.white }}
    >
      {/* Header */}
      <header
        className="border-b bg-white"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1
                  className="text-2xl font-semibold"
                  style={{
                    fontFamily: CASA_BRAND.fonts.heading,
                    color: CASA_BRAND.colors.primary.black
                  }}
                >
                  Canciones CASA
                </h1>
                <p
                  className="text-sm"
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: CASA_BRAND.colors.secondary.grayMedium
                  }}
                >
                  Repositorio de 73 canciones para liturgias
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setActiveTab('repository')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'repository'
                      ? 'bg-white shadow-sm'
                      : 'hover:bg-gray-50'
                  }`}
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: activeTab === 'repository'
                      ? CASA_BRAND.colors.primary.black
                      : CASA_BRAND.colors.secondary.grayMedium
                  }}
                >
                  Repositorio
                </button>
                <button
                  onClick={() => setActiveTab('new')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'new'
                      ? 'bg-white shadow-sm'
                      : 'hover:bg-gray-50'
                  }`}
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    color: activeTab === 'new'
                      ? CASA_BRAND.colors.primary.black
                      : CASA_BRAND.colors.secondary.grayMedium
                  }}
                >
                  + Nueva Canción
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === 'repository' && (
          <SongRepository
            onSongSelect={handleSongSelect}
            selectedSongId={selectedSong?.id}
          />
        )}

        {activeTab === 'new' && (
          <NewSongEditor
            onSave={handleSaveSong}
            onCancel={() => setActiveTab('repository')}
          />
        )}
      </main>
    </div>
  );
};

export default CancionesPage;
