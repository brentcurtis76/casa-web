import { useState } from 'react';
import { AuthProvider } from '@/components/auth/AuthContext';
import { GraphicsGeneratorV2 } from '@/components/graphics/GraphicsGeneratorV2';
import { SavedBatches } from '@/components/graphics/SavedBatches';
import { PlusCircle, FolderOpen } from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const GraphicsGeneratorPage = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

  const tabActions = (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => setActiveTab('create')}
        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'create'
            ? 'bg-white shadow-sm'
            : 'hover:bg-gray-50'
        }`}
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          color: activeTab === 'create'
            ? CASA_BRAND.colors.primary.black
            : CASA_BRAND.colors.secondary.grayMedium
        }}
      >
        <PlusCircle className="h-4 w-4" />
        Crear Nuevo
      </button>
      <button
        onClick={() => setActiveTab('saved')}
        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'saved'
            ? 'bg-white shadow-sm'
            : 'hover:bg-gray-50'
        }`}
        style={{
          fontFamily: CASA_BRAND.fonts.body,
          color: activeTab === 'saved'
            ? CASA_BRAND.colors.primary.black
            : CASA_BRAND.colors.secondary.grayMedium
        }}
      >
        <FolderOpen className="h-4 w-4" />
        Guardados
      </button>
    </div>
  );

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminPageHeader
          title="Generador de Gráficos"
          subtitle="Crea gráficos para redes sociales con las plantillas de CASA"
          breadcrumbs={[
            { label: 'General' },
            { label: 'Gráficos' },
          ]}
          backTo="/admin"
          actions={tabActions}
        />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'create' && <GraphicsGeneratorV2 />}
            {activeTab === 'saved' && <SavedBatches />}
          </div>
        </main>
      </div>
    </AuthProvider>
  );
};

export default GraphicsGeneratorPage;
