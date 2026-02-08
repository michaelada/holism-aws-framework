import React, { createContext, useContext, useMemo } from 'react';
import { ApiClient, MetadataApi, InstancesApi } from '../api';

interface ApiContextValue {
  client: ApiClient;
  metadata: MetadataApi;
  instances: InstancesApi;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  children: React.ReactNode;
  baseURL?: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export function ApiProvider({
  children,
  baseURL = '',
  getToken,
  onUnauthorized,
}: ApiProviderProps) {
  const value = useMemo(() => {
    const client = new ApiClient({
      baseURL,
      getToken,
      onUnauthorized,
    });

    return {
      client,
      metadata: new MetadataApi(client),
      instances: new InstancesApi(client),
    };
  }, [baseURL, getToken, onUnauthorized]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}

export function useMetadataApi() {
  const { metadata } = useApi();
  return metadata;
}

export function useInstancesApi() {
  const { instances } = useApi();
  return instances;
}
