/**
 * Account Users List Page
 * 
 * Displays a table of all account users with search functionality
 */

import React, { useState, useEffect } from 'react';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
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
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PersonAdd as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';
import { useOnboarding } from '@itsplainsailing/orgadmin-shell';
import { usePageHelp } from '@itsplainsailing/orgadmin-shell';

interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
  createdAt: string;
}

const AccountUsersListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { checkModuleVisit } = useOnboarding();
  
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState(1);

  // Register page for contextual help
  usePageHelp('list');

  // Check module visit for onboarding
  useEffect(() => {
    checkModuleVisit('users');
  }, [checkModuleVisit]);

  // Keyed on the organisation: it resolves after the first render, and an
  // empty dependency list would leave this screen permanently empty.
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisation?.id]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadUsers = async () => {
    /*
     * The organisation is part of the path, not inferred from the token:
     * `GET /api/orgadmin/users/accounts/:organizationId`. Calling it without
     * the id matches no route at all and returns 404 — which reads as "the
     * endpoint is missing" rather than "the URL is wrong", and is why this
     * screen showed an empty list instead of an error.
     */
    if (!organisation?.id) return;

    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/users/accounts/${organisation.id}`,
      });
      // The endpoint answers with an envelope — { success, data, count } — as
      // the admin list does. Storing `response` itself puts an object where the
      // filtering below spreads an array.
      setUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load account users:', error);
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

  const handleCreateUser = () => {
    navigate('/users/accounts/create');
  };

  const handleEditUser = (userId: string) => {
    /* No `/orgadmin`: the router basename supplies it. Prefixing here produced
       `/orgadmin/orgadmin/…` and a 404 — the same fault as the payments list. */
    navigate(`/users/accounts/${userId}`);
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

  const sort = useTableSort(filteredUsers, {
    accessors: {
      // Surname first, because that is how a list of people is looked down.
      name: (user) => `${user.lastName ?? ''} ${user.firstName ?? ''}`.trim(),
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('users.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}        >
          {t('users.accounts.create')}
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

      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Account users can enter events, purchase merchandise, make bookings, and register for programmes.
      </Typography>

      <ResponsiveTable identityColumn={t('users.fields.name')} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableCell sort={sort} field="name">
                {t('users.fields.name')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="email">
                {t('users.fields.email')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="phone">
                {t('users.fields.phone')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="status">
                {t('users.fields.status')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="lastLogin">
                {t('users.fields.lastLogin')}
              </SortableTableCell>
              <TableCell align="right">{t('users.fields.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">{t('users.loading.accounts')}</TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {searchTerm
                    ? 'No account users match your search'
                    : 'No account users yet. Create your first account user to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              sort.rows.map((user) => (
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
                    <Typography variant="body2" color="textSecondary">
                      {user.phone || '-'}
                    </Typography>
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
      </ResponsiveTable>
    </Box>
  );
};

export default AccountUsersListPage;
