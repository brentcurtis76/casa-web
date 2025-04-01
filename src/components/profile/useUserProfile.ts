
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProfileFormValues } from './ProfileForm';

export function useUserProfile(onClose?: () => void) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formDefaultValues, setFormDefaultValues] = useState<ProfileFormValues>({
    full_name: '',
    phone: '',
  });

  const fetchProfile = async () => {
    try {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setFormDefaultValues({
          full_name: data.full_name || '',
          phone: data.phone || '',
        });
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleAvatarChange = async (url: string) => {
    setAvatarUrl(url);
    
    // Update the avatar_url in the profiles table
    if (user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', user.id);

        if (error) throw error;
        
        // Refresh the profile in the Auth context
        if (refreshProfile) {
          await refreshProfile();
        }
      } catch (error) {
        console.error('Error updating avatar in profile:', error);
      }
    }
  };

  const handleSubmit = async (values: ProfileFormValues) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const updates = {
        id: user.id,
        full_name: values.full_name,
        phone: values.phone || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Refresh the profile in the Auth context
      if (refreshProfile) {
        await refreshProfile();
      }

      toast({
        title: "Perfil actualizado",
        description: "Tu información ha sido guardada correctamente."
      });
      
      // Close the modal if the onClose prop is provided
      if (onClose) {
        // Force a page reload to ensure UI is responsive
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar tu perfil. Por favor, intenta de nuevo."
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    avatarUrl,
    formDefaultValues,
    handleAvatarChange,
    handleSubmit
  };
}
