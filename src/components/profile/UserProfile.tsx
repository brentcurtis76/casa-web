
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileForm } from './ProfileForm';
import { useUserProfile } from './useUserProfile';

interface UserProfileProps {
  onClose?: () => void;
}

export function UserProfile({ onClose }: UserProfileProps) {
  const {
    user,
    loading,
    avatarUrl,
    formDefaultValues,
    handleAvatarChange,
    handleSubmit
  } = useUserProfile(onClose);

  return (
    <div className="space-y-6">
      <ProfileAvatar 
        userId={user?.id} 
        avatarUrl={avatarUrl} 
        onAvatarChange={handleAvatarChange} 
      />
      
      <ProfileForm 
        defaultValues={formDefaultValues}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
}
