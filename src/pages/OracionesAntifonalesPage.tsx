/**
 * Página de Oraciones Antifonales
 */

import { OracionesAntifonalesGenerator } from '@/components/liturgia';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

const OracionesAntifonalesPage = () => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: CASA_BRAND.colors.primary.white }}
    >
      <AdminPageHeader
        title="Oraciones Antifonales"
        subtitle="Genera oraciones para la liturgia dominical usando IA"
        breadcrumbs={[
          { label: 'Liturgia' },
          { label: 'Oraciones Antifonales' },
        ]}
        backTo="/admin"
      />

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <OracionesAntifonalesGenerator />
      </main>
    </div>
  );
};

export default OracionesAntifonalesPage;
