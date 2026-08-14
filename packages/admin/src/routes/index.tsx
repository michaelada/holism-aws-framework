import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { ProtectedRoute } from '../components';
import { DashboardPage } from '../pages/DashboardPage';
import { UsersPage } from '../pages/UsersPage';
import { RolesPage } from '../pages/RolesPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { OrganizationTypesPage } from '../pages/OrganizationTypesPage';
import { OrganizationTypeDetailsPage } from '../pages/OrganizationTypeDetailsPage';
import { CreateOrganizationTypePage } from '../pages/CreateOrganizationTypePage';
import { EditOrganizationTypePage } from '../pages/EditOrganizationTypePage';
import { OrganizationsPage } from '../pages/OrganizationsPage';
import { OrganizationDetailsPage } from '../pages/OrganizationDetailsPage';
import { EditOrganizationPage } from '../pages/EditOrganizationPage';
import { CreateOrganizationPage } from '../pages/CreateOrganizationPage';
import { AddOrganizationAdminUserPage } from '../pages/AddOrganizationAdminUserPage';
import { CreateOrganizationRolePage } from '../pages/CreateOrganizationRolePage';

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ py: 6, maxWidth: '60ch' }}>
      <Typography variant="h1" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        That address does not match anything in the platform admin. It may have been renamed, or
        the link may be out of date.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')}>
        Go to the dashboard
      </Button>
    </Box>
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
            <OrganizationTypeDetailsPage />
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
        path="/organizations/new"
        element={
          <ProtectedRoute>
            <CreateOrganizationPage />
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
        path="/organizations/:id/users/add"
        element={
          <ProtectedRoute>
            <AddOrganizationAdminUserPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organizations/:id/roles/create"
        element={
          <ProtectedRoute>
            <CreateOrganizationRolePage />
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
