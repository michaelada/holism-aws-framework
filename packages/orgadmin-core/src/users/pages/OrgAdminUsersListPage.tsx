/**
 * Org Admin Users List Page
 * 
 * Displays a table of all org admin users with search functionality
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PersonAdd as InviteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation } from '../../context/OrganisationContext';
import { usePageHelp, useOnboarding } from '@aws-web-framework/orgadmin-shell';

interface OrgAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: 'active' | 'inactive';
  lastLogin?: string;
  createdAt: string;
}

const OrgAdminUsersListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { setCurrentModule, checkModuleVisit } = useOnboarding();

  useEffect(() => {
    setCurrentModule('users');
    checkModuleVisit('users');
  }, [setCurrentModule, checkModuleVisit]);
  
  const [users, setUsers] = useState<OrgAdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<OrgAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState(0);

  // Register page for contextual help
  usePageHelp('list');

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation?.id]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadUsers = async () => {
    if (!organisation?.id) return;
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/users/admins/${organisation.id}`,
      });
      setUsers(response?.data || []);
    } catch (error) {
      console.error('Failed to load admin users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  const handleInviteUser = () => {
    navigate('/users/admins/invite');
  };

  const handleEditUser = (userId: string) => {
    navigate(`/users/admins/${userId}`);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    if (newValue === 0) {
      navigate('/users/admins');
    } else {
      navigate('/users/accounts');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'success' : 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('users.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<InviteIcon />}
          onClick={handleInviteUser}        >
          {t('users.admins.invite')}
        </Button>
      </Box>

      <Tabs value={currentTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label={t('users.tabs.admins')} />
        <Tab label={t('users.tabs.accounts')} />
      </Tabs>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder={t('users.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('users.fields.name')}</TableCell>
              <TableCell>{t('users.fields.email')}</TableCell>
              <TableCell>{t('users.fields.roles')}</TableCell>
              <TableCell>{t('users.fields.status')}</TableCell>
              <TableCell>{t('users.fields.lastLogin')}</TableCell>
              <TableCell align="right">{t('users.fields.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">{t('users.loading.admins')}</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {searchTerm
                    ? 'No admin users match your search'
                    : 'No admin users yet. Invite your first admin user to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {user.firstName} {user.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {user.roles.length > 0 ? (
                        user.roles.map((role, index) => (
                          <Chip key={index} label={role} size="small" variant="outlined" />
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary">{t('users.noRoles')}</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status}
                      color={getStatusColor(user.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user.id)}
                      title={t('common.actions.edit')}
                      aria-label={t('common.actions.edit')}
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
    </Box>
  );
};

export default OrgAdminUsersListPage;
