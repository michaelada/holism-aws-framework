import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useMetadataApi, useInstancesApi } from '../context';
import {
  MetadataTable,
  ObjectDefinition,
  FieldDefinition,
} from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function ObjectInstancesPage() {
  const { objectType } = useParams<{ objectType: string }>();
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const instancesApi = useInstancesApi();
  
  const [objectDef, setObjectDef] = useState<ObjectDefinition | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!objectType) {
      navigate('/objects');
      return;
    }

    const loadMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        const [objDef, fieldsData] = await Promise.all([
          metadataApi.getObject(objectType),
          metadataApi.getFields(),
        ]);
        setObjectDef(objDef);
        // Filter fields to only those used in this object
        const objectFieldNames = objDef.fields?.map(f => f.fieldShortName) || [];
        const relevantFields = fieldsData.filter(f => objectFieldNames.includes(f.shortName));
        setFields(relevantFields);
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

  const handleExportToExcel = async () => {
    if (!objectDef || !objectType) return;

    try {
      setExporting(true);
      setError(null);

      // Fetch all instances matching current search criteria (no pagination)
      const allInstances = await instancesApi.listInstances(objectType, {
        page: 1,
        pageSize: 10000, // Large number to get all results
        search: currentSearchTerm || undefined,
      });

      // Dynamically import xlsx library
      const XLSX = await import('xlsx');

      // Prepare data for export - include ALL fields, not just those in table
      const exportData = allInstances.data.map((instance: any) => {
        const row: any = {};
        
        // Add all fields from object definition in order
        objectDef.fields?.forEach((fieldRef) => {
          const field = fields.find(f => f.shortName === fieldRef.fieldShortName);
          if (field) {
            const value = instance[field.shortName];
            // Format the value for Excel
            if (value === null || value === undefined) {
              row[field.displayName] = '';
            } else if (Array.isArray(value)) {
              row[field.displayName] = value.join(', ');
            } else if (typeof value === 'object') {
              row[field.displayName] = JSON.stringify(value);
            } else {
              row[field.displayName] = value;
            }
          }
        });

        return row;
      });

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, objectDef.displayName);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${objectDef.displayName}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to export data');
      }
    } finally {
      setExporting(false);
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
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportToExcel}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
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
        onSearchChange={setCurrentSearchTerm}
        pageSize={20}
      />
    </Box>
  );
}
