/**
 * Ticketing Dashboard Page
 * 
 * Real-time dashboard for managing electronic tickets with QR codes
 * Displays statistics, ticket list with filters, and batch operations
 */

import React, { useState, useEffect } from 'react';
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
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  CheckCircle as ScannedIcon,
  RadioButtonUnchecked as NotScannedIcon,
  FileDownload as ExportIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ElectronicTicket, TicketFilters } from '../types/ticketing.types';
import TicketingStatsCards from '../components/TicketingStatsCards';
import TicketDetailsDialog from '../components/TicketDetailsDialog';
import BatchTicketOperationsDialog from '../components/BatchTicketOperationsDialog';

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    return [];
  },
});

const TicketingDashboardPage: React.FC = () => {
  const { execute } = useApi();

  const [tickets, setTickets] = useState<ElectronicTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<ElectronicTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [ticketDetailsOpen, setTicketDetailsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ElectronicTicket | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'mark_scanned' | 'mark_not_scanned'>('mark_scanned');
  
  // Filters
  const [filters, setFilters] = useState<TicketFilters>({
    searchTerm: '',
  });
  const [eventFilter, setEventFilter] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>('');
  const [scanStatusFilter, setScanStatusFilter] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Auto-refresh for real-time updates
  useEffect(() => {
    loadTickets();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      loadTickets();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, filters, eventFilter, activityFilter, scanStatusFilter, dateRangeStart, dateRangeEnd]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/tickets',
      });
      setTickets(response || []);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Apply event filter
    if (eventFilter) {
      filtered = filtered.filter(t => t.eventId === eventFilter);
    }

    // Apply activity filter
    if (activityFilter) {
      filtered = filtered.filter(t => t.eventActivityId === activityFilter);
    }

    // Apply scan status filter
    if (scanStatusFilter.length > 0) {
      filtered = filtered.filter(t => scanStatusFilter.includes(t.scanStatus));
    }

    // Apply date range filter
    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart);
      filtered = filtered.filter(t => new Date(t.issueDate) >= startDate);
    }
    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd);
      filtered = filtered.filter(t => new Date(t.issueDate) <= endDate);
    }

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticketReference.toLowerCase().includes(searchLower) ||
        t.customerName.toLowerCase().includes(searchLower) ||
        t.customerEmail.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTickets(filtered);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTickets(filteredTickets.map(t => t.id));
    } else {
      setSelectedTickets([]);
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleViewTicket = (ticket: ElectronicTicket) => {
    setSelectedTicket(ticket);
    setTicketDetailsOpen(true);
  };

  const handleBatchOperation = (operation: 'mark_scanned' | 'mark_not_scanned') => {
    setBatchOperation(operation);
    setBatchDialogOpen(true);
  };

  const handleExportToExcel = async () => {
    try {
      // Export filtered tickets to Excel
      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/tickets/export',
      });
      // Handle download
      console.log('Export successful');
    } catch (error) {
      console.error('Failed to export tickets:', error);
    }
  };

  const handleRefresh = () => {
    loadTickets();
  };

  const getScanStatusColor = (scanStatus: string) => {
    return scanStatus === 'scanned' ? 'success' : 'default';
  };

  const getScanStatusIcon = (scanStatus: string) => {
    return scanStatus === 'scanned' ? <ScannedIcon /> : <NotScannedIcon />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Event Ticketing</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<ExportIcon />}
            onClick={handleExportToExcel}
            disabled={filteredTickets.length === 0}
          >
            Export to Excel
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <TicketingStatsCards tickets={tickets} />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Event</InputLabel>
              <Select
                value={eventFilter}
                label="Event"
                onChange={(e: SelectChangeEvent) => setEventFilter(e.target.value)}
              >
                <MenuItem value="">All Events</MenuItem>
                {/* Event options would be populated from API */}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Event Activity</InputLabel>
              <Select
                value={activityFilter}
                label="Event Activity"
                onChange={(e: SelectChangeEvent) => setActivityFilter(e.target.value)}
                disabled={!eventFilter}
              >
                <MenuItem value="">All Activities</MenuItem>
                {/* Activity options would be populated from API */}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Scan Status</InputLabel>
              <Select
                multiple
                value={scanStatusFilter}
                label="Scan Status"
                onChange={(e: SelectChangeEvent<string[]>) => {
                  const value = e.target.value;
                  setScanStatusFilter(typeof value === 'string' ? value.split(',') : value);
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value === 'scanned' ? 'Scanned' : 'Not Scanned'} size="small" />
                    ))}
                  </Box>
                )}
              >
                <MenuItem value="scanned">Scanned</MenuItem>
                <MenuItem value="not_scanned">Not Scanned</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              label="Date From"
              type="date"
              value={dateRangeStart}
              onChange={(e) => setDateRangeStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              size="small"
              label="Date To"
              type="date"
              value={dateRangeEnd}
              onChange={(e) => setDateRangeEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              size="small"
              placeholder="Search by name, email, or ticket reference..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Batch Operations */}
      {selectedTickets.length > 0 && (
        <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1">
                {selectedTickets.length} ticket(s) selected
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleBatchOperation('mark_scanned')}
                >
                  Mark as Scanned
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => handleBatchOperation('mark_not_scanned')}
                >
                  Mark as Not Scanned
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tickets Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                  indeterminate={selectedTickets.length > 0 && selectedTickets.length < filteredTickets.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Ticket Reference</TableCell>
              <TableCell>Event Name</TableCell>
              <TableCell>Event Activity</TableCell>
              <TableCell>Customer Name</TableCell>
              <TableCell>Customer Email</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Scan Status</TableCell>
              <TableCell>Scan Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  Loading tickets...
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTickets.includes(ticket.id)}
                      onChange={() => handleSelectTicket(ticket.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {ticket.ticketReference}
                    </Typography>
                  </TableCell>
                  <TableCell>{ticket.ticketData?.eventName || 'N/A'}</TableCell>
                  <TableCell>{ticket.ticketData?.activityName || 'N/A'}</TableCell>
                  <TableCell>{ticket.customerName}</TableCell>
                  <TableCell>{ticket.customerEmail}</TableCell>
                  <TableCell>{format(new Date(ticket.issueDate), 'MMM dd, yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <Chip
                      icon={getScanStatusIcon(ticket.scanStatus)}
                      label={ticket.scanStatus === 'scanned' ? 'Scanned' : 'Not Scanned'}
                      color={getScanStatusColor(ticket.scanStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {ticket.scanDate ? format(new Date(ticket.scanDate), 'MMM dd, yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewTicket(ticket)}
                      title="View Ticket Details"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogs */}
      {selectedTicket && (
        <TicketDetailsDialog
          open={ticketDetailsOpen}
          ticket={selectedTicket}
          onClose={() => {
            setTicketDetailsOpen(false);
            setSelectedTicket(null);
          }}
          onUpdate={loadTickets}
        />
      )}

      <BatchTicketOperationsDialog
        open={batchDialogOpen}
        ticketIds={selectedTickets}
        operation={batchOperation}
        onClose={() => {
          setBatchDialogOpen(false);
          setSelectedTickets([]);
        }}
        onComplete={() => {
          loadTickets();
          setSelectedTickets([]);
        }}
      />
    </Box>
  );
};

export default TicketingDashboardPage;
