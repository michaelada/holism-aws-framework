import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Organization } from '../types/admin.types';

interface OrganizationListProps {
  organizations: Organization[];
  loading?: boolean;
  onViewClick?: (organization: Organization) => void;
  onEditClick?: (organization: Organization) => void;
}

export function OrganizationList({
  organizations,
  loading = false,
  onViewClick,
  onEditClick,
}: OrganizationListProps) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (organizations.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          No organizations found for this organization type
        </Typography>
      </Box>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'blocked':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Display Name</TableCell>
            <TableCell>Domain</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Capabilities</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {org.name}
                </Typography>
              </TableCell>
              <TableCell>{org.displayName}</TableCell>
              <TableCell>
                {org.domain ? (
                  <Typography variant="body2" color="text.secondary">
                    {org.domain}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    -
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  label={org.status}
                  color={getStatusColor(org.status)}
                  size="small"
                  sx={{ textTransform: 'capitalize' }}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {org.enabledCapabilities?.length || 0} enabled
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(org.createdAt)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Box display="flex" justifyContent="flex-end" gap={1}>
                  {onViewClick && (
                    <IconButton
                      size="small"
                      onClick={() => onViewClick(org)}
                      title="View details"
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onEditClick && (
                    <IconButton
                      size="small"
                      onClick={() => onEditClick(org)}
                      title="Edit organization"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
