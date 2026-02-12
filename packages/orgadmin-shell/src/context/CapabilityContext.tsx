import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface CapabilityContextType {
  capabilities: string[];
  loading: boolean;
  error: string | null;
  hasCapability: (capability: string) => boolean;
  refetch: () => Promise<void>;
}

const CapabilityContext = createContext<CapabilityContextType | undefined>(undefined);

interface CapabilityProviderProps {
  children: ReactNode;
  capabilities?: string[]; // Allow passing capabilities directly for testing
}

export const CapabilityProvider: React.FC<CapabilityProviderProps> = ({ 
  children, 
  capabilities: initialCapabilities 
}) => {
  const [capabilities, setCapabilities] = useState<string[]>(initialCapabilities || []);
  const [loading, setLoading] = useState<boolean>(!initialCapabilities);
  const [error, setError] = useState<string | null>(null);

  const fetchCapabilities = async () => {
    // Skip fetching if capabilities were provided directly
    if (initialCapabilities) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/orgadmin/auth/capabilities', {
        baseURL: import.meta.env.VITE_API_BASE_URL,
        withCredentials: true,
      });
      
      setCapabilities(response.data.capabilities || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load capabilities';
      setError(errorMessage);
      console.error('Error fetching capabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const hasCapability = (capability: string): boolean => {
    return capabilities.includes(capability);
  };

  const value: CapabilityContextType = {
    capabilities,
    loading,
    error,
    hasCapability,
    refetch: fetchCapabilities,
  };

  return (
    <CapabilityContext.Provider value={value}>
      {children}
    </CapabilityContext.Provider>
  );
};

export const useCapabilities = (): CapabilityContextType => {
  const context = useContext(CapabilityContext);
  if (context === undefined) {
    throw new Error('useCapabilities must be used within a CapabilityProvider');
  }
  return context;
};
