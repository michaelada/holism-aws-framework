import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import FieldDefinitionsPage from '../pages/FieldDefinitionsPage';
import ObjectDefinitionsPage from '../pages/ObjectDefinitionsPage';
import ObjectInstancesPage from '../pages/ObjectInstancesPage';
import EditInstancePage from '../pages/EditInstancePage';
import NotFoundPage from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fields" element={<FieldDefinitionsPage />} />
      <Route path="/objects" element={<ObjectDefinitionsPage />} />
      <Route path="/objects/:objectType/instances" element={<ObjectInstancesPage />} />
      <Route path="/objects/:objectType/instances/new" element={<EditInstancePage />} />
      <Route path="/objects/:objectType/instances/:instanceId/edit" element={<EditInstancePage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
