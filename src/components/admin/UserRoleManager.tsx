/**
 * UserRoleManager — User list with search, pagination, role badges, and role management.
 *
 * Features:
 * - Fetches users via `get_users_with_email()` RPC (admin-only)
 * - Client-side search by name or email
 * - Pagination at 20 per page
 * - Each row: avatar, name, email, role badges, "Gestionar Roles" button
 * - Opens RoleAssignmentModal for role assignment
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Search, ChevronLeft, ChevronRight, Users, UserPlus } from 'lucide-react';
import RoleAssignmentModal from './RoleAssignmentModal';
import AddUserDialog from './AddUserDialog';
import UserActionsDropdown from './UserActionsDropdown';
import type { UserWithEmail, RoleName, ChurchRole } from '@/types/rbac';
import { ROLE_DISPLAY_INFO } from '@/types/rbac';
import { CASA_BRAND } from '@/lib/brand-kit';

const PAGE_SIZE = 20;

interface UserWithRoles extends UserWithEmail {
  roles: { name: RoleName; display_name: string }[];
}

const UserRoleManager: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Role assignment modal
  const [selectedUser, setSelectedUser] = useState<UserWithEmail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Add user dialog
  const [addUserOpen, setAddUserOpen] = useState(false);

  // Helper to invoke the admin-user-management edge function
  const callAdminUserMgmt = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(
        'admin-user-management',
        { body: { action, ...payload } }
      );
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Error en la operación');
      }
      return data as Record<string, unknown>;
    },
    []
  );

  // Fetch users and their roles
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Get users with email via admin-only RPC
      const { data: usersData, error: usersError } = await supabase.rpc(
        'get_users_with_email'
      );

      if (usersError) {
        console.error('Error fetching users:', usersError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los usuarios.',
          variant: 'destructive',
        });
        return;
      }

      if (!usersData || (usersData as UserWithEmail[]).length === 0) {
        setUsers([]);
        return;
      }

      // Fetch all roles for display name mapping
      const { data: rolesData } = await supabase
        .from('church_roles')
        .select('id, name, display_name');

      const rolesMap = new Map<string, ChurchRole>();
      for (const role of (rolesData || []) as ChurchRole[]) {
        rolesMap.set(role.id, role);
      }

      // Fetch all user role assignments
      const { data: assignmentsData } = await supabase
        .from('church_user_roles')
        .select('user_id, role_id');

      // Build user-to-roles mapping
      const userRolesMap = new Map<string, { name: RoleName; display_name: string }[]>();
      for (const assignment of assignmentsData || []) {
        const role = rolesMap.get(assignment.role_id);
        if (!role) continue;
        const existing = userRolesMap.get(assignment.user_id) || [];
        existing.push({
          name: role.name as RoleName,
          display_name: role.display_name,
        });
        userRolesMap.set(assignment.user_id, existing);
      }

      // Combine users with their roles
      const usersWithRoles: UserWithRoles[] = (usersData as UserWithEmail[]).map(
        (u) => ({
          ...u,
          roles: userRolesMap.get(u.id) || [],
        })
      );

      // Sort: admins first, then alphabetically by name
      usersWithRoles.sort((a, b) => {
        const aIsAdmin = a.roles.some(r => r.name === 'general_admin');
        const bIsAdmin = b.roles.some(r => r.name === 'general_admin');
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter users by search query
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleManageRoles = (targetUser: UserWithEmail) => {
    setSelectedUser(targetUser);
    setModalOpen(true);
  };

  const handleRolesUpdated = () => {
    fetchUsers();
  };

  const getInitials = (name: string | null, email: string): string => {
    if (name) {
      return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  // Role badge color mapping
  const getRoleBadgeClass = (roleName: RoleName): string => {
    if (roleName === 'general_admin') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
        >
          <Users className="h-4 w-4" />
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
        </div>
        <Button
          onClick={() => setAddUserOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 ml-auto"
        >
          <UserPlus className="h-4 w-4" />
          Agregar Usuario
        </Button>
      </div>

      {/* User table */}
      {paginatedUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery
            ? 'No se encontraron usuarios con esa búsqueda.'
            : 'No hay usuarios registrados.'}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Usuario</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-[160px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.avatar_url || undefined} alt={u.full_name || u.email} />
                        <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                          {getInitials(u.full_name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {u.full_name || 'Sin nombre'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Sin roles</span>
                      ) : u.roles.length > 3 ? (
                        <>
                          {u.roles.slice(0, 3).map((role) => (
                            <Badge
                              key={role.name}
                              variant="outline"
                              className={`text-xs ${getRoleBadgeClass(role.name)}`}
                            >
                              {ROLE_DISPLAY_INFO[role.name]?.displayName || role.display_name}
                            </Badge>
                          ))}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-gray-50 text-gray-600 border-gray-300 cursor-help"
                                >
                                  +{u.roles.length - 3} más
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {u.roles.slice(3).map((role) => (
                                    <div key={role.name} className="text-xs">
                                      {ROLE_DISPLAY_INFO[role.name]?.displayName || role.display_name}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      ) : (
                        u.roles.map((role) => (
                          <Badge
                            key={role.name}
                            variant="outline"
                            className={`text-xs ${getRoleBadgeClass(role.name)}`}
                          >
                            {ROLE_DISPLAY_INFO[role.name]?.displayName || role.display_name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <UserActionsDropdown
                      targetUser={u}
                      currentUserId={currentUser?.id || ''}
                      onManageRoles={handleManageRoles}
                      onUserDeleted={fetchUsers}
                      callAdminUserMgmt={callAdminUserMgmt}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {selectedUser && (
        <RoleAssignmentModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelectedUser(null);
          }}
          targetUser={selectedUser}
          onRolesUpdated={handleRolesUpdated}
        />
      )}

      {/* Add User Dialog */}
      <AddUserDialog
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        onUserCreated={fetchUsers}
        callAdminUserMgmt={callAdminUserMgmt}
      />
    </div>
  );
};

export default UserRoleManager;
