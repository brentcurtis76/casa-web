
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    try {
      setLoading(true);
      
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar la información del perfil',
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile() {
    try {
      setLoading(true);

      if (!user) return;

      const updates = {
        id: user.id,
        full_name: fullName,
        phone,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) {
        throw error;
      }

      toast({
        title: 'Perfil actualizado',
        description: 'Tu información ha sido actualizada con éxito',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la información',
      });
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}-${Math.random()}.${fileExt}`;

      // Create storage bucket if it doesn't exist
      const { data: bucketExists } = await supabase
        .storage
        .getBucket('avatars');
      
      if (!bucketExists) {
        await supabase
          .storage
          .createBucket('avatars', { public: true });
      }

      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      
      // Update profile with new avatar
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            avatar_url: data.publicUrl,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: 'Imagen actualizada',
        description: 'Tu foto de perfil ha sido actualizada',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo subir la imagen',
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={avatarUrl || ''} alt={fullName} />
          <AvatarFallback>{fullName?.substring(0, 2).toUpperCase() || 'US'}</AvatarFallback>
        </Avatar>
        
        <div className="flex flex-col items-center">
          <Label htmlFor="avatar" className="cursor-pointer py-2 px-4 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
            {uploading ? 'Subiendo...' : 'Cambiar foto'}
          </Label>
          <Input 
            id="avatar" 
            type="file" 
            accept="image/*" 
            onChange={uploadAvatar} 
            disabled={uploading} 
            className="hidden"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre completo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Tu número de teléfono"
          />
        </div>

        <Button 
          onClick={updateProfile} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
