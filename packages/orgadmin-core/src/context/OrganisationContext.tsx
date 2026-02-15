import React, { createContext, useContext, ReactNode } from 'react';

/**
 * Organization data structure
 * Matches the backend Organization interface
 */
export interface Organisation {
  id: string;
  organizationTypeId: string;
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: 'active' | 'inactive' | 'blocked';
  currency?: string;
  language?: string;
  enabledCapabilities: string[];
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  organizationType?: {
    id: string;
    name: string;
    displayName: string;
    defaultLocale: string;
  };
}

interface OrganisationContextType {
  organisation: Organisation | null;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

interface OrganisationProviderProps {
  children: ReactNode;
  organisation: Organisation | null;
}

/**
 * OrganisationProvider for orgadmin-core modules
 * The shell should wrap the app with this provider
 */
export const OrganisationProvider: React.FC<OrganisationProviderProps> = ({ 
  children, 
  organisation 
}) => {
  const value: OrganisationContextType = {
    organisation,
  };

  return (
    <OrganisationContext.Provider value={value}>
      {children}
    </OrganisationContext.Provider>
  );
};

/**
 * useOrganisation hook
 * Access the current organisation data from any component
 */
export const useOrganisation = (): OrganisationContextType => {
  const context = useContext(OrganisationContext);
  if (context === undefined) {
    throw new Error('useOrganisation must be used within an OrganisationProvider');
  }
  return context;
};
