import { useState } from 'react';
import { AuthProvider } from '@/components/auth/AuthContext';
import { Footer } from '@/components/layout/Footer';
import { Header1 } from '@/components/ui/header';
import { GraphicsGeneratorV2 } from '@/components/graphics/GraphicsGeneratorV2';
import { SavedBatches } from '@/components/graphics/SavedBatches';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, FolderOpen } from 'lucide-react';

const GraphicsGeneratorPage = () => {
  const [activeTab, setActiveTab] = useState('create');

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-casa-50">
        <Header1 />
        <main className="pt-24 pb-12 flex-1">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                  <TabsTrigger value="create" className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Crear Nuevo
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Guardados
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create">
                  <GraphicsGeneratorV2 />
                </TabsContent>

                <TabsContent value="saved">
                  <SavedBatches />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default GraphicsGeneratorPage;
