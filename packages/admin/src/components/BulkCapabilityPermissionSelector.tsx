/**
 * Bulk Capability Permission Selector
 * 
 * Enhanced version that allows selecting multiple capabilities at once
 * and setting permissions in bulk for better efficiency
 */

import React, { useState } from 'react';
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
  Checkbox,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import { Delete as DeleteIcon, SelectAll as SelectAllIcon } from '@mui/icons-material';
import type { Capability } from '../types/organization.types';

interface BulkCapabilityPermissionSelectorProps {
  capabilities: Capability[];
  selectedPermissions: Record<string, 'admin' | 'write' | 'read'>;
  onChange: (permissions: Record<string, 'admin' | 'write' | 'read'>) => void;
  availableCapabilities?: string[]; // Filter to only show these capabilities
}

export const BulkCapabilityPermissionSelector: React.FC<BulkCapabilityPermissionSelectorProps> = ({
  capabilities,
  selectedPermissions,
  onChange,
  availableCapabilities,
}) => {
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [bulkPermission, setBulkPermission] = useState<'admin' | 'write' | 'read'>('read');

  // Filter capabilities based on organisation's enabled capabilities
  const filteredCapabilities = availableCapabilities
    ? capabilities.filter((cap) => availableCapabilities.includes(cap.name))
    : capabilities;

  // Get capabilities that haven't been added yet
  const availableToAdd = filteredCapabilities.filter(
    (cap) => !selectedPermissions[cap.name]
  );

  const handleToggleCapability = (capName: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(capName)
        ? prev.filter((name) => name !== capName)
        : [...prev, capName]
    );
  };

  const handleSelectAll = () => {
    if (selectedCapabilities.length === availableToAdd.length) {
      setSelectedCapabilities([]);
    } else {
      setSelectedCapabilities(availableToAdd.map((cap) => cap.name));
    }
  };

  const handleAddSelected = () => {
    if (selectedCapabilities.length === 0) return;

    const newPermissions = { ...selectedPermissions };
    selectedCapabilities.forEach((capName) => {
      newPermissions[capName] = bulkPermission;
    });

    onChange(newPermissions);
    setSelectedCapabilities([]);
  };

  const handleAddAllWithPermission = (permission: 'admin' | 'write' | 'read') => {
    const newPermissions = { ...selectedPermissions };
    availableToAdd.forEach((cap) => {
      newPermissions[cap.name] = permission;
    });
    onChange(newPermissions);
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

  const getCapabilityDescription = (name: string) => {
    const cap = capabilities.find((c) => c.name === name);
    return cap?.description || '';
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Capability Permissions
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Select multiple capabilities and assign permissions in bulk for faster configuration.
      </Typography>

      {/* Quick Actions */}
      {availableToAdd.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, mt: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Add All Capabilities
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleAddAllWithPermission('read')}
            >
              All as Read
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleAddAllWithPermission('write')}
            >
              All as Write
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleAddAllWithPermission('admin')}
            >
              All as Admin
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Bulk Selection */}
      {availableToAdd.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle2">
              Select Capabilities ({selectedCapabilities.length} selected)
            </Typography>
            <Button
              size="small"
              startIcon={<SelectAllIcon />}
              onClick={handleSelectAll}
            >
              {selectedCapabilities.length === availableToAdd.length ? 'Deselect All' : 'Select All'}
            </Button>
          </Box>

          <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
            {availableToAdd.map((cap) => (
              <Box
                key={cap.name}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  p: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                  borderRadius: 1,
                }}
              >
                <Checkbox
                  checked={selectedCapabilities.includes(cap.name)}
                  onChange={() => handleToggleCapability(cap.name)}
                />
                <Box sx={{ flex: 1, ml: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {cap.displayName}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {getCapabilityDescription(cap.name)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Permission Level</InputLabel>
              <Select
                value={bulkPermission}
                label="Permission Level"
                onChange={(e) => setBulkPermission(e.target.value as 'admin' | 'write' | 'read')}
              >
                <MenuItem value="read">Read</MenuItem>
                <MenuItem value="write">Write</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleAddSelected}
              disabled={selectedCapabilities.length === 0}
            >
              Add {selectedCapabilities.length > 0 ? `${selectedCapabilities.length} ` : ''}Selected
            </Button>
          </Box>
        </Paper>
      )}

      {/* Configured Permissions Table */}
      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
        Configured Permissions ({Object.keys(selectedPermissions).length})
      </Typography>
      
      {Object.keys(selectedPermissions).length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Capability</TableCell>
                <TableCell width="200">Permission Level</TableCell>
                <TableCell width="80" align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(selectedPermissions)
                .sort(([a], [b]) => getCapabilityDisplayName(a).localeCompare(getCapabilityDisplayName(b)))
                .map(([capName, permission]) => (
                  <TableRow key={capName}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {getCapabilityDisplayName(capName)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {getCapabilityDescription(capName)}
                      </Typography>
                    </TableCell>
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
                          <MenuItem value="read">
                            <Chip label="Read" size="small" color="default" />
                          </MenuItem>
                          <MenuItem value="write">
                            <Chip label="Write" size="small" color="primary" />
                          </MenuItem>
                          <MenuItem value="admin">
                            <Chip label="Admin" size="small" color="secondary" />
                          </MenuItem>
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
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            No capability permissions configured yet.
            {availableToAdd.length > 0 
              ? ' Use the quick actions above or select capabilities to add them.'
              : ' All available capabilities have been added.'}
          </Typography>
        </Paper>
      )}

      <Box mt={2}>
        <Typography variant="caption" color="textSecondary">
          <strong>Read:</strong> View data only • <strong>Write:</strong> Create and edit data •{' '}
          <strong>Admin:</strong> Full control including delete
        </Typography>
      </Box>
    </Box>
  );
};
