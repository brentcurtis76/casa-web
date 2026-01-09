/**
 * Página de Oraciones Antifonales
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { OracionesAntifonalesGenerator } from '@/components/liturgia';
import { CASA_BRAND } from '@/lib/brand-kit';

const OracionesAntifonalesPage = () => {
  const navigate = useNavigate();

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
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Oraciones Antifonales
              </h1>
              <p
                className="text-sm"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Genera oraciones para la liturgia dominical usando IA
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <OracionesAntifonalesGenerator />
      </main>
    </div>
  );
};

export default OracionesAntifonalesPage;
