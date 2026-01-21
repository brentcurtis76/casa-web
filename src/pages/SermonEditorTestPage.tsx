/**
 * Sermon Audio Editor Test Page (No Auth Required)
 * Route: /test/sermon-editor
 *
 * This page is for development testing only.
 * Remove or disable in production.
 */
import React from 'react';
import { Mic2 } from 'lucide-react';
import { SermonEditorContainer } from '@/components/sermon-editor';

const SermonEditorTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header without auth */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Mic2 className="h-8 w-8 text-amber-600" />
            <div>
              <h1 className="text-xl font-semibold">Editor de Reflexiones (Test)</h1>
              <p className="text-sm text-gray-500">
                Página de prueba - sin autenticación
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <SermonEditorContainer />
      </main>
    </div>
  );
};

export default SermonEditorTestPage;
