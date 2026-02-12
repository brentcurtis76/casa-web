/**
 * MusicSchedulingPage — Admin page for musician scheduling.
 *
 * Tabbed layout: Músicos | Fechas de servicio | Disponibilidad | Ensayos | Setlists | Notificaciones | Práctica
 */

import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, CalendarDays, CalendarCheck, Music, ListMusic, Bell, Headphones } from 'lucide-react';
import MusicianRoster from '@/components/music-scheduling/MusicianRoster';
import ServiceDateManager from '@/components/music-scheduling/ServiceDateManager';
import AvailabilityOverview from '@/components/music-scheduling/AvailabilityOverview';
import RehearsalManager from '@/components/music-scheduling/RehearsalManager';
import SetlistBuilder from '@/components/music-scheduling/SetlistBuilder';
import NotificationCenter from '@/components/music-scheduling/NotificationCenter';
import PracticeTracker from '@/components/music-scheduling/PracticeTracker';

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
              <TabsTrigger value="ensayos" className="gap-1.5">
                <Music className="h-3.5 w-3.5" />
                Ensayos
              </TabsTrigger>
              <TabsTrigger value="setlists" className="gap-1.5">
                <ListMusic className="h-3.5 w-3.5" />
                Setlists
              </TabsTrigger>
              <TabsTrigger value="notificaciones" className="gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Notificaciones
              </TabsTrigger>
              <TabsTrigger value="practica" className="gap-1.5">
                <Headphones className="h-3.5 w-3.5" />
                Práctica
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

            <TabsContent value="ensayos" className="mt-6">
              <RehearsalManager />
            </TabsContent>

            <TabsContent value="setlists" className="mt-6">
              <SetlistBuilder />
            </TabsContent>

            <TabsContent value="notificaciones" className="mt-6">
              <NotificationCenter />
            </TabsContent>

            <TabsContent value="practica" className="mt-6">
              <PracticeTracker />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default MusicSchedulingPage;
