import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '../components';
import { TenantsPage } from '../pages/TenantsPage';
import { TenantDetailsPage } from '../pages/TenantDetailsPage';
import { UsersPage } from '../pages/UsersPage';
import { RolesPage } from '../pages/RolesPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { OrganizationTypesPage } from '../pages/OrganizationTypesPage';
import { CreateOrganizationTypePage } from '../pages/CreateOrganizationTypePage';
import { EditOrganizationTypePage } from '../pages/EditOrganizationTypePage';
import { OrganizationsPage } from '../pages/OrganizationsPage';
import { OrganizationDetailsPage } from '../pages/OrganizationDetailsPage';
import { EditOrganizationPage } from '../pages/EditOrganizationPage';

// Placeholder components - will be implemented in later tasks
function DashboardPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the Admin Portal</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization-types"
        element={
          <ProtectedRoute>
            <OrganizationTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization-types/new"
        element={
          <ProtectedRoute>
            <CreateOrganizationTypePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization-types/:id/edit"
        element={
          <ProtectedRoute>
            <EditOrganizationTypePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organization-types/:id"
        element={
          <ProtectedRoute>
            <OrganizationTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations"
        element={
          <ProtectedRoute>
            <OrganizationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations/:id"
        element={
          <ProtectedRoute>
            <OrganizationDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations/:id/edit"
        element={
          <ProtectedRoute>
            <EditOrganizationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenants"
        element={
          <ProtectedRoute>
            <TenantsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenants/:tenantId"
        element={
          <ProtectedRoute>
            <TenantDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute>
            <RolesPage />
          </ProtectedRoute>
        }
      />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
