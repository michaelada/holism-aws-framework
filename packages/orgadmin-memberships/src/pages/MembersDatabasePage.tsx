/**
 * Members Database Page
 * 
 * Comprehensive member records with advanced filtering, batch operations, and Excel export
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  Tooltip,
  Typography,
  Alert,
  Snackbar,
  Divider,
  useMediaQuery,
  useTheme,
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
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useOnboarding, usePageHelp } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import type { Member, MemberFilter, CreateMemberFilterDto } from '../types/membership.types';
import CreateCustomFilterDialog from '../components/CreateCustomFilterDialog';
import BatchOperationsDialog from '../components/BatchOperationsDialog';

/**
 * Is a member's date inside the filter's bounds?
 *
 * Both bounds are optional and either may be absent, so an unbounded side is
 * always satisfied. Compared as **days**, because these bounds are days: a
 * member whose membership runs to the 15th is inside "valid until before the
 * 15th"... only if the caller meant the end of that day, and they did not — so
 * the comparison is exclusive on `before` and inclusive on `after`, matching
 * how the two words read.
 *
 * A member with no date at all fails a bounded comparison rather than passing
 * it: "renewed before June" should not include somebody who has never renewed.
 */
const asDay = (value: unknown): number | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const withinBounds = (
  value: unknown,
  after?: string | Date | null,
  before?: string | Date | null
): boolean => {
  if (!after && !before) return true;

  const day = asDay(value);
  if (day === null) return false;

  const from = asDay(after);
  const to = asDay(before);

  if (from !== null && day < from) return false;
  if (to !== null && day >= to) return false;
  return true;
};

const MembersDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { checkModuleVisit } = useOnboarding();
  const { organisation } = useOrganisation();

  /*
   * Below `md` the ten-column grid becomes one record per row.
   *
   * A 997px table in a 390px window is not a table any more: nine of its ten
   * columns are off-screen behind a horizontal scroll, under a pinned Actions
   * column that covers the name while you drag. Every column is still here —
   * they are read down the row instead of across it.
   */
  const theme = useTheme();
  const stacked = useMediaQuery(theme.breakpoints.down('md'));

  // Register page for contextual help
  usePageHelp('list');

  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'current' | 'elapsed' | 'all'>('current');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customFilters, setCustomFilters] = useState<MemberFilter[]>([]);
  const [selectedCustomFilter, setSelectedCustomFilter] = useState<string>('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterToDelete, setFilterToDelete] = useState<MemberFilter | null>(null);
  const [deletingFilter, setDeletingFilter] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels'>('mark_processed');
  
  // New state for membership type count
  const [membershipTypeCount, setMembershipTypeCount] = useState<number>(0);
  const [membershipTypes, setMembershipTypes] = useState<any[]>([]);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(true);
  
  // New state for user roles
  const [userRoles, setUserRoles] = useState<Array<{ id: string; name: string; displayName: string }>>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true);

  // Success notification state
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Check for success message from navigation state
  useEffect(() => {
    if (location.state?.successMessage) {
      const message = location.state.createdMemberName
        ? `${location.state.successMessage}: ${location.state.createdMemberName}`
        : location.state.successMessage;
      setSuccessMessage(message);
      setShowSuccessNotification(true);
      
      // Restore filter state if provided
      if (location.state?.filterState) {
        const { searchTerm: savedSearchTerm, statusFilter: savedStatusFilter, selectedCustomFilter: savedCustomFilter } = location.state.filterState;
        if (savedSearchTerm !== undefined) setSearchTerm(savedSearchTerm);
        if (savedStatusFilter !== undefined) setStatusFilter(savedStatusFilter);
        if (savedCustomFilter !== undefined) setSelectedCustomFilter(savedCustomFilter);
      }
      
      // Clear the navigation state to prevent showing the message again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Check module visit for onboarding
  useEffect(() => {
    checkModuleVisit('memberships');
  }, [checkModuleVisit]);

  useEffect(() => {
    loadMembers();
    loadCustomFilters();
    loadMembershipTypeCount();
    loadUserRoles();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, statusFilter, selectedCustomFilter]);

  const loadMembershipTypeCount = async () => {
    try {
      setLoadingTypes(true);
      const types = await execute({
        method: 'GET',
        url: '/api/orgadmin/membership-types',
      });
      const typesArray = Array.isArray(types) ? types : [];
      setMembershipTypes(typesArray);
      setMembershipTypeCount(typesArray.length);
    } catch (error) {
      console.error('Failed to load membership types:', error);
      setMembershipTypes([]);
      setMembershipTypeCount(0);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadUserRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/auth/me',
      });
      setUserRoles(response.roles || []);
    } catch (error) {
      console.error('Failed to load user roles:', error);
      setUserRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  // Check if user has admin role (Organization Administrator or Full Administrator)
  const hasAdminRole = () => {
    return userRoles.some(role => role.name === 'admin' || role.name === 'full-administrator');
  };

  const handleAddMember = () => {
    // Preserve filter state for navigation back
    const filterState = {
      searchTerm,
      statusFilter,
      selectedCustomFilter,
    };

    if (membershipTypeCount === 1 && membershipTypes.length === 1) {
      // Auto-select the single membership type and navigate with typeId
      navigate(`/members/create?typeId=${membershipTypes[0].id}`, {
        state: { filterState },
      });
    } else if (membershipTypeCount > 1) {
      // Navigate to type selector (will be shown on the create page)
      navigate('/members/create', {
        state: { filterState },
      });
    }
  };

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

  /**
   * Save what the dialog collected.
   *
   * The dialog handed its payload to a callback that dropped it on the floor
   * and reloaded a list that was itself a stub, so a filter created here has
   * never once reached the database. The reload afterwards is what makes the
   * new filter appear in the menu.
   */
  const saveCustomFilter = async (filter: CreateMemberFilterDto) => {
    const saved = await execute({
      method: 'POST',
      url: '/api/orgadmin/member-filters',
      data: filter,
    });

    // `useApi.execute` resolves to null on failure rather than throwing, so a
    // silent close would look exactly like a successful save.
    if (!saved) {
      setFilterError(t('memberships.customFilter.saveFailed'));
      return;
    }

    setFilterError(null);
    setFilterDialogOpen(false);
    await loadCustomFilters();

    // Select it: somebody who just described a filter wants to see it applied.
    setSelectedCustomFilter(saved.id);
  };

  /**
   * Delete the selected filter.
   *
   * A successful delete answers 204, which `execute` resolves to `null` — the
   * same as a failure. `onError` is what tells them apart; without it a refused
   * delete would silently look like a successful one.
   *
   * The selection is cleared on success: leaving it set would leave the roster
   * narrowed by a filter that no longer exists, with the dropdown showing
   * nothing to explain why.
   */
  const deleteCustomFilter = async () => {
    if (!filterToDelete) return;
    const { id } = filterToDelete;

    let failed = false;
    setDeletingFilter(true);
    await execute({
      method: 'DELETE',
      url: `/api/orgadmin/member-filters/${id}`,
      onError: () => {
        failed = true;
      },
    });
    setDeletingFilter(false);
    setFilterToDelete(null);

    if (failed) {
      setFilterError(t('memberships.customFilter.deleteFailed'));
      return;
    }

    setFilterError(null);
    if (selectedCustomFilter === id) setSelectedCustomFilter('');
    await loadCustomFilters();
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
        (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        m.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.membershipNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    /*
     * Apply the saved filter.
     *
     * Every clause is a narrowing, and an empty one narrows nothing — a filter
     * that names no status matches every status rather than none, which is what
     * somebody means by leaving the field alone.
     */
    const custom = customFilters.find((f) => f.id === selectedCustomFilter);
    if (custom) {
      if (custom.memberStatus?.length) {
        filtered = filtered.filter((m) => custom.memberStatus.includes(m.status));
      }

      if (custom.memberLabels?.length) {
        // Any of them, not all: "Committee or Junior" is the useful question.
        filtered = filtered.filter((m) =>
          (m.labels ?? []).some((label) => custom.memberLabels.includes(label))
        );
      }

      filtered = filtered.filter(
        (m) =>
          withinBounds(m.dateLastRenewed, custom.dateLastRenewedAfter, custom.dateLastRenewedBefore) &&
          withinBounds(m.validUntil, custom.validUntilAfter, custom.validUntilBefore)
      );
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
    navigate(`/members/${memberId}`);
  };

  const handleEditMember = (memberId: string) => {
    navigate(`/members/${memberId}/edit`);
  };

  const handleToggleProcessed = async (memberId: string, currentStatus: boolean) => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${memberId}`,
        data: { processed: !currentStatus },
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

  const { i18n } = useTranslation();
  
  const formatDateLocale = (dateString: Date | string) => {
    return formatDate(new Date(dateString), 'dd MMM yyyy', i18n.language);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('memberships.membersDatabase')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            {t('memberships.actions.exportToExcel')}
          </Button>
          {/* Add Member button - visible only when membership types exist AND user has admin role */}
          {!loadingTypes && !loadingRoles && membershipTypeCount > 0 && hasAdminRole() && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddMember}
              data-testid="add-member-button"
            >
              {t('memberships.actions.addMember')}
            </Button>
          )}
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder={t('memberships.searchMembersPlaceholder')}
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
              {/*
                `labelId` and `id`: without them the label is drawn next to the
                control but attached to nothing, so a screen reader announces an
                unnamed combo box.
              */}
              <InputLabel id="custom-filter-label">
                {t('memberships.filters.customFilter')}
              </InputLabel>
              <Select
                labelId="custom-filter-label"
                id="custom-filter"
                value={selectedCustomFilter}
                label={t('memberships.filters.customFilter')}
                onChange={(e) => setSelectedCustomFilter(e.target.value)}
              >
                <MenuItem value="">{t('memberships.filters.none')}</MenuItem>
                {customFilters.map((filter) => (
                  <MenuItem key={filter.id} value={filter.id}>
                    {filter.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/*
              Only once a filter is chosen: an always-present delete button next
              to a dropdown reading "None" has nothing to act on, and invites the
              question of what it would remove.
            */}
            {selectedCustomFilter && (
              <Tooltip title={t('memberships.customFilter.deleteFilter')}>
                <IconButton
                  aria-label={t('memberships.customFilter.deleteFilter')}
                  onClick={() =>
                    setFilterToDelete(
                      customFilters.find((f) => f.id === selectedCustomFilter) ?? null
                    )
                  }
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}

            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setFilterDialogOpen(true)}
            >
              {t('memberships.filters.createFilter')}
            </Button>
          </Box>

          {/*
            `useApi.execute` resolves to null on failure rather than throwing,
            so without this a refused save closes the dialog and reloads a list
            that has not changed — indistinguishable from success, which is
            exactly how this looked when nothing was saved at all.
          */}
          {filterError && (
            <Alert severity="error" onClose={() => setFilterError(null)}>
              {filterError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, value) => value && setStatusFilter(value)}
              size="small"
            >
              <ToggleButton value="current">{t('memberships.statusOptions.current')}</ToggleButton>
              <ToggleButton value="elapsed">{t('memberships.statusOptions.elapsed')}</ToggleButton>
              <ToggleButton value="all">{t('memberships.statusOptions.all')}</ToggleButton>
            </ToggleButtonGroup>

            {selectedMembers.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_processed')}
                >
                  {t('memberships.actions.markProcessed')}
                </Button>
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_unprocessed')}
                >
                  {t('memberships.actions.markUnprocessed')}
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('add_labels')}
                >
                  {t('memberships.actions.addLabels')}
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('remove_labels')}
                >
                  {t('memberships.actions.removeLabels')}
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {stacked ? (
        /*
         * One row per member. Rows live inside the same Paper the table used
         * rather than becoming twelve separate cards — the surface is the list,
         * and a card per record would nest a card inside a card and lose the
         * hairline rhythm the desktop table reads by.
         */
        <Paper>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              {t('memberships.loadingMembers')}
            </Box>
          ) : filteredMembers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              {t('memberships.noMembersFound')}
            </Box>
          ) : (
            filteredMembers.map((member, index) => {
              const selected = selectedMembers.includes(member.id);
              return (
                <Box key={member.id}>
                  {index > 0 && <Divider />}
                  <Box
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      backgroundColor: selected ? 'action.selected' : 'transparent',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <Checkbox
                      checked={selected}
                      onChange={() => handleSelectMember(member.id)}
                      /* Level with the name, not floating in the middle of the row */
                      sx={{ mt: -0.75, ml: -1.5 }}
                      inputProps={{
                        'aria-label': member.name || `${member.firstName} ${member.lastName}`,
                      }}
                    />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/*
                        The name owns its line. Sharing it with the status chip
                        left about 180px for the name on a 390px screen, so
                        "Aoife McNamara" broke across two lines while the chip
                        sat in the space it had taken.
                      */}
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {member.name || `${member.firstName} ${member.lastName}`}
                      </Typography>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        {/* Wraps rather than truncating — "400009 · Associa…" tells
                            an administrator less than two short lines do. */}
                        <Typography variant="body2" color="text.secondary">
                          {member.membershipNumber}
                          {' · '}
                          {member.membershipTypeName || member.membershipTypeId}
                        </Typography>
                        <Chip
                          label={member.status}
                          color={getStatusColor(member.status)}
                          size="small"
                          sx={{ flexShrink: 0 }}
                        />
                      </Box>

                      {/*
                        The dates keep their column names. Stripped of the header
                        row, "16 Aug 2026" beside "11 Aug 2027" says nothing about
                        which is the renewal and which is the expiry.
                      */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          columnGap: 1.5,
                          rowGap: 0.25,
                          mb: member.labels.length ? 1 : 0,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {t('memberships.table.dateLastRenewed')}
                        </Typography>
                        <Typography variant="caption">
                          {formatDateLocale(member.dateLastRenewed)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('memberships.table.validUntil')}
                        </Typography>
                        <Typography variant="caption">
                          {formatDateLocale(member.validUntil)}
                        </Typography>
                      </Box>

                      {member.labels.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {member.labels.map((label) => (
                            <Chip key={label} label={label} size="small" />
                          ))}
                        </Box>
                      )}

                      {/*
                        The three row actions, spelled out. On the desktop table
                        these are icons in a column an administrator learns; on a
                        phone, met once in a while, they carry their names.
                      */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: -1 }}>
                        <Tooltip title={t('memberships.table.processed')}>
                          <IconButton
                            onClick={() => handleToggleProcessed(member.id, member.processed)}
                            aria-label={t('memberships.table.processed')}
                            aria-pressed={member.processed}
                          >
                            {member.processed ? <ProcessedIcon color="success" /> : <UnprocessedIcon />}
                          </IconButton>
                        </Tooltip>
                        <Box sx={{ flex: 1 }} />
                        <Button
                          size="small"
                          startIcon={<ViewIcon />}
                          onClick={() => handleViewMember(member.id)}
                          sx={{ px: 1.25, whiteSpace: 'nowrap', minWidth: 0 }}
                        >
                          {t('memberships.tooltips.viewDetails')}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditMember(member.id)}
                          sx={{ px: 1.25, whiteSpace: 'nowrap', minWidth: 0 }}
                        >
                          {t('memberships.tooltips.edit')}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Paper>
      ) : (
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
              <TableCell>{t('memberships.table.membershipType')}</TableCell>
              <TableCell>{t('memberships.table.name')}</TableCell>
              <TableCell>{t('memberships.table.membershipNumber')}</TableCell>
              <TableCell>{t('memberships.table.dateLastRenewed')}</TableCell>
              <TableCell>{t('memberships.table.status')}</TableCell>
              <TableCell>{t('memberships.table.validUntil')}</TableCell>
              <TableCell>{t('memberships.table.labels')}</TableCell>
              <TableCell>{t('memberships.table.processed')}</TableCell>
              <TableCell
                align="right"
                sx={{
                  /*
                   * Pinned right. The members table is 997px in an 856px well at
                   * 1200px, so the column carrying View and Edit — the most-used
                   * controls in the product — scrolled out of sight. The rest of
                   * the row now scrolls underneath it.
                   */
                  position: 'sticky',
                  right: 0,
                  zIndex: 2,
                  bgcolor: 'background.paper',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {t('memberships.table.actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {t('memberships.loadingMembers')}
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {t('memberships.noMembersFound')}
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
                  <TableCell>{member.membershipTypeName || member.membershipTypeId}</TableCell>
                  <TableCell>{member.name || `${member.firstName} ${member.lastName}`}</TableCell>
                  <TableCell>{member.membershipNumber}</TableCell>
                  <TableCell>{formatDateLocale(member.dateLastRenewed)}</TableCell>
                  <TableCell>
                    <Chip
                      label={member.status}
                      color={getStatusColor(member.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDateLocale(member.validUntil)}</TableCell>
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
                  {/*
                    The two actions stay on one line. Left to wrap they stacked,
                    which is what made every row of this table 101px tall — on
                    the screen an administrator scans most often.
                  */}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewMember(member.id)}
                      title={t('memberships.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditMember(member.id)}
                      title={t('memberships.tooltips.edit')}
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
      )}

      <Dialog open={Boolean(filterToDelete)} onClose={() => setFilterToDelete(null)}>
        <DialogTitle>{t('memberships.customFilter.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          {/*
            Named, because a club may have several and they read alike in a
            list. And said to be shared, because it is: this removes it for
            every administrator, not just for the person pressing the button.
          */}
          <DialogContentText>
            {t('memberships.customFilter.deleteConfirmBody', { name: filterToDelete?.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterToDelete(null)} disabled={deletingFilter}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={deleteCustomFilter}
            disabled={deletingFilter}
          >
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <CreateCustomFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSave={saveCustomFilter}
      />

      <BatchOperationsDialog
        open={batchDialogOpen}
        operation={batchOperation}
        selectedMembers={selectedMembers}
        members={members}
        onClose={() => setBatchDialogOpen(false)}
        onComplete={() => {
          setBatchDialogOpen(false);
          setSelectedMembers([]);
          loadMembers();
        }}
      />

      {/* Success notification */}
      <Snackbar
        open={showSuccessNotification}
        autoHideDuration={6000}
        onClose={() => setShowSuccessNotification(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccessNotification(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MembersDatabasePage;
