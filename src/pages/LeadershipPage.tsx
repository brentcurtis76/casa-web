/**
 * LeadershipPage — Tabbed layout: Dashboard | Reuniones | Compromisos | Tipos de Reunión (admin)
 *
 * Access: general_admin (manage), concilio_member (read/write), equipo_pastoral (read/write)
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/AuthContext';
import { LayoutDashboard, Calendar, CheckSquare, Settings2 } from 'lucide-react';
import LeadershipDashboard from '@/components/leadership/LeadershipDashboard';
import MeetingList from '@/components/leadership/MeetingList';
import CommitmentManager from '@/components/leadership/CommitmentManager';
import MeetingTypeManager from '@/components/leadership/MeetingTypeManager';

const LeadershipPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const validTabs = ['dashboard', 'reuniones', 'compromisos', 'tipos'];
  const [activeTab, setActiveTab] = useState(
    validTabs.includes(initialTab) ? initialTab : 'dashboard',
  );

  const { user } = useAuth();
  const { canRead, canWrite, canManage, loading } = usePermissions('leadership');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Acceso denegado</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Liderazgo Eclesiastico"
        subtitle="Reuniones, compromisos, actas y documentos del liderazgo"
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Liderazgo Eclesiastico' },
        ]}
        backTo="/admin"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto -mx-4 px-4">
              <TabsList
                className={`inline-flex w-auto min-w-full md:grid md:w-full ${
                  canManage ? 'md:grid-cols-4' : 'md:grid-cols-3'
                }`}
              >
                <TabsTrigger value="dashboard" className="gap-1.5 whitespace-nowrap">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="reuniones" className="gap-1.5 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  Reuniones
                </TabsTrigger>
                <TabsTrigger value="compromisos" className="gap-1.5 whitespace-nowrap">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Compromisos
                </TabsTrigger>
                {canManage && (
                  <TabsTrigger value="tipos" className="gap-1.5 whitespace-nowrap">
                    <Settings2 className="h-3.5 w-3.5" />
                    Tipos de Reunión
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-6">
              <LeadershipDashboard
                canWrite={canWrite}
                canManage={canManage}
                userId={user?.id}
                onNavigateToTab={setActiveTab}
              />
            </TabsContent>

            <TabsContent value="reuniones" className="mt-6">
              <MeetingList canWrite={canWrite} />
            </TabsContent>

            <TabsContent value="compromisos" className="mt-6">
              <CommitmentManager canWrite={canWrite} />
            </TabsContent>

            {canManage && (
              <TabsContent value="tipos" className="mt-6">
                <MeetingTypeManager />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default LeadershipPage;
