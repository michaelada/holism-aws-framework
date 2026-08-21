import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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
import SearchIcon from '@mui/icons-material/Search';
import {
  AuditChanges,
  auditActionLabel,
  auditFieldLabel,
} from '@aws-web-framework/components';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';

interface AuditEvent {
  id: string;
  occurredAt: string;
  actorDisplay: string | null;
  actorEmail: string | null;
  actorUserType: string;
  organisationName: string | null;
  category: string;
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  entityType: string | null;
  entityLabel: string | null;
  changes: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
}

interface FilterOptions {
  categories: string[];
  actions: string[];
  userTypes: string[];
  earliest: string | null;
}

/**
 * This organisation's audit trail.
 *
 * The same events the Platform Admin screen shows, with the organisation fixed
 * by the **server** — `/api/orgadmin/organisation/audit` resolves it from the
 * session, and a query-string organisation is ignored. So this screen does not
 * pass a scope, and could not widen one if it tried.
 *
 * The detail is a dialog rather than a route: an administrator here is
 * answering "who cancelled that booking?" and wants to look at three events in
 * a row, where a super admin investigating tends to open one and stay in it.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */
/**
 * Where a field's translated label already lives.
 *
 * Tried in order; the first that resolves wins. These are the namespaces the
 * edit forms use, so the audit log calls a field what the form that set it
 * calls it — which is the whole point of showing a label at all.
 */
const FIELD_LABEL_NAMESPACES = [
  'events.basicInfo',
  'events.dates',
  'events.venues',
  'forms.fields',
  'settings.branding',
  'settings.organisation',
];

/**
 * A namespace hit, but only when it is genuinely a string.
 *
 * `t()` cannot be used to probe: asked for a key that holds a nested object it
 * returns the *diagnostic* — `key 'events.basicInfo.validation (en-GB)'
 * returned an object instead of string` — as an ordinary string, which then
 * sails through a truthiness check and onto the screen. A form field named
 * `validation` collided with the `events.basicInfo.validation` group and did
 * exactly that.
 *
 * Reading the resource directly gives the real type, so an object simply does
 * not match and the next candidate is tried.
 *
 * It is also silent. Every lookup here is a *probe* — most keys are expected to
 * be absent, because the English label map is the fallback — and `t()` reports
 * each miss to the app's missing-key logger, filling the console with warnings
 * about a path that is working exactly as designed.
 */
function translatedString(i18n: { getResource: Function; resolvedLanguage?: string; language: string }, key: string): string | null {
  const value = i18n.getResource(i18n.resolvedLanguage ?? i18n.language, 'translation', key);
  return typeof value === 'string' && value ? value : null;
}

