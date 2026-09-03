/**
 * I3 — Pending registrations.
 *
 * Where an administrator approves or refuses people who have registered with the
 * club while auto-registration is OFF. Until this existed, those requests had no
 * interface at all: the endpoints were live but nothing called them, so a club
 * that turned approval on could not let anyone in.
 *
 * Three tabs rather than one list. A refused decision is not a delete — the row
 * stays, and being able to see it matters when a member phones to ask why they
 * cannot sign in. `active` is included for the same reason: it answers "did I
 * already approve this person?" without a search.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
import {
  Alert,
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
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
/*
 * The shared formatter from the component library (CLAUDE.md §1.5) rather than
 * orgadmin-shell's. Several pages in this package import it from the shell by
 * subpath, which `tsc` cannot resolve — those imports are the bulk of this
 * package's standing type errors, and there is no reason to add another.
 * The locale comes from i18next, which is already in hand.
 */
import { formatDisplayDate } from '@aws-web-framework/components';

export interface PendingRegistration {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  registeredAt: string;
}

type StatusFilter = 'pending' | 'active' | 'rejected';

const TABS: StatusFilter[] = ['pending', 'active', 'rejected'];

const RegistrationsPage: React.FC = () => {
  const { execute } = useApi();
  const { t, i18n } = useTranslation();

  const [status, setStatus] = useState<StatusFilter>('pending');
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Errors and notices are held as i18n keys, translated at render.
   *
   * `load` is a `useCallback` the mount effect depends on, so its dependencies
   * must be stable. `t` is not reliably stable, and depending on it re-runs the
   * effect forever — the page spins instead of failing visibly (CLAUDE.md §3.4).
   */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; name: string } | null>(null);

  /** The row a decision is being taken on, and which way. */
  const [pendingDecision, setPendingDecision] = useState<{
    registration: PendingRegistration;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKey(null);
      setErrorText(null);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisation/registrations?status=${status}`,
      });
      setRegistrations(response?.registrations ?? []);
    } catch (err: any) {
      setErrorKey('users.registrations.messages.loadFailed');
      setErrorText(err?.message ?? null);
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, [execute, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDecision = async () => {
    if (!pendingDecision) return;
    const { registration, decision } = pendingDecision;

    try {
      setDeciding(true);
      setErrorKey(null);
      setErrorText(null);
      await execute({
        method: 'POST',
        url: `/api/orgadmin/organisation/registrations/${registration.id}/decision`,
        data: { decision, note: note.trim() || undefined },
      });

      setNotice({
        key:
          decision === 'approve'
            ? 'users.registrations.messages.approved'
            : 'users.registrations.messages.rejected',
        name: `${registration.firstName} ${registration.lastName}`.trim(),
      });
      setPendingDecision(null);
      setNote('');
      // Reload rather than removing the row locally: the decision moves it to
      // another tab, and the counts on the others change with it.
      await load();
    } catch (err: any) {
      setErrorKey('users.registrations.messages.decisionFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setDeciding(false);
    }
  };

  const sort = useTableSort(registrations, {
    // Oldest waiting first: a queue of people to approve is worked from the
    // front, and somebody who registered a fortnight ago should not be at the
    // bottom of it.
    initial: { field: 'registeredAt', direction: 'asc' },
    accessors: {
      name: (registration) =>
        `${registration.lastName ?? ''} ${registration.firstName ?? ''}`.trim(),
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('users.registrations.title')}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {t('users.registrations.subtitle')}
      </Typography>

      {(errorKey || errorText) && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            setErrorKey(null);
            setErrorText(null);
          }}
        >
          {errorText || (errorKey ? t(errorKey) : '')}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {t(notice.key, { name: notice.name })}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Tabs
            value={status}
            onChange={(_event, value: StatusFilter) => setStatus(value)}
            aria-label={t('users.registrations.tabsAriaLabel')}
          >
            {TABS.map((tab) => (
              <Tab key={tab} value={tab} label={t(`users.registrations.tabs.${tab}`)} />
            ))}
          </Tabs>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress aria-label={t('common.messages.loading')} />
            </Box>
          ) : registrations.length === 0 ? (
            /*
             * Suppressed when the load failed. Otherwise a failure shows both
             * the error and "no registrations are waiting", and the reassuring
             * half is the one an administrator believes — leaving a queue of
             * real people looking empty.
             */
            !errorKey && (
              <Typography sx={{ py: 4 }} color="textSecondary">
                {t(`users.registrations.empty.${status}`)}
              </Typography>
            )
          ) : (
            <ResponsiveTable identityColumn={t('users.registrations.columns.name')}>
              <Table size="small" sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <SortableTableCell sort={sort} field="name">
                      {t('users.registrations.columns.name')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="email">
                      {t('users.registrations.columns.email')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="phone">
                      {t('users.registrations.columns.phone')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="registeredAt">
                      {t('users.registrations.columns.registered')}
                    </SortableTableCell>
                    {status === 'pending' && (
                      <TableCell align="right">
                        {t('users.registrations.columns.actions')}
                      </TableCell>
                    )}
                    {status !== 'pending' && (
                      <SortableTableCell sort={sort} field="status">
                        {t('users.registrations.columns.status')}
                      </SortableTableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sort.rows.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell>
                        {`${registration.firstName} ${registration.lastName}`.trim()}
                      </TableCell>
                      <TableCell>{registration.email}</TableCell>
                      <TableCell>{registration.phone || '—'}</TableCell>
                      <TableCell>
                        {formatDisplayDate(registration.registeredAt, i18n.language)}
                      </TableCell>
                      {status === 'pending' ? (
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() =>
                                setPendingDecision({ registration, decision: 'approve' })
                              }
                            >
                              {t('users.registrations.actions.approve')}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                setPendingDecision({ registration, decision: 'reject' })
                              }
                            >
                              {t('users.registrations.actions.reject')}
                            </Button>
                          </Stack>
                        </TableCell>
                      ) : (
                        <TableCell>
                          <Chip
                            size="small"
                            color={registration.status === 'active' ? 'success' : 'default'}
                            label={t(`users.registrations.status.${registration.status}`, {
                              defaultValue: registration.status,
                            })}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      {/*
        Both decisions are confirmed. Approving grants access to the club's data
        and refusing locks a real person out; neither should be one stray click
        in a dense table.
      */}
      <Dialog
        open={Boolean(pendingDecision)}
        onClose={() => (deciding ? undefined : setPendingDecision(null))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            pendingDecision?.decision === 'approve'
              ? 'users.registrations.confirm.approveTitle'
              : 'users.registrations.confirm.rejectTitle'
          )}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t(
              pendingDecision?.decision === 'approve'
                ? 'users.registrations.confirm.approveBody'
                : 'users.registrations.confirm.rejectBody',
              {
                name: pendingDecision
                  ? `${pendingDecision.registration.firstName} ${pendingDecision.registration.lastName}`.trim()
                  : '',
              }
            )}
          </DialogContentText>

          <TextField
            fullWidth
            multiline
            minRows={2}
            label={t('users.registrations.confirm.noteLabel')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {/*
            The member never sees this. A refusal reason shown to the person
            refused invites an argument the platform cannot adjudicate, so the
            note is recorded for the club only — and the form says so, or an
            admin will write it as though it were a message.
          */}
          <Typography variant="caption" color="textSecondary">
            {t('users.registrations.confirm.noteHint')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDecision(null)} disabled={deciding}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color={pendingDecision?.decision === 'reject' ? 'error' : 'primary'}
            onClick={confirmDecision}
            disabled={deciding}
          >
            {deciding
              ? t('common.messages.saving')
              : t(
                  pendingDecision?.decision === 'approve'
                    ? 'users.registrations.actions.approve'
                    : 'users.registrations.actions.reject'
                )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegistrationsPage;
