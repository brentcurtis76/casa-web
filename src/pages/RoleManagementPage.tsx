/**
 * RoleManagementPage — Admin page for managing roles and permissions.
 *
 * Route: /admin/roles
 * Access: general_admin only (enforced by ProtectedRoute in App.tsx)
 */

import React from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import RoleEditor from '@/components/admin/RoleEditor';

const RoleManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Gestión de Roles"
        subtitle="Administra los roles y permisos de acceso a los módulos de CASA"
        breadcrumbs={[{ label: 'Gestión de Roles' }]}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <RoleEditor />
        </div>
      </div>
    </div>
  );
};

export default RoleManagementPage;
