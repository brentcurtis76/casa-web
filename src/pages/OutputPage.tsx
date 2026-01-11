/**
 * OutputPage - Pagina de salida para proyector
 * Ruta: /output
 * No requiere autenticacion (para computadores de proyeccion)
 */

import React from 'react';
import { OutputView } from '@/components/presentation/OutputView';

const OutputPage: React.FC = () => {
  return <OutputView />;
};

export default OutputPage;
