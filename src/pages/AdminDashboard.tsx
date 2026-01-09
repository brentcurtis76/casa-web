/**
 * Dashboard de Administración - Acceso centralizado a todos los módulos de CASA
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  category: 'general' | 'liturgia';
  status: 'available' | 'coming-soon';
  stats?: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate('/');
        return;
      }

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

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdmin();
  }, [user, navigate, toast]);

  const modules: ModuleCard[] = [
    // General Modules
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
  ];

  const generalModules = modules.filter((m) => m.category === 'general');
  const liturgiaModules = modules.filter((m) => m.category === 'liturgia');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

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
        onClick={() => isAvailable && navigate(module.route)}
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
              <ChevronRight
                className="h-5 w-5 text-gray-300 group-hover:text-amber-500 transition-colors"
              />
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
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1
                className="text-3xl font-light"
                style={{
                  fontFamily: CASA_BRAND.fonts.heading,
                  color: CASA_BRAND.colors.primary.black,
                }}
              >
                Panel de Administración
              </h1>
              <p
                className="mt-1 text-sm"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Herramientas para gestionar CASA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* General Modules */}
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

          {/* Liturgia Modules */}
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
