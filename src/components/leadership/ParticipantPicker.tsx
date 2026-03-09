/**
 * ParticipantPicker — Multi-select user picker for meeting participants
 */

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ParticipantPickerProps {
  meetingId: string;
  selected: string[];
  onChange: (userIds: string[]) => void;
}

interface UserOption {
  id: string;
  full_name: string | null;
}

const ParticipantPicker = ({
  meetingId,
  selected,
  onChange,
}: ParticipantPickerProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>(selected);

  // Suppress unused variable warning — meetingId used for context
  void meetingId;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers((data as UserOption[]) ?? []);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggleUser = (userId: string) => {
    const newSelected = selectedUsers.includes(userId)
      ? selectedUsers.filter((id) => id !== userId)
      : [...selectedUsers, userId];

    setSelectedUsers(newSelected);
  };

  const handleConfirm = () => {
    const newUsers = selectedUsers.filter((id) => !selected.includes(id));
    if (newUsers.length > 0) {
      onChange(newUsers);
    }
  };

  const newCount = selectedUsers.filter((id) => !selected.includes(id)).length;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nombre o email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {searchTerm ? 'No se encontraron usuarios' : 'Sin usuarios disponibles'}
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Checkbox
                id={`user-${user.id}`}
                checked={selectedUsers.includes(user.id)}
                onCheckedChange={() => handleToggleUser(user.id)}
              />
              <Label
                htmlFor={`user-${user.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="text-sm font-medium">{user.full_name ?? 'Sin Nombre'}</div>
              </Label>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handleConfirm}
        className="w-full bg-amber-600 hover:bg-amber-700 text-stone-900"
        disabled={newCount === 0}
      >
        Agregar {newCount} Participante{newCount !== 1 ? 's' : ''}
      </Button>
    </div>
  );
};

export default ParticipantPicker;
