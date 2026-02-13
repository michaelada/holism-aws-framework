/**
 * Members Database Page
 * 
 * Comprehensive member records with advanced filtering, batch operations, and Excel export
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
  FileDownload as ExportIcon,
  Label as LabelIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import type { Member, MemberFilter } from '../types/membership.types';
import CreateCustomFilterDialog from '../components/CreateCustomFilterDialog';
import BatchOperationsDialog from '../components/BatchOperationsDialog';

// Mock API hook
const useApi = () => ({
  execute: async (_params: { method: string; url: string }) => {
    return [];
  },
});

const MembersDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();

  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'current' | 'elapsed' | 'all'>('current');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customFilters, setCustomFilters] = useState<MemberFilter[]>([]);
  const [selectedCustomFilter, setSelectedCustomFilter] = useState<string>('');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels'>('mark_processed');

  useEffect(() => {
    loadMembers();
    loadCustomFilters();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter, selectedCustomFilter]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/members',
      });
      setMembers(response || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomFilters = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/member-filters',
      });
      setCustomFilters(response || []);
    } catch (error) {
      console.error('Failed to load custom filters:', error);
    }
  };

  const filterMembers = () => {
    let filtered = [...members];

    // Apply status filter
    if (statusFilter === 'current') {
      filtered = filtered.filter(m => m.status === 'active' || m.status === 'pending');
    } else if (statusFilter === 'elapsed') {
      filtered = filtered.filter(m => m.status === 'elapsed');
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.membershipNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply custom filter (simplified - would need full implementation)
    if (selectedCustomFilter) {
      // Custom filter logic would go here
    }

    setFilteredMembers(filtered);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedMembers(filteredMembers.map(m => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleViewMember = (memberId: string) => {
    navigate(`/orgadmin/members/${memberId}`);
  };

  const handleEditMember = (memberId: string) => {
    navigate(`/orgadmin/members/${memberId}/edit`);
  };

  const handleToggleProcessed = async (memberId: string, _currentStatus: boolean) => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${memberId}`,
      });
      loadMembers();
    } catch (error) {
      console.error('Failed to update processed status:', error);
    }
  };

  const handleBatchOperation = (operation: typeof batchOperation) => {
    setBatchOperation(operation);
    setBatchDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      // Export logic would go here
      console.log('Exporting members...');
    } catch (error) {
      console.error('Failed to export members:', error);
    }
  };

  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'elapsed':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Members Database</Typography>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExport}
        >
          Export to Excel
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Search by name or membership number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Custom Filter</InputLabel>
              <Select
                value={selectedCustomFilter}
                label="Custom Filter"
                onChange={(e) => setSelectedCustomFilter(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {customFilters.map((filter) => (
                  <MenuItem key={filter.id} value={filter.id}>
                    {filter.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setFilterDialogOpen(true)}
            >
              Create Filter
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, value) => value && setStatusFilter(value)}
              size="small"
            >
              <ToggleButton value="current">Current</ToggleButton>
              <ToggleButton value="elapsed">Elapsed</ToggleButton>
              <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>

            {selectedMembers.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_processed')}
                >
                  Mark Processed
                </Button>
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_unprocessed')}
                >
                  Mark Unprocessed
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('add_labels')}
                >
                  Add Labels
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('remove_labels')}
                >
                  Remove Labels
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                  indeterminate={selectedMembers.length > 0 && selectedMembers.length < filteredMembers.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Membership Type</TableCell>
              <TableCell>First Name</TableCell>
              <TableCell>Last Name</TableCell>
              <TableCell>Membership Number</TableCell>
              <TableCell>Date Last Renewed</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Valid Until</TableCell>
              <TableCell>Labels</TableCell>
              <TableCell>Processed</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => handleSelectMember(member.id)}
                    />
                  </TableCell>
                  <TableCell>{member.membershipTypeId}</TableCell>
                  <TableCell>{member.firstName}</TableCell>
                  <TableCell>{member.lastName}</TableCell>
                  <TableCell>{member.membershipNumber}</TableCell>
                  <TableCell>{formatDate(member.dateLastRenewed)}</TableCell>
                  <TableCell>
                    <Chip
                      label={member.status}
                      color={getStatusColor(member.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(member.validUntil)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {member.labels.slice(0, 2).map((label) => (
                        <Chip key={label} label={label} size="small" />
                      ))}
                      {member.labels.length > 2 && (
                        <Chip label={`+${member.labels.length - 2}`} size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleProcessed(member.id, member.processed)}
                    >
                      {member.processed ? <ProcessedIcon color="success" /> : <UnprocessedIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewMember(member.id)}
                      title="View"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditMember(member.id)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateCustomFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSave={() => {
          setFilterDialogOpen(false);
          loadCustomFilters();
        }}
      />

      <BatchOperationsDialog
        open={batchDialogOpen}
        operation={batchOperation}
        selectedMembers={selectedMembers}
        onClose={() => setBatchDialogOpen(false)}
        onComplete={() => {
          setBatchDialogOpen(false);
          setSelectedMembers([]);
          loadMembers();
        }}
      />
    </Box>
  );
};

export default MembersDatabasePage;
