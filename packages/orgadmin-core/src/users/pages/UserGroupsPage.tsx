/**
 * User Groups Page
 *
 * Groups of account users, and who is in them. The only consumer today is
 * discount eligibility — a discount can be restricted to members of named
 * groups. Until this page existed the criterion could be enforced but never
 * configured, so it was unusable.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveTable } from '../../components';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Autocomplete,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  PersonRemove as RemoveIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
}

interface GroupMember {
  organisationUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

export const UserGroupsPage: React.FC = () => {
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<UserGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<UserGroup | null>(null);

  const [membersOf, setMembersOf] = useState<UserGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([]);
  const [toAdd, setToAdd] = useState<AccountUser[]>([]);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await execute({ method: 'GET', url: '/api/orgadmin/user-groups' });
      setGroups(response?.groups || []);
      setError(null);
    } catch {
      setError(t('users.groups.errors.loadFailed'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [execute, t]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openCreate = () => {
    setForm({ name: '', description: '' });
    setFormError(null);
    setCreating(true);
  };

  const openEdit = (group: UserGroup) => {
    setForm({ name: group.name, description: group.description || '' });
    setFormError(null);
    setEditing(group);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  };

  const saveGroup = async () => {
    try {
      setSaving(true);
      setFormError(null);
      await execute({
        method: editing ? 'PUT' : 'POST',
        url: editing
          ? `/api/orgadmin/user-groups/${editing.id}`
          : '/api/orgadmin/user-groups',
        data: { name: form.name, description: form.description },
      });
      closeForm();
      await loadGroups();
    } catch (err: any) {
      // The duplicate-name message is the useful one here, so show what the
      // server said rather than a generic failure.
      setFormError(err?.response?.data?.error || t('users.groups.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const result = await execute({
        method: 'DELETE',
        url: `/api/orgadmin/user-groups/${deleting.id}`,
      });
      setDeleting(null);
      await loadGroups();
      /*
       * Deleting a group does not rewrite discounts that name it, so say so
       * rather than leaving a silently broken rule behind.
       *
       * After the reload, not before: `loadGroups` clears `error` when it
       * succeeds, so a warning set first was wiped a moment later and the
       * club never saw it.
       */
      if (result?.usedByDiscounts > 0) {
        setError(
          t('users.groups.deletedButReferenced', { count: result.usedByDiscounts })
        );
      }
    } catch {
      setError(t('users.groups.errors.deleteFailed'));
    }
  };

  const openMembers = async (group: UserGroup) => {
    setMembersOf(group);
    setToAdd([]);
    try {
      const [memberResponse, usersResponse] = await Promise.all([
        execute({ method: 'GET', url: `/api/orgadmin/user-groups/${group.id}/members` }),
        execute({ method: 'GET', url: `/api/orgadmin/users/accounts/${organisation?.id}` }),
      ]);
      setMembers(memberResponse?.members || []);
      setAccountUsers(usersResponse || []);
    } catch {
      setError(t('users.groups.errors.loadMembersFailed'));
    }
  };

  const addMembers = async () => {
    if (!membersOf || toAdd.length === 0) return;
    try {
      await execute({
        method: 'POST',
        url: `/api/orgadmin/user-groups/${membersOf.id}/members`,
        data: { organisationUserIds: toAdd.map((u) => u.id) },
      });
      setToAdd([]);
      await openMembers(membersOf);
      await loadGroups();
    } catch (err: any) {
      setError(err?.response?.data?.error || t('users.groups.errors.addMemberFailed'));
    }
  };

  const removeMember = async (userId: string) => {
    if (!membersOf) return;
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/user-groups/${membersOf.id}/members/${userId}`,
      });
      await openMembers(membersOf);
      await loadGroups();
    } catch {
      setError(t('users.groups.errors.removeMemberFailed'));
    }
  };

  // Someone already in the group should not be offered again.
  const addable = accountUsers.filter(
    (user) => !members.some((m) => m.organisationUserId === user.id)
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">{t('users.groups.title')}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t('users.groups.subtitle')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('users.groups.create')}
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="h6">{t('users.groups.empty.title')}</Typography>
              <Typography variant="body2" color="textSecondary" mb={2}>
                {t('users.groups.empty.description')}
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                {t('users.groups.create')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable identityColumn={t('users.groups.fields.name')} component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('users.groups.fields.name')}</TableCell>
                <TableCell>{t('users.groups.fields.description')}</TableCell>
                <TableCell align="right">{t('users.groups.fields.members')}</TableCell>
                <TableCell align="right">{t('users.groups.fields.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id} hover>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>{group.description || '—'}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={group.memberCount}
                      size="small"
                      onClick={() => openMembers(group)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openMembers(group)}>
                      {t('users.groups.manageMembers')}
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => openEdit(group)}
                      aria-label={t('common.actions.edit')}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleting(group)}
                      aria-label={t('common.actions.delete')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTable>
      )}

      {/* Create / edit */}
      <Dialog open={creating || Boolean(editing)} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>
          {editing ? t('users.groups.editTitle') : t('users.groups.createTitle')}
        </DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            required
            margin="dense"
            label={t('users.groups.fields.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            margin="dense"
            label={t('users.groups.fields.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm}>{t('common.actions.cancel')}</Button>
          <Button
            variant="contained"
            onClick={saveGroup}
            disabled={saving || !form.name.trim()}
          >
            {saving ? <CircularProgress size={20} /> : t('common.actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <DialogTitle>{t('users.groups.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('users.groups.deleteConfirm', { name: deleting?.name ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t('common.actions.cancel')}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Members */}
      <Dialog
        open={Boolean(membersOf)}
        onClose={() => setMembersOf(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('users.groups.membersTitle', { name: membersOf?.name ?? '' })}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" gap={1} alignItems="flex-start" mb={2}>
            <Autocomplete
              multiple
              fullWidth
              size="small"
              options={addable}
              value={toAdd}
              onChange={(_, value) => setToAdd(value)}
              getOptionLabel={(user) => `${fullName(user)} (${user.email})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label={t('users.groups.addMembers')} />
              )}
            />
            <Button
              variant="contained"
              onClick={addMembers}
              disabled={toAdd.length === 0}
              sx={{ mt: 0.5 }}
            >
              {t('common.actions.add')}
            </Button>
          </Box>

          {members.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {t('users.groups.noMembers')}
            </Typography>
          ) : (
            <List dense>
              {members.map((member) => (
                <ListItem
                  key={member.organisationUserId}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={t('users.groups.removeMember')}
                      onClick={() => removeMember(member.organisationUserId)}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={fullName(member)} secondary={member.email} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersOf(null)}>{t('common.actions.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserGroupsPage;
