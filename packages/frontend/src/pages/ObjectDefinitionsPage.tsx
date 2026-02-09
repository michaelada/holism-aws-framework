import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMetadataApi } from '../context';
import { ObjectDefinition } from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function ObjectDefinitionsPage() {
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const [objects, setObjects] = useState<ObjectDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const objectsData = await metadataApi.getObjects();
      setObjects(objectsData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (shortName: string) => {
    if (!confirm('Are you sure you want to delete this object definition?')) {
      return;
    }

    try {
      setError(null);
      await metadataApi.deleteObject(shortName);
      loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to delete object definition');
      }
    }
  };

  const handleViewInstances = (shortName: string) => {
    navigate(`/objects/${shortName}/instances`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Object Definitions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/objects/new')}
        >
          Create Object
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Short Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Fields</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {objects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No object definitions found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              objects.map((object) => (
                <TableRow key={object.shortName}>
                  <TableCell>{object.shortName}</TableCell>
                  <TableCell>{object.displayName}</TableCell>
                  <TableCell>{object.description}</TableCell>
                  <TableCell>
                    {object.fields?.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {object.fields.slice(0, 3).map((field) => (
                          <Chip
                            key={field.fieldShortName}
                            label={field.fieldShortName}
                            size="small"
                          />
                        ))}
                        {object.fields.length > 3 && (
                          <Chip label={`+${object.fields.length - 3} more`} size="small" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No fields
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewInstances(object.shortName)}
                      title="View Instances"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/objects/${object.shortName}/edit`)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(object.shortName)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
