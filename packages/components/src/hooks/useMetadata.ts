import { useState, useEffect, useCallback } from 'react';
import type { ObjectDefinition, FieldDefinition } from '../types';
import { defaultApiClient, ApiClient } from '../api';

export interface UseMetadataOptions {
  apiClient?: ApiClient;
}

export interface UseMetadataResult {
  objectDef: ObjectDefinition | null;
  fields: FieldDefinition[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch object and field definitions from the metadata service
 * 
 * @param objectType - Short name of the object definition to fetch
 * @param options - Configuration options
 * @returns Object definition, field definitions, loading state, and error
 * 
 * @example
 * ```tsx
 * const { objectDef, fields, loading, error } = useMetadata('customer');
 * 
 * if (loading) return <CircularProgress />;
 * if (error) return <Alert severity="error">{error.message}</Alert>;
 * if (!objectDef) return null;
 * 
 * return <MetadataForm objectType="customer" />;
 * ```
 */
export function useMetadata(
  objectType: string,
  options: UseMetadataOptions = {}
): UseMetadataResult {
  const { apiClient = defaultApiClient } = options;
  
  const [objectDef, setObjectDef] = useState<ObjectDefinition | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetadata = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch object definition
      const objDef = await apiClient.get<ObjectDefinition>(
        `/api/metadata/objects/${objectType}`
      );
      setObjectDef(objDef);

      // Fetch all field definitions referenced by the object
      if (!objDef.fields || objDef.fields.length === 0) {
        setFields([]);
        setLoading(false);
        return;
      }

      const fieldPromises = objDef.fields.map(async (fieldRef) => {
        try {
          return await apiClient.get<FieldDefinition>(
            `/api/metadata/fields/${fieldRef.fieldShortName}`
          );
        } catch (err) {
          console.error(`Failed to fetch field ${fieldRef.fieldShortName}:`, err);
          return null;
        }
      });

      const fetchedFields = await Promise.all(fieldPromises);
      
      // Filter out null values (failed fetches) and sort
      const validFields = fetchedFields.filter((f): f is FieldDefinition => f !== null);
      
      const sortedFields = validFields.sort((a, b) => {
        const orderA = objDef.fields.find(f => f.fieldShortName === a.shortName)?.order ?? 0;
        const orderB = objDef.fields.find(f => f.fieldShortName === b.shortName)?.order ?? 0;
        return orderA - orderB;
      });

      setFields(sortedFields);
      
      // If some fields failed to load, set an error
      if (validFields.length < objDef.fields.length) {
        const missingFields = objDef.fields
          .filter(ref => !validFields.some(f => f.shortName === ref.fieldShortName))
          .map(ref => ref.fieldShortName);
        setError(new Error(`Some field definitions not found: ${missingFields.join(', ')}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metadata'));
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return {
    objectDef,
    fields,
    loading,
    error,
    refetch: fetchMetadata,
  };
}

/**
 * Hook to fetch all object definitions
 */
export function useObjectDefinitions(options: UseMetadataOptions = {}) {
  const { apiClient = defaultApiClient } = options;
  
  const [objectDefs, setObjectDefs] = useState<ObjectDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchObjectDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const defs = await apiClient.get<ObjectDefinition[]>('/api/metadata/objects');
      setObjectDefs(defs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch object definitions'));
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchObjectDefinitions();
  }, [fetchObjectDefinitions]);

  return {
    objectDefs,
    loading,
    error,
    refetch: fetchObjectDefinitions,
  };
}

/**
 * Hook to fetch all field definitions
 */
export function useFieldDefinitions(options: UseMetadataOptions = {}) {
  const { apiClient = defaultApiClient } = options;
  
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFieldDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const defs = await apiClient.get<FieldDefinition[]>('/api/metadata/fields');
      setFieldDefs(defs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch field definitions'));
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchFieldDefinitions();
  }, [fetchFieldDefinitions]);

  return {
    fieldDefs,
    loading,
    error,
    refetch: fetchFieldDefinitions,
  };
}