export const AuditLogPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { organisation } = useOrganisation();
  const { execute } = useApi<any>();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  /*
   * Names a reader knows, resolved through the translations first.
   *
   * The English in `auditActionLabel` is the `defaultValue`, so a locale that
   * has not translated an action yet shows "Event updated" rather than
   * `audit.actions.event.updated`. The stored identifier stays the filter
   * value — only the display changes.
   */
  const actionLabel = useCallback(
    (action: string) =>
      translatedString(i18n, `audit.actions.${action}`) ?? auditActionLabel(action),
    [i18n]
  );

  /*
   * Field labels come from the screens that already own them: the event form
   * has translated `openDateEntries` in all six locales, and re-translating it
   * here would be a second copy free to drift from the first.
   */
  const fieldLabel = useCallback(
    (field: string) => {
      for (const namespace of FIELD_LABEL_NAMESPACES) {
        const label = translatedString(i18n, `${namespace}.${field}`);
        if (label) return label;
      }
      return translatedString(i18n, `audit.fields.${field}`) ?? auditFieldLabel(field);
    },
    [i18n]
  );

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<{ q?: string; category?: string; action?: string; outcome?: string }>({});

  const params = useCallback(
    (extra: Record<string, string | undefined> = {}) => {
      const search = new URLSearchParams();
      Object.entries({ ...filters, ...extra }).forEach(([key, value]) => {
        if (value) search.append(key, value);
      });
      search.append('limit', '50');
      return search.toString();
    },
    [filters]
  );

  const load = useCallback(async () => {
    if (!organisation) return;
    setLoading(true);
    setFailed(false);

    const page = await execute({
      method: 'GET',
      url: `/api/orgadmin/organisation/audit?${params()}`,
      // `useApi.execute` resolves to null on failure rather than throwing, so
      // the empty state and a failed load would otherwise look identical.
      onError: () => setFailed(true),
    });

    if (page) {
      setEvents(page.events ?? []);
      setCursor(page.nextCursor ?? null);
    }
    setLoading(false);
  }, [execute, organisation, params]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!organisation) return;
    void execute({ method: 'GET', url: '/api/orgadmin/organisation/audit/filters' }).then(
      (result) => result && setOptions(result)
    );
  }, [execute, organisation]);

  const loadOlder = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const page = await execute({
      method: 'GET',
      url: `/api/orgadmin/organisation/audit?${params({ cursor })}`,
    });
    if (page) {
      setEvents((current) => [...current, ...(page.events ?? [])]);
      setCursor(page.nextCursor ?? null);
    }
    setLoadingMore(false);
  };

  const setFilter = (key: string, value: string) =>
    setFilters((current) => ({ ...current, [key]: value || undefined }));

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('audit.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('audit.subtitle')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('audit.searchPlaceholder')}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setFilter('q', searchDraft);
              }}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> }}
            />
            <Button variant="outlined" onClick={() => setFilter('q', searchDraft)}>
              {t('audit.search')}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label={t('audit.category')}
              value={filters.category ?? ''}
              onChange={(event) => setFilter('category', event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">{t('audit.allCategories')}</MenuItem>
              {(options?.categories ?? []).map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={t('audit.action')}
              value={filters.action ?? ''}
              onChange={(event) => setFilter('action', event.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">{t('audit.allActions')}</MenuItem>
              {(options?.actions ?? []).map((action) => (
                <MenuItem key={action} value={action}>
                  {actionLabel(action)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={t('audit.outcome')}
              value={filters.outcome ?? ''}
              onChange={(event) => setFilter('outcome', event.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">{t('audit.allOutcomes')}</MenuItem>
              <MenuItem value="success">{t('audit.outcomes.success')}</MenuItem>
              <MenuItem value="failure">{t('audit.outcomes.failure')}</MenuItem>
              <MenuItem value="denied">{t('audit.outcomes.denied')}</MenuItem>
            </TextField>

            {hasFilters && (
              <Button
                onClick={() => {
                  setFilters({});
                  setSearchDraft('');
                }}
              >
                {t('audit.clearAll')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>{t('common.retry')}</Button>}>
          {t('audit.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !failed && events.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            {t('audit.empty')}
          </Typography>
          {/*
            The earliest recorded event separates "your filters are too narrow"
            from "auditing was not running then" — a real question, since the
            trail starts on a particular day.
          */}
          {options?.earliest && (
            <Typography variant="body2" color="text.secondary">
              {t('audit.earliest', {
                date: new Date(options.earliest).toLocaleDateString(),
              })}
            </Typography>
          )}
        </Paper>
      ) : (
        <>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 150 }}>{t('audit.columns.when')}</TableCell>
                  <TableCell sx={{ width: 200 }}>{t('audit.columns.who')}</TableCell>
                  <TableCell>{t('audit.columns.what')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelected(event)}
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
                      <Typography variant="body2">
                        {event.actorDisplay ?? t('audit.unknownActor')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`audit.userTypes.${event.actorUserType}`, {
                          defaultValue: event.actorUserType,
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{actionLabel(event.action)}</Typography>
                        {event.outcome !== 'success' && (
                          <Chip
                            size="small"
                            color={event.outcome === 'denied' ? 'warning' : 'error'}
                            label={t(`audit.outcomes.${event.outcome}`)}
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
                {loadingMore ? t('common.loading') : t('audit.loadOlder')}
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('audit.noMore')}
              </Typography>
            )}
          </Box>
        </>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>{selected ? actionLabel(selected.action) : ''}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Typography variant="body2">
                {selected.actorDisplay ?? t('audit.unknownActor')}
                {selected.actorEmail ? ` · ${selected.actorEmail}` : ''} ·{' '}
                {new Date(selected.occurredAt).toLocaleString()}
              </Typography>
              {selected.entityLabel && (
                <Typography variant="body2" color="text.secondary">
                  {auditFieldLabel(selected.entityType)} · {selected.entityLabel}
                </Typography>
              )}
              <AuditChanges
                changes={selected.changes}
                formatField={fieldLabel}
                labels={{
                  field: t('audit.changes.field'),
                  before: t('audit.changes.before'),
                  after: t('audit.changes.after'),
                  createdWith: t('audit.changes.createdWith'),
                  deletedValues: t('audit.changes.deletedValues'),
                  hidden: t('audit.changes.hidden'),
                  noChanges: t('audit.changes.none'),
                }}
              />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AuditLogPage;
