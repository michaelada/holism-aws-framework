/**
 * Who has entered an event.
 *
 * Grouped by activity, because that is the unit a club works in: the entries
 * for the 80cm are a class list, and a flat table of every entrant across six
 * classes is not one. An entry is a row in exactly one group, so nothing is
 * hidden by the grouping — the counts add up to the total shown at the top.
 *
 * The columns are what an organiser needs at a glance: who entered, how to
 * reach them, and when they entered. Everything else about an entry — the fee,
 * the answers they gave, the payment it came in on — is one click away rather
 * than crammed into the row.
 *
 * What this replaced showed First name / Last name / Status / Submitted, in
 * hard-coded English, reading `entry.status` and `entry.createdAt` — neither of
 * which the endpoint returns. Both columns were empty on every row.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  useTranslation,
  useLocale,
  formatDateTime,
} from '@itsplainsailing/orgadmin-shell';
import {
  useApi,
  ResponsiveTable,
  SortableTableCell,
  useTableSort,
} from '@itsplainsailing/orgadmin-core';

/** An entry, as `GET /events/:eventId/entries` returns one. */
export interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  firstName: string;
  lastName: string;
  email: string;
  paymentStatus: string;
  entryDate: string;
  activityName?: string;
}

export interface ActivityGroup {
  activityId: string;
  activityName: string;
  entries: EventEntry[];
}

/**
 * The entries, in classes.
 *
 * Grouped by activity id rather than by name — two activities can share a name
 * across days of a two-day event, and merging them would produce a class list
 * that no class ever had. Groups are ordered by name so the page reads the same
 * way twice; entries within a group keep the order the API sent, which is most
 * recent first.
 */
export function groupByActivity(entries: EventEntry[], unnamed: string): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();

  for (const entry of entries) {
    const group = groups.get(entry.eventActivityId) ?? {
      activityId: entry.eventActivityId,
      activityName: entry.activityName ?? unnamed,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(entry.eventActivityId, group);
  }

  return [...groups.values()].sort((a, b) => a.activityName.localeCompare(b.activityName));
}

/** Name, email or class — whichever the organiser has in front of them. */
export function matchesSearch(entry: EventEntry, term: string): boolean {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [entry.firstName, entry.lastName, entry.email, entry.activityName]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

const statusColour = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'refunded':
      return 'error';
    default:
      return 'default';
  }
};

const EventEntriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventName, setEventName] = useState('');
  const [exportFailed, setExportFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setFailed(false);

      const [event, loaded] = await Promise.all([
        execute({ method: 'GET', url: `/api/orgadmin/events/${id}` }),
        execute({ method: 'GET', url: `/api/orgadmin/events/${id}/entries` }),
      ]);

      setEventName(event?.name ?? '');
      setEntries(loaded ?? []);
    } catch (error) {
      console.error('Failed to load entries:', error);
      setFailed(true);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [execute, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const matching = useMemo(
    () => entries.filter((entry) => matchesSearch(entry, searchTerm)),
    [entries, searchTerm]
  );

  /*
   * One sort across every class, applied **before** grouping.
   *
   * The page draws a table per activity, and `groupByActivity` keeps the order
   * it is given — so sorting the flat list sorts each group. A sort per table
   * would have been less code and worse: an organiser clicking "Entered" means
   * the whole entry list, not this class only, and four tables in four
   * different orders is a page nobody can read down.
   */
  const sort = useTableSort(matching, {
    accessors: {
      name: (entry) => `${entry.lastName ?? ''} ${entry.firstName ?? ''}`.trim(),
    },
  });

  const groups = useMemo(
    () => groupByActivity(sort.rows, t('events.entries.unnamedActivity')),
    [sort.rows, t]
  );

  const shown = groups.reduce((total, group) => total + group.entries.length, 0);

  const handleExport = async () => {
    if (!id) return;
    setExportFailed(false);

    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${id}/entries/export`,
        responseType: 'blob',
      });

      /*
       * A failed export must not be saved as a file.
       *
       * `execute` answers `null` on an error, and `new Blob([null])` is the
       * four-byte text "null" — which the browser dutifully saves as
       * `..._entries.xlsx` and the operating system then refuses to open. The
       * download looked like it had worked; the file *was* the error.
       *
       * Checked by type rather than for null, so a JSON error body that came
       * back with a 200 is caught too.
       */
      if (!(response instanceof Blob)) {
        setExportFailed(true);
        return;
      }

      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${eventName.replace(/[^a-z0-9]/gi, '_')}_entries.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export entries:', error);
      setExportFailed(true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          // Wraps rather than overflowing: a non-wrapping header row pushed
          // page actions past the right edge of a phone, with nothing on
          // screen to show the page had scrolled.
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4">{t('events.entries.title')}</Typography>
          {eventName && (
            <Typography variant="subtitle1" color="textSecondary">
              {eventName}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={entries.length === 0}
        >
          {t('events.entries.export')}
        </Button>
      </Box>

      {failed && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t('events.entries.loadFailed')}
        </Alert>
      )}

      {exportFailed && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setExportFailed(false)}>
          {t('events.entries.exportFailed')}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder={t('events.entries.searchPlaceholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          {entries.length > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              {t('events.entries.showing', { shown, total: entries.length })}
            </Typography>
          )}
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="textSecondary" align="center">
              {searchTerm ? t('events.entries.noMatching') : t('events.entries.none')}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Box key={group.activityId} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
              <Typography variant="h6">{group.activityName}</Typography>
              {/* The count belongs beside the class, not in a summary row: it
                  is the number an organiser is checking against a limit. */}
              <Typography variant="body2" color="textSecondary">
                {t('events.entries.count', { count: group.entries.length })}
              </Typography>
            </Box>

            <ResponsiveTable identityColumn={t('events.entries.name')} component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <SortableTableCell sort={sort} field="name">
                      {t('events.entries.name')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="email">
                      {t('events.entries.email')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="entryDate">
                      {t('events.entries.entered')}
                    </SortableTableCell>
                    <SortableTableCell sort={sort} field="paymentStatus">
                      {t('events.entries.status')}
                    </SortableTableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/events/${id}/entries/${entry.id}`)}
                    >
                      <TableCell>
                        <Link component="button" type="button" underline="hover">
                          {`${entry.firstName} ${entry.lastName}`.trim()}
                        </Link>
                      </TableCell>
                      <TableCell>{entry.email}</TableCell>
                      <TableCell>{formatDateTime(entry.entryDate, locale)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={t(`common.status.${entry.paymentStatus}`, {
                            defaultValue: entry.paymentStatus,
                          })}
                          color={statusColour(entry.paymentStatus)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </Box>
        ))
      )}

      <Button startIcon={<BackIcon />} onClick={() => navigate(`/events/${id}`)} sx={{ mt: 1 }}>
        {t('common.actions.back')}
      </Button>
    </Box>
  );
};

export default EventEntriesPage;
