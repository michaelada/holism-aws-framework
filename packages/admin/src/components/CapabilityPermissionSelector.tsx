import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { Capability } from '../types/organization.types';

interface CapabilityPermissionSelectorProps {
  capabilities: Capability[];
  selectedPermissions: Record<string, 'admin' | 'write' | 'read'>;
  onChange: (permissions: Record<string, 'admin' | 'write' | 'read'>) => void;
  availableCapabilities?: string[]; // Filter to only show these capabilities
}

export const CapabilityPermissionSelector: React.FC<CapabilityPermissionSelectorProps> = ({
  capabilities,
  selectedPermissions,
  onChange,
  availableCapabilities,
}) => {
  const [selectedCapability, setSelectedCapability] = React.useState('');

  // Filter capabilities based on organisation's enabled capabilities
  const filteredCapabilities = availableCapabilities
    ? capabilities.filter((cap) => availableCapabilities.includes(cap.name))
    : capabilities;

  // Get capabilities that haven't been added yet
  const availableToAdd = filteredCapabilities.filter(
    (cap) => !selectedPermissions[cap.name]
  );

  const handleAddCapability = () => {
    if (selectedCapability) {
      onChange({
        ...selectedPermissions,
        [selectedCapability]: 'read', // Default to read permission
      });
      setSelectedCapability('');
    }
  };

  const handleChangePermission = (capabilityName: string, permission: 'admin' | 'write' | 'read') => {
    onChange({
      ...selectedPermissions,
      [capabilityName]: permission,
    });
  };

  const handleRemoveCapability = (capabilityName: string) => {
    const newPermissions = { ...selectedPermissions };
    delete newPermissions[capabilityName];
    onChange(newPermissions);
  };

  const getCapabilityDisplayName = (name: string) => {
    const cap = capabilities.find((c) => c.name === name);
    return cap?.displayName || name;
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Capability Permissions
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Define what level of access this role has for each capability.
      </Typography>

      {/* Add Capability Selector */}
      <Box display="flex" gap={2} mb={2} mt={2}>
        <FormControl fullWidth size="small">
          <InputLabel>Add Capability</InputLabel>
          <Select
            value={selectedCapability}
            label="Add Capability"
            onChange={(e) => setSelectedCapability(e.target.value)}
          >
            {availableToAdd.length === 0 ? (
              <MenuItem value="" disabled>
                All capabilities added
              </MenuItem>
            ) : (
              availableToAdd.map((cap) => (
                <MenuItem key={cap.name} value={cap.name}>
                  {cap.displayName}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        <Box>
          <button
            type="button"
            onClick={handleAddCapability}
            disabled={!selectedCapability}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedCapability ? '#1976d2' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedCapability ? 'pointer' : 'not-allowed',
              height: '40px',
            }}
          >
            Add
          </button>
        </Box>
      </Box>

      {/* Permissions Table */}
      {Object.keys(selectedPermissions).length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Capability</TableCell>
                <TableCell>Permission Level</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(selectedPermissions).map(([capName, permission]) => (
                <TableRow key={capName}>
                  <TableCell>{getCapabilityDisplayName(capName)}</TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={permission}
                        onChange={(e) =>
                          handleChangePermission(
                            capName,
                            e.target.value as 'admin' | 'write' | 'read'
                          )
                        }
                      >
                        <MenuItem value="read">Read</MenuItem>
                        <MenuItem value="write">Write</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveCapability(capName)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            No capability permissions configured. Add capabilities above.
          </Typography>
        </Paper>
      )}

      <Box mt={1}>
        <Typography variant="caption" color="textSecondary">
          <strong>Read:</strong> View data only • <strong>Write:</strong> Create and edit data •{' '}
          <strong>Admin:</strong> Full control including delete
        </Typography>
      </Box>
    </Box>
  );
};
