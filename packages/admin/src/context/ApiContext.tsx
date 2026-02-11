import { createContext, useContext, ReactNode, useMemo } from 'react';
import { AdminApiService } from '../services/adminApi';
import { useAuth } from './AuthContext';

interface ApiContextValue {
  api: AdminApiService;
}

const ApiContext = createContext<ApiContextValue | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const { keycloak } = useAuth();

  const api = useMemo(() => {
    return new AdminApiService({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      getToken: () => keycloak?.token || null,
      onUnauthorized: () => {
        keycloak?.logout();
      },
    });
  }, [keycloak]);

  return (
    <ApiContext.Provider value={{ api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}
