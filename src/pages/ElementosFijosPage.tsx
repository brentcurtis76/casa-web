/**
 * ElementosFijosPage - Página de administración de Elementos Fijos
 * Permite ver y seleccionar los elementos litúrgicos estáticos
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { FixedElementsList, FixedElementViewer } from '@/components/elementos-fijos';
import type { FixedElement } from '@/types/shared/fixed-elements';

const ElementosFijosPage: React.FC = () => {
  const [selectedElement, setSelectedElement] = useState<FixedElement | null>(null);

  const handleSelectElement = (element: FixedElement) => {
    setSelectedElement(element);
  };

  const handleCloseViewer = () => {
    setSelectedElement(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Elementos Fijos"
        subtitle="Textos litúrgicos que se repiten cada domingo"
        breadcrumbs={[
          { label: 'Liturgia' },
          { label: 'Elementos Fijos' },
        ]}
        backTo="/admin"
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Lista de elementos */}
            <div className="lg:col-span-1">
              <div
                className="bg-white rounded-xl shadow-sm border overflow-hidden"
                style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                <FixedElementsList
                  onSelectElement={handleSelectElement}
                  selectedElementId={selectedElement?.id}
                />
              </div>
            </div>

            {/* Visualizador */}
            <div className="lg:col-span-2">
              <div
                className="bg-white rounded-xl shadow-sm border overflow-hidden h-full min-h-[600px]"
                style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                {selectedElement ? (
                  <FixedElementViewer
                    element={selectedElement}
                    onClose={handleCloseViewer}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                      style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
                    >
                      <svg
                        className="w-10 h-10"
                        style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3
                      className="text-xl font-light mb-2"
                      style={{
                        fontFamily: CASA_BRAND.fonts.heading,
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      Selecciona un elemento
                    </h3>
                    <p
                      className="max-w-sm"
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      Elige un elemento de la lista para ver su contenido y previsualizar los slides.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElementosFijosPage;
