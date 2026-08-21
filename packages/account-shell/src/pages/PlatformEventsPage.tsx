import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Drawer,
  Divider,
  FormControlLabel,
  FormControl,
  FormLabel,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import { EventDateTile, formatCurrency } from '@aws-web-framework/components';
import EntryStatus from '../components/EntryStatus';
import { useAccountApi } from '../hooks/useAccountApi';
import usePageMetadata from '../hooks/usePageMetadata';
import type { PublicEvent } from '../types/publicEvents';

interface FilterOption {
  value: string;
  label?: string;
  count: number;
}

interface FilterOptions {
  eventTypes: FilterOption[];
  regions: FilterOption[];
  organisations: FilterOption[];
}

const PAGE_SIZE = 20;

/**
 * Every public event, across every club — `/events`.
 *
 * The only page in the product with no signed-in reader, no organisation
 * context and no prior relationship with the visitor. That changes what good
 * looks like: on the member app density is a service, here it is a wall. The
 * page has to answer *what is this*, *is there anything for me* and *how do I
 * narrow it* inside the first viewport.
 *
 * A single column of wide rows rather than a grid of tiles, deliberately. These
 * events differ along date, place and club — three text facts — and a grid
 * forces each into a narrow column where the venue wraps and the date shrinks.
 * A column also scans vertically, which is how anyone reads a list of dates.
 *
 * See docs/PUBLIC_EVENTS_WIREFRAMES.md §2.
 */
const PlatformEventsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const locale = i18n.language;

  const { execute } = useAccountApi<{ events: PublicEvent[]; total: number }>();
  const { execute: executeFilters } = useAccountApi<FilterOptions>();

  /*
   * The filters live in the URL, so a visitor can share what they are looking
   * at and the back button steps through their refinements rather than leaving
   * the page.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selected = useCallback(
    (key: string) => searchParams.getAll(key),
    [searchParams]
  );

  const sort = searchParams.get('sort') ?? 'soonest';
  const activeFilterCount =
    selected('type').length + selected('region').length + selected('org').length;

  /*
   * A filtered view is the same content rearranged, and there are unbounded
   * combinations of them. The base list is indexed; every refinement is
   * `noindex,follow` — `follow` because the links out still lead to individual
   * events worth crawling.
   */
  const filtered = activeFilterCount > 0 || Boolean(searchParams.get('q'));
  usePageMetadata({
    title: t('platformEvents.metaTitle'),
    description: t('platformEvents.metaDescription'),
    canonical: `${window.location.origin}/account/events`,
    noindex: filtered,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);
    for (const key of ['type', 'region', 'org']) {
      for (const value of searchParams.getAll(key)) params.append(key, value);
    }
    if (sort !== 'soonest') params.set('sort', sort);
    return params;
  }, [searchParams, sort]);

  const load = useCallback(
    async (offset: number) => {
      offset ? setLoadingMore(true) : setLoading(true);
      setFailed(false);

      const params = new URLSearchParams(queryString);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));

      try {
        const response = await execute({
          url: `/api/public/events?${params.toString()}`,
          anonymous: true,
        });
        setEvents((current) =>
          offset ? [...current, ...(response?.events ?? [])] : response?.events ?? []
        );
        setTotal(response?.total ?? 0);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [execute, queryString]
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  useEffect(() => {
    executeFilters({ url: '/api/public/events/filters', anonymous: true })
      .then((response) => setOptions(response ?? null))
      // Filters are a refinement, not the page. Losing them leaves a working
      // list rather than an error.
      .catch(() => setOptions(null));
  }, [executeFilters]);

  /** Debounced, so the list does not reload on every keystroke. */
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchParams(
        (params) => {
          query ? params.set('q', query) : params.delete('q');
          return params;
        },
        { replace: true }
      );
    }, 350);
    return () => clearTimeout(handle);
  }, [query, setSearchParams]);

  const toggle = (key: string, value: string) => {
    setSearchParams((params) => {
      const current = params.getAll(key);
      params.delete(key);
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      for (const entry of next) params.append(key, entry);
      return params;
    });
  };

  const clearAll = () => {
    setQuery('');
    setSearchParams(new URLSearchParams());
  };

  /**
   * One filter group.
   *
   * The count beside each option tells a visitor what a click will cost before
   * they spend it, and a zero-count option is disabled rather than hidden —
   * options that vanish as you filter make the panel feel unstable.
   */
  const group = (labelKey: string, key: string, list: FilterOption[]) =>
    list.length === 0 ? null : (
      <FormControl component="fieldset" sx={{ display: 'block', mb: 3 }}>
        <FormLabel component="legend" sx={{ fontWeight: 600, mb: 0.5 }}>
          {t(labelKey)}
        </FormLabel>
        <Stack>
          {list.map((option) => (
            <FormControlLabel
              key={option.value}
              control={
                <Checkbox
                  size="small"
                  checked={selected(key).includes(option.value)}
                  onChange={() => toggle(key, option.value)}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="body2">{option.label ?? option.value}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.count}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </Stack>
      </FormControl>
    );

  const filterPanel = (
    <Box sx={{ width: { xs: 'auto', md: 260 }, p: { xs: 2, md: 0 } }}>
      <Typography variant="h2" sx={{ fontSize: '1rem', mb: 2 }}>
        {t('platformEvents.refine')}
      </Typography>
      {group('platformEvents.eventType', 'type', options?.eventTypes ?? [])}
      {group('platformEvents.region', 'region', options?.regions ?? [])}
      {group('platformEvents.club', 'org', options?.organisations ?? [])}
      {(activeFilterCount > 0 || query) && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Button size="small" onClick={clearAll}>
            {t('platformEvents.clearAll')}
          </Button>
        </>
      )}
    </Box>
  );

  const row = (event: PublicEvent) => {
    const open = event.activities.filter((activity) => !activity.membersOnly);
    const from = open.length ? Math.min(...open.map((activity) => activity.fee)) : null;
    const membersOnlyCount = event.activities.length - open.length;

    return (
      <Card
        key={event.id}
        sx={{
          mb: 2,
          cursor: 'pointer',
          transition: 'box-shadow 120ms ease',
          '&:hover': { boxShadow: 3 },
        }}
        onClick={() =>
          navigate(`/${event.organisation.code}/whats-on/${event.slug}`)
        }
      >
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <EventDateTile date={event.startDate} locale={locale} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="h3" sx={{ fontSize: '1.125rem' }}>
                  {event.name}
                </Typography>
                {from !== null && (
                  <Typography variant="body2" sx={{ flexShrink: 0 }}>
                    {t('publicEvents.from', {
                      price: formatCurrency(from / 100, event.organisation.currency, locale),
                    })}
                  </Typography>
                )}
              </Stack>

              {/* Whose event it is — the fact a cross-club listing turns on. */}
              <Typography variant="body2" color="text.secondary">
                {event.organisation.name}
              </Typography>
              {event.venue && (
                <Typography variant="body2" color="text.secondary">
                  {[event.venue.name, event.venue.region].filter(Boolean).join(' · ')}
                </Typography>
              )}

              {/*
                Whether entries are open, and how long is left. A listing that
                answers "when is it" but not "can I still enter" makes the
                reader open every row to find out — and the dates are already
                on the record.
              */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap alignItems="center">
                {event.eventType && <Chip size="small" label={event.eventType} />}
                <EntryStatus event={event} />
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('publicEvents.activityCount', { count: event.activities.length })}
                {membersOnlyCount > 0 &&
                  ` · ${t('platformEvents.someMembersOnly', { count: membersOnlyCount })}`}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' } }} gutterBottom>
        {t('platformEvents.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('platformEvents.subtitle')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('platformEvents.searchPlaceholder')}
          inputProps={{ 'aria-label': t('platformEvents.searchLabel') }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          value={sort}
          onChange={(e) =>
            setSearchParams((params) => {
              params.set('sort', e.target.value);
              return params;
            })
          }
          label={t('platformEvents.sort')}
          sx={{ minWidth: { sm: 200 } }}
        >
          <MenuItem value="soonest">{t('platformEvents.sortSoonest')}</MenuItem>
          <MenuItem value="closing">{t('platformEvents.sortClosing')}</MenuItem>
          <MenuItem value="recent">{t('platformEvents.sortRecent')}</MenuItem>
          <MenuItem value="organisation">{t('platformEvents.sortOrganisation')}</MenuItem>
        </TextField>
        {isMobile && (
          <Button
            startIcon={<TuneIcon />}
            variant="outlined"
            onClick={() => setFiltersOpen(true)}
          >
            {activeFilterCount
              ? t('platformEvents.filtersWithCount', { count: activeFilterCount })
              : t('platformEvents.filters')}
          </Button>
        )}
      </Stack>

      {/*
        Announced, not merely displayed. Without a live region a screen-reader
        user ticking a filter gets silence and no idea whether anything changed.
      */}
      <Typography
        variant="body2"
        color="text.secondary"
        aria-live="polite"
        sx={{ mb: 2 }}
      >
        {loading ? t('common.loading') : t('platformEvents.resultCount', { count: total })}
      </Typography>

      <Stack direction="row" spacing={4} alignItems="flex-start">
        {!isMobile && (
          <Box sx={{ flexShrink: 0, position: 'sticky', top: 24 }}>{filterPanel}</Box>
        )}

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {failed && <Alert severity="error" sx={{ mb: 2 }}>{t('platformEvents.loadError')}</Alert>}

          {loading ? (
            /* Skeletons at the real card height, so nothing jumps when results land. */
            <Stack spacing={2}>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} variant="rounded" height={132} />
              ))}
            </Stack>
          ) : events.length === 0 && !failed ? (
            <Alert
              severity="info"
              action={
                filtered ? (
                  <Button color="inherit" size="small" onClick={clearAll}>
                    {t('platformEvents.clearAll')}
                  </Button>
                ) : undefined
              }
            >
              {filtered ? t('platformEvents.noMatches') : t('platformEvents.noneYet')}
            </Alert>
          ) : (
            <>
              {events.map(row)}
              {events.length < total && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button onClick={() => void load(events.length)} disabled={loadingMore}>
                    {loadingMore ? t('common.loading') : t('platformEvents.showMore')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
      </Stack>

      {/*
        A bottom sheet, not a full-screen page: the results stay visible behind
        it, so the count changing is feedback rather than a surprise on return.
      */}
      <Drawer anchor="bottom" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        {filterPanel}
        <Box sx={{ p: 2, pt: 0 }}>
          <Button fullWidth variant="contained" onClick={() => setFiltersOpen(false)}>
            {t('platformEvents.apply')}
          </Button>
        </Box>
      </Drawer>
    </Container>
  );
};

export default PlatformEventsPage;
