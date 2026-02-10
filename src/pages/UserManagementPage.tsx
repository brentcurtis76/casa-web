/**
 * UserManagementPage — Admin page for managing users and their roles.
 *
 * Route: /admin/users
 * Access: general_admin only (enforced by ProtectedRoute in App.tsx)
 */

import React from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import UserRoleManager from '@/components/admin/UserRoleManager';

const UserManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Gestión de Usuarios"
        subtitle="Administra los roles y permisos de los usuarios de CASA"
        breadcrumbs={[{ label: 'Gestión de Usuarios' }]}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <UserRoleManager />
        </div>
      </div>
    </div>
  );
};

export default UserManagementPage;
