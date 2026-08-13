import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAuthContext } from '../context/AuthContext';
import { toMemberships } from '../utils/accountMemberships';
import {
  AccountMembership,
  PublicOrganisation,
  PublicOrganisationList,
} from '../types/account';

/**
 * A1 — Organisation Directory. Route `/`, public.
 *
 * `GET /api/public/organisations?q=` needs no session, so this renders for an
 * anonymous visitor. When a session does exist, the "Your organisations" strip
 * appears above the search results as the fast path for a returning multi-org
 * member.
 */
const SEARCH_DEBOUNCE_MS = 300;

export const OrganisationDirectoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticated } = useAuthContext();
  const { execute } = useAccountApi<PublicOrganisationList>();
  const { execute: executeMine } = useAccountApi<AccountMembership[]>();

  const [query, setQuery] = useState('');
  const [organisations, setOrganisations] = useState<PublicOrganisation[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<AccountMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /**
   * Searching is server-side, so every keystroke would otherwise be a request.
   * The debounce is on the value rather than the handler so the input stays
   * fully controlled and responsive while the request lags behind.
   */
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await execute({
        url: '/api/public/organisations',
        anonymous: true,
        params: debouncedQuery ? { q: debouncedQuery } : undefined,
      });
      /*
       * The list is only trusted when it is actually a list. A 200 carrying
       * something else — anything but the API answering this origin — would
       * otherwise put `undefined` into state and crash the render on
       * `organisations.length`, replacing a working page with a blank one. The
       * "could not load" branch below already says the right thing; this makes
       * it reachable.
       */
      if (!Array.isArray(result?.organisations)) {
        throw new Error('Unexpected response from the organisations endpoint');
      }

      setOrganisations(result.organisations);
      setTotal(typeof result.total === 'number' ? result.total : result.organisations.length);
    } catch {
      setFailed(true);
      setOrganisations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [execute, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authenticated) {
      setMine([]);
      return;
    }
    // A failure here is deliberately silent: the strip is a convenience, and an
    // error banner over a working public directory would be misleading.
    executeMine({ url: '/api/account/organisations' })
      .then((response) => setMine(toMemberships(response)))
      .catch(() => setMine([]));
  }, [authenticated, executeMine]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
      <Typography variant="h1" gutterBottom>
        {t('directory.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        {t('directory.subtitle')}
      </Typography>

      <TextField
        fullWidth
        label={t('directory.searchLabel')}
        placeholder={t('directory.searchPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ mb: 4 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {mine.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h2" gutterBottom>
            {t('directory.yourOrganisations')}
          </Typography>
          <Grid container spacing={2}>
            {mine.map((membership) => (
              <Grid item xs={12} sm={6} md={4} key={membership.organisationId}>
                <OrganisationCard
                  displayName={membership.displayName}
                  urlCode={membership.urlCode}
                  status={membership.status}
                  onClick={() => navigate(`/${membership.urlCode}`)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Typography variant="h2" gutterBottom>
        {t('directory.allOrganisations')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('directory.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : organisations.length === 0 ? (
        !failed && (
          <Stack spacing={1} sx={{ py: 4 }}>
            <Typography>{t('directory.empty', { query: debouncedQuery })}</Typography>
            <Typography color="text.secondary">{t('directory.emptyHint')}</Typography>
          </Stack>
        )
      ) : (
        <>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('directory.resultCount', { count: total })}
          </Typography>
          <Grid container spacing={2}>
            {organisations.map((organisation) => (
              <Grid item xs={12} sm={6} md={4} key={organisation.urlCode}>
                <OrganisationCard
                  displayName={organisation.displayName}
                  urlCode={organisation.urlCode}
                  logoUrl={organisation.branding?.logoUrl}
                  primaryColor={organisation.branding?.primaryColor}
                  location={[organisation.city, organisation.country]
                    .filter(Boolean)
                    .join(', ')}
                  onClick={() => navigate(`/${organisation.urlCode}`)}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Container>
  );
};

const OrganisationCard: React.FC<{
  displayName: string;
  urlCode: string;
  logoUrl?: string;
  primaryColor?: string;
  location?: string;
  status?: string;
  onClick: () => void;
}> = ({ displayName, urlCode, logoUrl, primaryColor, location, status, onClick }) => {
  const { t } = useTranslation();

  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={logoUrl} sx={{ bgcolor: primaryColor || 'primary.main' }}>
              {displayName.charAt(0)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap fontWeight={600}>
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {location || urlCode}
              </Typography>
            </Box>
          </Stack>
          {status && status !== 'active' && (
            <Chip
              size="small"
              sx={{ mt: 1 }}
              label={t(`switcher.status.${status}`, {
                defaultValue: status,
              })}
            />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default OrganisationDirectoryPage;
