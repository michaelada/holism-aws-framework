import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Logout as SignOutIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getSessions, revokeSession, revokeAllSessions } from '../services/auditApi';
import type { LiveSession } from '../types/audit.types';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';

/**
 * Who is signed in right now.
 *
 * Read through to Keycloak, which owns sessions — this screen keeps no state of
 * its own, because a second copy would be wrong the moment somebody signed out.
 *
 * **Each row is a session, not a person.** Somebody signed in on a phone and a
 * laptop appears twice, which is the point: "end this session" then means
 * something specific, and "sign them out everywhere" is the other, louder
 * option.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md Part 1.
 */
export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [organisation, setOrganisation] = useState('all');
  const [userType, setUserType] = useState('all');
  const [application, setApplication] = useState('all');
  const [confirm, setConfirm] = useState<{ session: LiveSession; everywhere: boolean } | null>(null);

  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      setSessions(await getSessions());
    } catch (error) {
      setFailed(true);
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const organisations = [...new Set(sessions.map((s) => s.organisationName).filter(Boolean))].sort();
  const applications = [...new Set(sessions.map((s) => s.application))].sort();

  const visible = sessions.filter(
    (session) =>
      (organisation === 'all' || session.organisationName === organisation) &&
      (userType === 'all' || session.userType === userType) &&
      (application === 'all' || session.application === application)
  );

  const act = async () => {
    if (!confirm) return;
    const { session, everywhere } = confirm;
    setBusy(true);
    try {
      if (everywhere) await revokeAllSessions(session.keycloakUserId);
      else await revokeSession(session.sessionId);

      showSuccess(
        everywhere
          ? `${name(session)} will be signed out of every session`
          : `${name(session)} will be signed out of that session`
      );
      setConfirm(null);
      await load();
    } catch (error) {
      showError('Failed to end the session');
      console.error('Error ending session:', error);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Sessions"
        description="Everyone with a live session. A session means somebody signed in and has not signed out or timed out — not that they are at the keyboard."
        actions={
          <Button startIcon={<RefreshIcon />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>Retry</Button>}>
          Sessions could not be read from Keycloak.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select
          size="small"
          label="Organisation"
          value={organisation}
          onChange={(event) => setOrganisation(event.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">All organisations</MenuItem>
          {organisations.map((name) => (
            <MenuItem key={name as string} value={name as string}>
              {name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="User type"
          value={userType}
          onChange={(event) => setUserType(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All user types</MenuItem>
          <MenuItem value="super-admin">Super admin</MenuItem>
          <MenuItem value="org-admin">Org admin</MenuItem>
          <MenuItem value="account-user">Account user</MenuItem>
          <MenuItem value="unknown">Unknown</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Application"
          value={application}
          onChange={(event) => setApplication(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All applications</MenuItem>
          {applications.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {visible.length} session{visible.length === 1 ? '' : 's'}
        </Typography>
      </Stack>

      {visible.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1">Nobody is signed in</Typography>
          <Typography variant="body2" color="text.secondary">
            Sessions appear here as people sign in, and disappear when they sign out or time out.
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Organisation</TableCell>
                <TableCell>Signed in</TableCell>
                <TableCell>Last seen</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((session) => (
                <TableRow key={session.sessionId}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {name(session)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {session.email ?? session.username ?? '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {session.application}
                      {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={userTypeLabel(session.userType)} />
                  </TableCell>
                  <TableCell>{session.organisationName ?? '—'}</TableCell>
                  <TableCell>{time(session.startedAt)}</TableCell>
                  <TableCell>{ago(session.lastAccessAt)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View their audit trail">
                      <IconButton
                        size="small"
                        aria-label={`View the audit trail for ${name(session)}`}
                        onClick={() => navigate(`/audit?actor=${session.keycloakUserId}`)}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="End this session">
                      <IconButton
                        size="small"
                        aria-label={`End this session for ${name(session)}`}
                        onClick={() => setConfirm({ session, everywhere: false })}
                      >
                        <SignOutIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      onClick={() => setConfirm({ session, everywhere: true })}
                      aria-label={`Sign ${name(session)} out everywhere`}
                    >
                      Sign out everywhere
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>
          {confirm?.everywhere
            ? `Sign ${confirm ? name(confirm.session) : ''} out of all sessions?`
            : 'End this session?'}
        </DialogTitle>
        <DialogContent>
          {/*
            "Within 5 minutes", not "now".
            Ending the Keycloak session stops the refresh, but an access token
            already issued stays valid for its remaining lifetime — five minutes
            here. Saying "now" would be the kind of overstatement that matters
            precisely when somebody is relying on it.
          */}
          <DialogContentText>
            They will be signed out within 5 minutes and will have to sign in again. Anything they
            are part-way through — a form, a basket — is kept.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>This is recorded in the audit log.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={act} disabled={busy}>
            {confirm?.everywhere ? 'Sign them out' : 'End session'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const name = (session: LiveSession) =>
  session.displayName || session.username || session.email || 'Unknown user';

const userTypeLabel = (type: LiveSession['userType']) =>
  ({
    'super-admin': 'Super admin',
    'org-admin': 'Org admin',
    'account-user': 'Account user',
    unknown: 'Unknown',
  })[type];

const time = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/** Relative, because "how long since they did anything" is the actual question. */
const ago = (value: string | null): string => {
  if (!value) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
};

export default SessionsPage;
