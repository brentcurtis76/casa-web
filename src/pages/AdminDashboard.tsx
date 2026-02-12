/**
 * Dashboard de Administración - Acceso centralizado a todos los módulos de CASA
 *
 * Now uses RBAC to:
 * 1. Check admin access (new system or legacy mesa_abierta_admin_roles)
 * 2. Filter visible modules based on user permissions
 * 3. Show "Gestión de Usuarios" card for general_admin only
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Church,
  Music,
  BookOpen,
  Calendar,
  Loader2,
  ChevronRight,
  UtensilsCrossed,
  Image,
  Sparkles,
  ScrollText,
  Layers,
  Presentation,
  ExternalLink,
  Mic2,
  Users,
  Shield,
  DollarSign,
  ListMusic,
  Headphones,
} from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { MODULE_RESOURCE_MAP } from '@/types/rbac';
import type { PermissionAction } from '@/types/rbac';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  category: 'general' | 'liturgia' | 'administracion';
  status: 'available' | 'coming-soon';
  stats?: string;
  openInNewTab?: boolean;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, roles, rolesLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibleModuleIds, setVisibleModuleIds] = useState<Set<string>>(new Set());

  // Check admin/role-based access
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      // Wait for roles to load
      if (rolesLoading) return;

      // If user has ANY roles in the new RBAC system, they can see the dashboard
      if (roles.length > 0) {
        setIsAuthorized(true);
        await computeVisibleModules();
        setLoading(false);
        return;
      }

      // Fallback: check legacy mesa_abierta_admin_roles table
      const { data } = await supabase
        .from('mesa_abierta_admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!data) {
        toast({
          title: 'Acceso denegado',
          description: 'No tienes permisos de administrador.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Legacy admin — show all modules
      setIsAuthorized(true);
      setVisibleModuleIds(new Set(Object.keys(MODULE_RESOURCE_MAP)));
      setLoading(false);
    };

    checkAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, toast, rolesLoading, roles]);

  // Compute which modules the user can see based on permissions
  const computeVisibleModules = async () => {
    // Admin sees everything
    if (isAdmin) {
      setVisibleModuleIds(new Set(Object.keys(MODULE_RESOURCE_MAP)));
      return;
    }

    const visible = new Set<string>();
    const moduleIds = Object.keys(MODULE_RESOURCE_MAP);

    // Check read permission for each module in parallel
    const checks = await Promise.all(
      moduleIds.map(async (moduleId) => {
        const resource = MODULE_RESOURCE_MAP[moduleId];
        const canRead = await hasPermission(resource, 'read' as PermissionAction);
        return { moduleId, canRead };
      })
    );

    for (const { moduleId, canRead } of checks) {
      if (canRead) {
        visible.add(moduleId);
      }
    }

    setVisibleModuleIds(visible);
  };

  const modules: ModuleCard[] = [
    // General Modules
    {
      id: 'presenter',
      title: 'Presentador',
      description: 'Abre el presentador de liturgias en pantalla completa para proyectar en el servicio.',
      icon: <Presentation className="h-8 w-8" />,
      route: '/presenter',
      category: 'general',
      status: 'available',
      openInNewTab: true,
    },
    {
      id: 'eventos',
      title: 'Eventos',
      description: 'Gestiona los eventos de CASA. Crea, edita y publica eventos para la comunidad.',
      icon: <Calendar className="h-8 w-8" />,
      route: '/admin/events',
      category: 'general',
      status: 'available',
    },
    {
      id: 'mesa-abierta',
      title: 'Mesa Abierta',
      description: 'Administra las inscripciones y participantes de Mesa Abierta cada mes.',
      icon: <UtensilsCrossed className="h-8 w-8" />,
      route: '/mesa-abierta/admin',
      category: 'general',
      status: 'available',
    },
    {
      id: 'graphics',
      title: 'Generador de Gráficos',
      description: 'Crea gráficos para redes sociales con las plantillas de CASA.',
      icon: <Image className="h-8 w-8" />,
      route: '/admin/graphics',
      category: 'general',
      status: 'available',
    },
    {
      id: 'sermon-editor',
      title: 'Editor de Reflexiones',
      description: 'Editar y publicar grabaciones de reflexiones para Spotify.',
      icon: <Mic2 className="h-8 w-8" />,
      route: '/admin/sermon-editor',
      category: 'general',
      status: 'available',
    },
    // Liturgia Modules
    {
      id: 'constructor',
      title: 'Constructor de Liturgias',
      description: 'Crea liturgias completas con los 18 elementos: portadas, oraciones, canciones, lecturas y más.',
      icon: <Layers className="h-8 w-8" />,
      route: '/admin/liturgia/constructor',
      category: 'liturgia',
      status: 'available',
      stats: '18 elementos',
    },
    {
      id: 'temporadas',
      title: 'Temporada Litúrgica',
      description: 'Configura el mensaje del Hero en la página principal según la temporada.',
      icon: <Church className="h-8 w-8" />,
      route: '/admin/liturgia/temporadas',
      category: 'liturgia',
      status: 'available',
    },
    {
      id: 'oraciones',
      title: 'Oraciones Antifonales',
      description: 'Genera oraciones antifonales (invocación, arrepentimiento, gratitud) usando IA.',
      icon: <BookOpen className="h-8 w-8" />,
      route: '/admin/liturgia/oraciones',
      category: 'liturgia',
      status: 'available',
    },
    {
      id: 'canciones',
      title: 'Canciones',
      description: 'Repositorio de canciones para la liturgia. Busca, visualiza y agrega nuevas canciones.',
      icon: <Music className="h-8 w-8" />,
      route: '/admin/liturgia/canciones',
      category: 'liturgia',
      status: 'available',
      stats: '73 canciones',
    },
    {
      id: 'elementos-fijos',
      title: 'Elementos Fijos',
      description: 'Textos litúrgicos estáticos: La Paz, Padre Nuestro, Santa Cena, Ofrenda y Bendición.',
      icon: <ScrollText className="h-8 w-8" />,
      route: '/admin/liturgia/elementos-fijos',
      category: 'liturgia',
      status: 'available',
      stats: '6 elementos',
    },
    {
      id: 'musica-biblioteca',
      title: 'Biblioteca Musical',
      description: 'Canciones, arreglos, stems, partituras y referencias de audio del equipo de adoración.',
      icon: <ListMusic className="h-8 w-8" />,
      route: '/admin/musica/biblioteca',
      category: 'liturgia',
      status: 'available',
    },
    {
      id: 'musica-programacion',
      title: 'Programación Musical',
      description: 'Músicos, fechas de servicio, disponibilidad, ensayos, setlists, notificaciones y práctica.',
      icon: <Headphones className="h-8 w-8" />,
      route: '/admin/musica/programacion',
      category: 'liturgia',
      status: 'available',
    },
    // Administracion Modules
    {
      id: 'finanzas',
      title: 'Finanzas',
      description: 'Gestión financiera: ingresos, gastos, presupuestos, reportes y nómina.',
      icon: <DollarSign className="h-8 w-8" />,
      route: '/admin/finanzas',
      category: 'administracion',
      status: 'available',
    },
  ];

  // Filter modules based on user permissions
  const filterModules = (mods: ModuleCard[]) =>
    mods.filter((m) => visibleModuleIds.has(m.id));

  const generalModules = filterModules(modules.filter((m) => m.category === 'general'));
  const liturgiaModules = filterModules(modules.filter((m) => m.category === 'liturgia'));
  const adminFinModules = filterModules(modules.filter((m) => m.category === 'administracion'));

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const handleModuleClick = (module: ModuleCard) => {
    if (module.openInNewTab) {
      window.open(module.route, '_blank');
    } else {
      navigate(module.route);
    }
  };

  const renderModuleCard = (module: ModuleCard) => {
    const isAvailable = module.status === 'available';

    return (
      <Card
        key={module.id}
        className={`transition-all ${
          isAvailable
            ? 'cursor-pointer hover:shadow-lg hover:border-amber-300 group'
            : 'opacity-60 cursor-not-allowed'
        }`}
        onClick={() => isAvailable && handleModuleClick(module)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                isAvailable ? 'group-hover:bg-amber-100' : ''
              }`}
              style={{
                backgroundColor: isAvailable
                  ? `${CASA_BRAND.colors.primary.amber}15`
                  : CASA_BRAND.colors.secondary.grayLight,
                color: isAvailable
                  ? CASA_BRAND.colors.primary.amber
                  : CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {module.icon}
            </div>
            {isAvailable ? (
              module.openInNewTab ? (
                <ExternalLink
                  className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors"
                />
              ) : (
                <ChevronRight
                  className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors"
                />
              )
            ) : (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: CASA_BRAND.colors.secondary.grayLight,
                  color: CASA_BRAND.colors.secondary.grayDark,
                }}
              >
                Próximamente
              </span>
            )}
          </div>
          <CardTitle
            className="mt-4"
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              color: isAvailable
                ? CASA_BRAND.colors.primary.black
                : CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {module.title}
          </CardTitle>
          {module.stats && isAvailable && (
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: CASA_BRAND.colors.primary.amber,
                color: CASA_BRAND.colors.primary.white,
              }}
            >
              {module.stats}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <CardDescription
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {module.description}
          </CardDescription>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Panel de Administración"
        subtitle="Herramientas para gestionar CASA"
        backTo="/"
        sticky={false}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Admin-only: User Management Card */}
          {isAdmin && (
            <div className="mb-10">
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                <Users className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.amber }} />
                Administración
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="cursor-pointer hover:shadow-lg hover:border-amber-300 group transition-all"
                  onClick={() => navigate('/admin/users')}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center transition-colors group-hover:bg-amber-100"
                        style={{
                          backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
                          color: CASA_BRAND.colors.primary.amber,
                        }}
                      >
                        <Users className="h-8 w-8" />
                      </div>
                      <ChevronRight
                        className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors"
                      />
                    </div>
                    <CardTitle
                      className="mt-4"
                      style={{
                        fontFamily: CASA_BRAND.fonts.heading,
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      Gestión de Usuarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      Administra los usuarios, asigna roles y gestiona permisos de acceso a los módulos.
                    </CardDescription>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:shadow-lg hover:border-amber-300 group transition-all"
                  onClick={() => navigate('/admin/roles')}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center transition-colors group-hover:bg-amber-100"
                        style={{
                          backgroundColor: `${CASA_BRAND.colors.primary.amber}15`,
                          color: CASA_BRAND.colors.primary.amber,
                        }}
                      >
                        <Shield className="h-8 w-8" />
                      </div>
                      <ChevronRight
                        className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors"
                      />
                    </div>
                    <CardTitle
                      className="mt-4"
                      style={{
                        fontFamily: CASA_BRAND.fonts.heading,
                        color: CASA_BRAND.colors.primary.black,
                      }}
                    >
                      Gestión de Roles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription
                      style={{
                        fontFamily: CASA_BRAND.fonts.body,
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      Crea y edita roles, configura la matriz de permisos de acceso a cada módulo.
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* General Modules */}
          {generalModules.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                <Sparkles className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.amber }} />
                Módulos Generales
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {generalModules.map(renderModuleCard)}
              </div>
            </div>
          )}

          {/* Liturgia Modules */}
          {liturgiaModules.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                <Church className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.amber }} />
                Sistema de Liturgias
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {liturgiaModules.map(renderModuleCard)}
              </div>
            </div>
          )}

          {/* Administracion y Finanzas Modules */}
          {adminFinModules.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                <DollarSign className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.amber }} />
                Administración y Finanzas
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {adminFinModules.map(renderModuleCard)}
              </div>
            </div>
          )}

          {/* Info Card */}
          <Card className="border-dashed bg-amber-50/50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Sparkles className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h3
                    className="font-medium mb-1"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      color: CASA_BRAND.colors.primary.black,
                    }}
                  >
                    Centro de Control CASA
                  </h3>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      color: CASA_BRAND.colors.secondary.grayDark,
                    }}
                  >
                    Desde aquí puedes acceder a todas las herramientas de administración.
                    Cada módulo funciona de forma independiente y está diseñado para
                    facilitar la gestión de los diferentes aspectos de CASA.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
