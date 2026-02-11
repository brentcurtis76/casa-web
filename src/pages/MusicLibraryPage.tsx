/**
 * MusicLibraryPage — Page shell for the Song Library admin module.
 *
 * NOTE: Does NOT wrap in AuthProvider — App.tsx already provides it at root level.
 */

import SongLibraryAdmin from '@/components/music-library/SongLibraryAdmin';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const MusicLibraryPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Biblioteca Musical"
        subtitle="Gestión de canciones, arreglos, stems y partituras"
        breadcrumbs={[
          { label: 'Liturgia', href: '/admin' },
          { label: 'Biblioteca Musical' },
        ]}
        backTo="/admin"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <SongLibraryAdmin />
        </div>
      </main>
    </div>
  );
};

export default MusicLibraryPage;
