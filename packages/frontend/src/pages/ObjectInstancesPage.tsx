import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useMetadataApi, useInstancesApi } from '../context';
import {
  MetadataTable,
  ObjectDefinition,
} from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function ObjectInstancesPage() {
  const { objectType } = useParams<{ objectType: string }>();
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const instancesApi = useInstancesApi();
  
  const [objectDef, setObjectDef] = useState<ObjectDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!objectType) {
      navigate('/objects');
      return;
    }

    const loadMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        const objDef = await metadataApi.getObject(objectType);
        setObjectDef(objDef);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError(`Object type "${objectType}" not found`);
          } else {
            setError(err.message);
          }
        } else if (err instanceof NetworkError) {
          setError(err.message);
        } else {
          setError('Failed to load object definition');
        }
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [objectType, metadataApi, navigate]);

  const handleEdit = (instance: any) => {
    navigate(`/objects/${objectType}/instances/${instance.id}/edit`);
  };

  const handleDelete = async (instance: any) => {
    if (!confirm('Are you sure you want to delete this instance?')) {
      return;
    }

    try {
      setError(null);
      await instancesApi.deleteInstance(objectType!, instance.id);
      setRefreshKey((prev) => prev + 1); // Trigger table refresh
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to delete instance');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!objectDef) {
    return (
      <Box>
        <Alert severity="error">{error || 'Object definition not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/objects')}>
          Back to Objects
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {objectDef.displayName} Instances
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {objectDef.description}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={() => navigate('/objects')}>Back to Objects</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/objects/${objectType}/instances/new`)}
          >
            Create Instance
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <MetadataTable
        key={refreshKey}
        objectType={objectType!}
        onEdit={handleEdit}
        onDelete={handleDelete}
        pageSize={20}
      />
    </Box>
  );
}
