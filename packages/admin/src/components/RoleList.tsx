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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Role } from '../types/admin.types';

interface RoleListProps {
  roles: Role[];
  loading: boolean;
  onCreateClick: () => void;
  onDeleteClick: (roleId: string) => void;
}

export function RoleList({
  roles,
  loading,
  onCreateClick,
  onDeleteClick,
}: RoleListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const handleDeleteClick = (role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (roleToDelete) {
      onDeleteClick(roleToDelete.id);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRoleToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <h2>Roles</h2>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create Role
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No roles found
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.displayName}</TableCell>
                  <TableCell>{role.description || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(role)}
                      title="Delete role"
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
        <DialogTitle id="delete-dialog-title">Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role "{roleToDelete?.displayName}"?
            This action cannot be undone.
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
