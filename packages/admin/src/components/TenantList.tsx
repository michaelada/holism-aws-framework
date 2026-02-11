import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Tenant } from '../types/admin.types';

interface TenantListProps {
  tenants: Tenant[];
  loading: boolean;
  onCreateClick: () => void;
  onEditClick: (tenant: Tenant) => void;
  onDeleteClick: (tenantId: string) => void;
  onViewDetails?: (tenantId: string) => void;
}

// Internal component that doesn't use Router hooks
function TenantListInternal({
  tenants,
  loading,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onViewDetails,
}: TenantListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const handleViewDetails = (tenantId: string) => {
    if (onViewDetails) {
      onViewDetails(tenantId);
    }
  };

  const handleDeleteClick = (tenant: Tenant) => {
    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tenantToDelete) {
      onDeleteClick(tenantToDelete.id);
      setDeleteDialogOpen(false);
      setTenantToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setTenantToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <h2>Tenants</h2>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create Tenant
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Member Count</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No tenants found
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow 
                  key={tenant.id}
                  hover
                  sx={{ cursor: onViewDetails ? 'pointer' : 'default' }}
                  onClick={onViewDetails ? () => handleViewDetails(tenant.id) : undefined}
                >
                  <TableCell>{tenant.name}</TableCell>
                  <TableCell>{tenant.displayName}</TableCell>
                  <TableCell>{tenant.domain || '-'}</TableCell>
                  <TableCell>{tenant.memberCount ?? 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={tenant.status}
                      color={tenant.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {onViewDetails && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewDetails(tenant.id)}
                        title="View details"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onEditClick(tenant)}
                      title="Edit tenant"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(tenant)}
                      title="Delete tenant"
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
        <DialogTitle id="delete-dialog-title">Delete Tenant</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the tenant "{tenantToDelete?.displayName}"?
            This action cannot be undone and will remove all user associations with this tenant.
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

// Wrapper component that uses Router hooks when needed
export function TenantList(props: TenantListProps) {
  // If onViewDetails is provided, use the internal component directly
  if (props.onViewDetails) {
    return <TenantListInternal {...props} />;
  }

  // Otherwise, use Router navigation
  const navigate = useNavigate();
  
  const handleViewDetails = (tenantId: string) => {
    navigate(`/tenants/${tenantId}`);
  };

  return <TenantListInternal {...props} onViewDetails={handleViewDetails} />;
}
