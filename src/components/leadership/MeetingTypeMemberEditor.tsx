/**
 * MeetingTypeMemberEditor — Add/remove members from meeting types (admin only)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getMeetingTypeMembers,
  addMeetingTypeMember,
  removeMeetingTypeMember,
} from '@/lib/leadership/meetingTypeService';
import { supabase } from '@/integrations/supabase/client';
import type { MeetingTypeMemberRow, MeetingTypeMemberRole } from '@/types/leadershipModule';

interface MeetingTypeMemberEditorProps {
  meetingTypeId: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
}

const ROLE_LABELS: Record<MeetingTypeMemberRole, string> = {
  chair: 'Presidente',
  secretary: 'Secretario/a',
  member: 'Miembro',
};

const MeetingTypeMemberEditor = ({ meetingTypeId }: MeetingTypeMemberEditorProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<MeetingTypeMemberRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<MeetingTypeMemberRole>('member');
  const [adding, setAdding] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMeetingTypeMembers(meetingTypeId);
      setMembers(data);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los miembros',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [meetingTypeId, toast]);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true });

    if (!error && data) {
      setUsers(data as UserOption[]);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadUsers();
  }, [loadMembers, loadUsers]);

  const memberUserIds = new Set(members.map((m) => m.user_id));

  const availableUsers = users.filter((u) => !memberUserIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await addMeetingTypeMember({
        meeting_type_id: meetingTypeId,
        user_id: selectedUserId,
        role: selectedRole,
      });
      await loadMembers();
      setSelectedUserId('');
      setSelectedRole('member');
      toast({ title: 'Éxito', description: 'Miembro agregado' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar el miembro',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('¿Eliminar a este miembro del tipo de reunión?')) return;
    try {
      await removeMeetingTypeMember(memberId);
      await loadMembers();
      toast({ title: 'Éxito', description: 'Miembro eliminado' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el miembro',
        variant: 'destructive',
      });
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.full_name ?? userId;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Miembros del Tipo de Reunión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Members */}
        {loading ? (
          <div className="text-center py-4">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin miembros</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{getUserName(member.user_id)}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {ROLE_LABELS[member.role]}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(member.id)}
                  className="h-8 w-8 p-0"
                  aria-label={`Eliminar miembro ${getUserName(member.user_id)}`}
                >
                  <UserMinus className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add Member */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Agregar Miembro</p>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Seleccionar usuario..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name ?? 'Sin Nombre'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as MeetingTypeMemberRole)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Rol..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as MeetingTypeMemberRole[]).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleAdd}
            disabled={!selectedUserId || adding}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-stone-900"
            size="sm"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Agregar Miembro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MeetingTypeMemberEditor;
