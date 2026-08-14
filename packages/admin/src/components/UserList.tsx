import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as VpnKeyIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  User,
  UserClassification,
  USER_CLASSIFICATION_LABELS,
} from '../types/admin.types';
import type { Organization } from '../types/organization.types';

/**
 * Distinct colours so the three categories are told apart at a glance down a
 * long list, rather than reading as one undifferentiated block of chips.
 */
const CLASSIFICATION_COLOURS: Record<UserClassification, 'error' | 'primary' | 'default'> = {
  'super-admin': 'error',
  'org-admin': 'primary',
  account: 'default',
};

interface UserListProps {
  users: User[];
  organizations?: Organization[];
  loading: boolean;
  searchTerm?: string;
  selectedOrganizationId?: string;
  onSearchChange?: (search: string) => void;
  onOrganizationFilterChange?: (organizationId: string) => void;
  onCreateClick: () => void;
  onEditClick: (user: User) => void;
  onDeleteClick: (userId: string) => void;
  onResetPasswordClick: (user: User) => void;
  hideOrganizationFilter?: boolean;
}

export function UserList({
  users,
  organizations = [],
  loading,
  searchTerm = '',
  selectedOrganizationId = '',
  onSearchChange,
  onOrganizationFilterChange,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onResetPasswordClick,
  hideOrganizationFilter = false,
}: UserListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      // Close first, act second: invoking the callback while the dialog is open
      // lets a parent state change unmount this component mid-modal, stranding
      // the backdrop in the DOM.
      const id = userToDelete.id;
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      onDeleteClick(id);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h2" component="h2">Users</Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create User
        </Button>
      </Box>

      {/* Filters */}
      {!hideOrganizationFilter && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {onSearchChange && (
            <TextField
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
          {onOrganizationFilterChange && (
            <TextField
              select
              label="Filter by Organisation"
              value={selectedOrganizationId}
              onChange={(e) => onOrganizationFilterChange(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All Organisations</MenuItem>
              {organizations.map((organization) => (
                <MenuItem key={organization.id} value={organization.id}>
                  {organization.displayName}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Organisation</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>
                    {user.organizations.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.organizations.map((organizationId) => {
                          const organization = organizations.find((o) => o.id === organizationId);
                          return (
                            <Chip
                              // Falls back to the raw id when the organisation
                              // is not in the loaded list — better a visible id
                              // than a blank chip that hides the association.
                              key={organizationId}
                              label={organization?.displayName || organizationId}
                              size="small"
                            />
                          );
                        })}
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {user.classifications.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.classifications.map((classification) => (
                          <Chip
                            key={classification}
                            label={USER_CLASSIFICATION_LABELS[classification]}
                            size="small"
                            color={CLASSIFICATION_COLOURS[classification]}
                          />
                        ))}
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.enabled ? 'Active' : 'Disabled'}
                      color={user.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onEditClick(user)}
                      aria-label={`Edit ${user.username}`}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => onResetPasswordClick(user)}
                      aria-label={`Reset password for ${user.username}`}
                    >
                      <VpnKeyIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(user)}
                      aria-label={`Delete ${user.username}`}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the user "{userToDelete?.username}"?
            This action cannot be undone and will remove the user from both Keycloak and the database.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
