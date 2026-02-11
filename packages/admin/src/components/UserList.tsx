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
import { User, Tenant } from '../types/admin.types';

interface UserListProps {
  users: User[];
  tenants?: Tenant[];
  loading: boolean;
  searchTerm?: string;
  selectedTenantId?: string;
  onSearchChange?: (search: string) => void;
  onTenantFilterChange?: (tenantId: string) => void;
  onCreateClick: () => void;
  onEditClick: (user: User) => void;
  onDeleteClick: (userId: string) => void;
  onResetPasswordClick: (user: User) => void;
  hideTenantFilter?: boolean;
}

export function UserList({
  users,
  tenants = [],
  loading,
  searchTerm = '',
  selectedTenantId = '',
  onSearchChange,
  onTenantFilterChange,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onResetPasswordClick,
  hideTenantFilter = false,
}: UserListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      onDeleteClick(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
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
          <h2>Users</h2>
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
      {!hideTenantFilter && (
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
          {onTenantFilterChange && (
            <TextField
              select
              label="Filter by Tenant"
              value={selectedTenantId}
              onChange={(e) => onTenantFilterChange(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All Tenants</MenuItem>
              {tenants.map((tenant) => (
                <MenuItem key={tenant.id} value={tenant.id}>
                  {tenant.displayName}
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
              <TableCell>Tenants</TableCell>
              <TableCell>Roles</TableCell>
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
                    {user.tenants.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.tenants.map((tenantId) => {
                          const tenant = tenants.find((t) => t.id === tenantId);
                          return (
                            <Chip
                              key={tenantId}
                              label={tenant?.displayName || tenantId}
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
                    {user.roles.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {user.roles.map((role) => (
                          <Chip key={role} label={role} size="small" color="primary" />
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
                      title="Edit user"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => onResetPasswordClick(user)}
                      title="Reset password"
                    >
                      <VpnKeyIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(user)}
                      title="Delete user"
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
