import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useMetadataApi, useInstancesApi } from '../context';
import {
  MetadataForm,
  MetadataWizard,
  ObjectDefinition,
} from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function EditInstancePage() {
  const { objectType, instanceId } = useParams<{ objectType: string; instanceId: string }>();
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const instancesApi = useInstancesApi();
  
  const [objectDef, setObjectDef] = useState<ObjectDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

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

  const handleSubmit = async (data: any) => {
    try {
      setError(null);
      if (instanceId) {
        await instancesApi.updateInstance(objectType!, instanceId, data);
      } else {
        await instancesApi.createInstance(objectType!, data);
      }
      navigate(`/objects/${objectType}/instances`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to save instance');
      }
      throw err;
    }
  };

  const handleCancel = () => {
    navigate(`/objects/${objectType}/instances`);
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

  const hasWizard = !!objectDef.wizardConfig;
  const isEdit = !!instanceId;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/objects/${objectType}/instances`)}
          sx={{ mr: 2 }}
        >
          Back to List
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            {isEdit ? 'Edit' : 'Create'} {objectDef.displayName}
          </Typography>
          {objectDef.description && (
            <Typography variant="body2" color="text.secondary">
              {objectDef.description}
            </Typography>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        {hasWizard && !isEdit ? (
          <>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
              <Tab label="Standard Form" />
              <Tab label="Wizard" />
            </Tabs>
            {tabValue === 0 ? (
              <MetadataForm
                objectType={objectType!}
                instanceId={instanceId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            ) : (
              <MetadataWizard
                objectType={objectType!}
                onComplete={handleSubmit}
                onCancel={handleCancel}
              />
            )}
          </>
        ) : (
          <MetadataForm
            objectType={objectType!}
            instanceId={instanceId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </Paper>
    </Box>
  );
}
