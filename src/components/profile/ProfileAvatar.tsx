
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProfileAvatarProps {
  userId: string | undefined;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
}

export function ProfileAvatar({ userId, avatarUrl, onAvatarChange }: ProfileAvatarProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debes seleccionar una imagen');
      }

      if (!userId) {
        throw new Error('No user ID available');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}-${Math.random()}.${fileExt}`;

      // Upload the file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL for the uploaded file
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const newAvatarUrl = data.publicUrl;
      onAvatarChange(newAvatarUrl);

      toast({
        title: "Imagen subida",
        description: "Tu foto de perfil ha sido actualizada."
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo subir la imagen. Por favor, intenta de nuevo."
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
            {userId?.substring(0, 2).toUpperCase() || <User />}
          </AvatarFallback>
        </Avatar>
        <label 
          htmlFor="avatar-upload" 
          className="absolute -bottom-2 -right-2 p-1 bg-primary text-white rounded-full cursor-pointer"
          title="Cambiar foto de perfil"
        >
          <Upload size={16} />
        </label>
        <input 
          id="avatar-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={uploadAvatar}
          disabled={uploading}
        />
      </div>
      {uploading && <p className="text-sm text-muted-foreground">Subiendo...</p>}
    </div>
  );
}
