/**
 * Sermon Audio Editor Page
 * Route: /admin/sermon-editor
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic2, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { SermonEditorContainer } from '@/components/sermon-editor';

const SermonEditorPage: React.FC = () => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Editor de Reflexiones"
        description="Edita y exporta grabaciones de reflexiones para publicar en Spotify"
        icon={<Mic2 className="h-8 w-8 text-amber-600" />}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Editor de Reflexiones' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <SermonEditorContainer />
      </main>
    </div>
  );
};

export default SermonEditorPage;
