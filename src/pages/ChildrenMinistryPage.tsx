/**
 * ChildrenMinistryPage — Main admin page for Children's Ministry module
 * Tabbed layout: Dashboard, Lecciones, Calendario, Voluntarios, Inventario, Asistencia
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/AuthContext';
import { LayoutDashboard, BookOpen, Calendar, Users, Package, BarChart3 } from 'lucide-react';
import LessonManager from '@/components/children-ministry/LessonManager';
import ChildrenCalendar from '@/components/children-ministry/ChildrenCalendar';
import VolunteerManager from '@/components/children-ministry/VolunteerManager';
import ChildrenDashboard from '@/components/children-ministry/ChildrenDashboard';
import InventoryManager from '@/components/children-ministry/InventoryManager';
import AttendanceReports from '@/components/children-ministry/AttendanceReports';

const ChildrenMinistryPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const validTabs = ['dashboard', 'lecciones', 'calendario', 'voluntarios', 'inventario', 'asistencia'];
  const [activeTab, setActiveTab] = useState(
    validTabs.includes(initialTab) ? initialTab : 'dashboard'
  );

  const { user } = useAuth();
  const { canRead, canWrite, canManage, loading } = usePermissions('children_ministry');
  const isVolunteerOnly = canRead && !canWrite;

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
        title="Ministerio Infantil"
        subtitle="Gestión de lecciones, calendario, voluntarios y asistencia"
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Ministerio Infantil' },
        ]}
        backTo="/admin"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto -mx-4 px-4">
              <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-6">
                <TabsTrigger value="dashboard" className="gap-1.5 whitespace-nowrap">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="lecciones" className="gap-1.5 whitespace-nowrap">
                  <BookOpen className="h-3.5 w-3.5" />
                  Lecciones
                </TabsTrigger>
                <TabsTrigger value="calendario" className="gap-1.5 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  Calendario
                </TabsTrigger>
                <TabsTrigger value="voluntarios" className="gap-1.5 whitespace-nowrap">
                  <Users className="h-3.5 w-3.5" />
                  Voluntarios
                </TabsTrigger>
                {canWrite && (
                  <>
                    <TabsTrigger value="inventario" className="gap-1.5 whitespace-nowrap">
                      <Package className="h-3.5 w-3.5" />
                      Inventario
                    </TabsTrigger>
                    <TabsTrigger value="asistencia" className="gap-1.5 whitespace-nowrap">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Asistencia
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-6">
              <ChildrenDashboard canWrite={canWrite} isVolunteerOnly={isVolunteerOnly} userId={user?.id} />
            </TabsContent>

            <TabsContent value="lecciones" className="mt-6">
              <LessonManager canWrite={canWrite} />
            </TabsContent>

            <TabsContent value="calendario" className="mt-6">
              <ChildrenCalendar canWrite={canWrite} isVolunteerOnly={isVolunteerOnly} />
            </TabsContent>

            <TabsContent value="voluntarios" className="mt-6">
              <VolunteerManager
                canWrite={canWrite}
                canManage={canManage}
                isVolunteerOnly={isVolunteerOnly}
                userId={user?.id}
              />
            </TabsContent>

            {canWrite && (
              <>
                <TabsContent value="inventario" className="mt-6">
                  <InventoryManager />
                </TabsContent>

                <TabsContent value="asistencia" className="mt-6">
                  <AttendanceReports />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ChildrenMinistryPage;
