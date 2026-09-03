import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon, Search as SearchIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuditEvents, getAuditFilters, getAuditHealth } from '../services/auditApi';
import type { AuditEvent, AuditFilterOptions, AuditHealth } from '../types/audit.types';
import { PageHeader } from '../components/PageHeader';
import { useNotification } from '../context/NotificationContext';
import { auditActionLabel } from '@itsplainsailing/components';

/**
 * The platform-wide audit trail.
 *
 * Newest first, keyset paginated — "load older" rather than page numbers,
 * because page 47 of an audit log means nothing to anybody, and `OFFSET` gets
 * slower the further back you look, which is exactly where an investigation
 * goes.
 *
 * Filters live in the URL so a view can be linked to: "here is the search that
 * shows what happened" is the normal way this gets handed between people, and
 * the Sessions screen links straight into `?actor=…`.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */
export const AuditLogPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { showError } = useNotification();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [options, setOptions] = useState<AuditFilterOptions | null>(null);
  const [health, setHealth] = useState<AuditHealth | null>(null);

  /** The search box is local until submitted, so every keystroke is not a query. */
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '');

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? undefined,
      actor: params.get('actor') ?? undefined,
      category: params.getAll('category'),
      userType: params.getAll('userType'),
      outcome: params.getAll('outcome'),
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
    }),
    [params]
  );

  const setFilter = (key: string, value: string | string[]) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    (Array.isArray(value) ? value : [value]).filter(Boolean).forEach((v) => next.append(key, v));
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const page = await getAuditEvents({ ...filters, limit: 50 });
      setEvents(page.events);
      setCursor(page.nextCursor);
    } catch (error) {
      showError('Failed to load the audit trail');
      console.error('Error loading audit events:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getAuditFilters().then(setOptions).catch(() => setOptions(null));
    getAuditHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const loadOlder = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await getAuditEvents({ ...filters, limit: 50, cursor });
      setEvents((current) => [...current, ...page.events]);
      setCursor(page.nextCursor);
    } catch (error) {
      showError('Failed to load older events');
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Export what is on screen.
   *
   * Built client-side from what has been loaded, so it exports *the view the
   * reader is looking at* rather than silently re-running the query and
   * returning something else.
   */
  const exportCsv = () => {
    const rows = [
      ['When', 'Who', 'User type', 'Organisation', 'Category', 'Action', 'Outcome', 'What'],
      ...events.map((event) => [
        new Date(event.occurredAt).toISOString(),
        event.actorDisplay ?? '',
        event.actorUserType,
        event.organisationName ?? '',
        event.category,
        event.action,
        event.outcome,
        event.entityLabel ?? '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: true });
  const activeFilters = [...params.keys()].length > 0;

  return (
    <Box>
      <PageHeader
        title="Audit log"
        description="Everything that happens across the platform — who did it, to what, and what changed."
        actions={
          <Button
            startIcon={<DownloadIcon />}
            onClick={exportCsv}
            disabled={events.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      {/*
        Audit writes are deliberately non-blocking, so a failure is a silence.
        Surfaced where the log is read, or nobody would ever know there was a gap.
      */}
      {health && health.failures > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {health.failures} audit write{health.failures === 1 ? '' : 's'} failed since the platform
          last started. The actions themselves succeeded — see the platform logs.
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search names, emails, what was affected, and the values that changed"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setFilter('q', searchDraft);
              }}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> }}
            />
            <Button variant="outlined" onClick={() => setFilter('q', searchDraft)}>
              Search
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Category"
              value={filters.category[0] ?? ''}
              onChange={(event) => setFilter('category', event.target.value)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">All categories</MenuItem>
              {(options?.categories ?? []).map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Action"
              value={filters.category.length ? '' : params.get('action') ?? ''}
              onChange={(event) => setFilter('action', event.target.value)}
              sx={{ minWidth: 210 }}
            >
              <MenuItem value="">All actions</MenuItem>
              {(options?.actions ?? []).map((action) => (
                <MenuItem key={action} value={action}>
                  {auditActionLabel(action)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="User type"
              value={filters.userType[0] ?? ''}
              onChange={(event) => setFilter('userType', event.target.value)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">All user types</MenuItem>
              {(options?.userTypes ?? []).map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Outcome"
              value={filters.outcome[0] ?? ''}
              onChange={(event) => setFilter('outcome', event.target.value)}
              sx={{ minWidth: 150 }}
            >
              {/*
                Failures and refusals are included by default. A log whose
                default view hides them answers "what happened" but not "what
                was attempted", and the second is usually the question.
              */}
              <MenuItem value="">All outcomes</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failure">Failure</MenuItem>
              <MenuItem value="denied">Denied</MenuItem>
            </TextField>

            <TextField
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={filters.from ?? ''}
              onChange={(event) => setFilter('from', event.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={filters.to ?? ''}
              onChange={(event) => setFilter('to', event.target.value)}
            />

            {activeFilters && <Button onClick={clearAll}>Clear all</Button>}
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : events.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            No events match those filters.
          </Typography>
          {/*
            Naming the earliest event separates "your filters are too narrow"
            from "auditing was not running then" — a real question, since the
            log starts on a particular day.
          */}
          {options?.earliest && (
            <Typography variant="body2" color="text.secondary">
              The earliest event recorded is {new Date(options.earliest).toLocaleDateString()}.
            </Typography>
          )}
          {activeFilters && (
            <Button sx={{ mt: 2 }} onClick={clearAll}>
              Clear filters
            </Button>
          )}
        </Paper>
      ) : (
        <>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 150 }}>When</TableCell>
                  <TableCell sx={{ width: 200 }}>Who</TableCell>
                  <TableCell sx={{ width: 180 }}>Organisation</TableCell>
                  <TableCell>What</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/audit/${event.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(event.occurredAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(event.occurredAt).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {/*
                        A failed sign-in has no authenticated actor, so "unknown"
                        is shown rather than a blank, which would read as a bug.
                      */}
                      <Typography variant="body2">{event.actorDisplay ?? 'unknown'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {userTypeLabel(event.actorUserType)}
                      </Typography>
                    </TableCell>
                    <TableCell>{event.organisationName ?? '—'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{auditActionLabel(event.action)}</Typography>
                        {event.outcome !== 'success' && (
                          <Chip
                            size="small"
                            color={event.outcome === 'denied' ? 'warning' : 'error'}
                            label={event.outcome}
                          />
                        )}
                      </Stack>
                      {event.entityLabel && (
                        <Typography variant="caption" color="text.secondary">
                          {event.entityLabel}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            {cursor ? (
              <Button onClick={loadOlder} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load older events'}
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary">
                That is everything matching these filters.
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

const userTypeLabel = (type: AuditEvent['actorUserType']) =>
  ({
    'super-admin': 'Super admin',
    'org-admin': 'Org admin',
    'account-user': 'Account user',
    system: 'System',
    anonymous: '—',
  })[type] ?? type;

export default AuditLogPage;
