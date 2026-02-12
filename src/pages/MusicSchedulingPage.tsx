/**
 * MusicSchedulingPage — Admin page for musician scheduling.
 *
 * Tabbed layout: Músicos | Fechas de servicio | Disponibilidad
 */

import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, CalendarDays, CalendarCheck } from 'lucide-react';
import MusicianRoster from '@/components/music-scheduling/MusicianRoster';
import ServiceDateManager from '@/components/music-scheduling/ServiceDateManager';
import AvailabilityOverview from '@/components/music-scheduling/AvailabilityOverview';

const MusicSchedulingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Programación Musical"
        subtitle="Gestión de músicos, fechas de servicio y disponibilidad"
        breadcrumbs={[
          { label: 'Liturgia', href: '/admin' },
          { label: 'Programación Musical' },
        ]}
        backTo="/admin"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="musicos">
            <TabsList className="w-auto">
              <TabsTrigger value="musicos" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Músicos
              </TabsTrigger>
              <TabsTrigger value="fechas" className="gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Fechas de servicio
              </TabsTrigger>
              <TabsTrigger value="disponibilidad" className="gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5" />
                Disponibilidad
              </TabsTrigger>
            </TabsList>

            <TabsContent value="musicos" className="mt-6">
              <MusicianRoster />
            </TabsContent>

            <TabsContent value="fechas" className="mt-6">
              <ServiceDateManager />
            </TabsContent>

            <TabsContent value="disponibilidad" className="mt-6">
              <AvailabilityOverview />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default MusicSchedulingPage;
