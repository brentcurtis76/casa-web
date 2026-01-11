/**
 * Página de Canciones - Repositorio y Editor
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { SongRepository, NewSongEditor } from '@/components/canciones';
import type { Song, SongIndexEntry } from '@/types/shared/song';

type Tab = 'repository' | 'new';

const CancionesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('repository');
  const [selectedSong, setSelectedSong] = useState<SongIndexEntry | null>(null);

  const handleSongSelect = (song: SongIndexEntry) => {
    setSelectedSong(song);
  };

  const handleSaveSong = (song: Song) => {
    console.log('Canción guardada:', song);
    setActiveTab('repository');
  };

  // Tab buttons as actions
  const tabActions = (
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
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: CASA_BRAND.colors.primary.white }}
    >
      <AdminPageHeader
        title="Canciones CASA"
        subtitle="Repositorio de 73 canciones para liturgias"
        breadcrumbs={[
          { label: 'Liturgia' },
          { label: 'Canciones' },
        ]}
        backTo="/admin"
        actions={tabActions}
      />

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
