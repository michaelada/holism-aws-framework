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
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMetadataApi } from '../context';
import { FieldDefinition } from '@aws-web-framework/components';
import { ApiError, NetworkError } from '../api';

export default function FieldDefinitionsPage() {
  const navigate = useNavigate();
  const metadataApi = useMetadataApi();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFields = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await metadataApi.getFields();
      setFields(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to load field definitions');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleDelete = async (shortName: string) => {
    if (!confirm('Are you sure you want to delete this field definition?')) {
      return;
    }

    try {
      setError(null);
      await metadataApi.deleteField(shortName);
      loadFields();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError('Failed to delete field definition');
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Field Definitions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/fields/new')}
        >
          Create Field
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
              <TableCell>Datatype</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No field definitions found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field) => (
                <TableRow key={field.shortName}>
                  <TableCell>{field.shortName}</TableCell>
                  <TableCell>{field.displayName}</TableCell>
                  <TableCell>{field.datatype}</TableCell>
                  <TableCell>{field.description}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/fields/${field.shortName}/edit`)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(field.shortName)}
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
