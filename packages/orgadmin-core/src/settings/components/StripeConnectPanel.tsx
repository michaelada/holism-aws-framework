/**
 * Stripe Connect onboarding, on the Payment Settings tab.
 *
 * Until a club completes this it cannot be paid: checkout refuses any
 * organisation with no connected account, because a charge with no destination
 * would settle the club's own money into the platform's balance.
 *
 * The panel is deliberately blunt about the three states a club can be in —
 * not started, started but not yet able to take charges, and ready — because
 * "details submitted" is not the same as "chargesEnabled" and a club that stops
 * at Stripe's last screen will otherwise believe it is finished.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';

export interface StripeConnectState {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  updatedAt: string | null;
  /** False when the platform itself has no Stripe keys — nothing a club can fix. */
  platformConfigured: boolean;
}

const StripeConnectPanel: React.FC = () => {
  const { execute } = useApi();
  const { t } = useTranslation();

  const [state, setState] = useState<StripeConnectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  /**
   * `load` deliberately depends only on `execute`. Putting `t` in the
   * dependency array re-runs the mount effect on every render and the panel
   * spins forever rather than failing visibly (CLAUDE.md §3.4), so errors are
   * held as keys and translated at render.
   */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKey(null);
      setErrorText(null);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation/stripe-connect',
      });
      /*
       * Normalised rather than trusted. `requirementsDue` is read as an array
       * during render, and a response missing it — an older deployment, or a
       * proxy returning something unexpected — would take the whole Payment
       * Settings tab down with it, not just this panel.
       */
      setState({
        accountId: response?.accountId ?? null,
        chargesEnabled: Boolean(response?.chargesEnabled),
        payoutsEnabled: Boolean(response?.payoutsEnabled),
        detailsSubmitted: Boolean(response?.detailsSubmitted),
        requirementsDue: Array.isArray(response?.requirementsDue)
          ? response.requirementsDue
          : [],
        updatedAt: response?.updatedAt ?? null,
        platformConfigured: Boolean(response?.platformConfigured),
      });
    } catch (err: any) {
      setErrorKey('settings.stripeConnect.messages.loadFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setLoading(false);
    }
  }, [execute]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Send the administrator to Stripe.
   *
   * Both URLs return here. `refreshUrl` is where Stripe sends someone whose
   * link expired mid-flow — pointing it back at this screen means they can
   * simply start again rather than being stranded on a Stripe error page.
   */
  const startOnboarding = async () => {
    try {
      setStarting(true);
      setErrorKey(null);
      setErrorText(null);

      const here = window.location.href;
      const response = await execute({
        method: 'POST',
        url: '/api/orgadmin/organisation/stripe-connect/onboarding-link',
        data: { returnUrl: here, refreshUrl: here },
      });

      if (response?.url) {
        window.location.href = response.url;
        return;
      }
      setErrorKey('settings.stripeConnect.messages.startFailed');
    } catch (err: any) {
      setErrorKey('settings.stripeConnect.messages.startFailed');
      setErrorText(err?.message ?? null);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress aria-label={t('common.messages.loading')} />
      </Box>
    );
  }

  const ready = Boolean(state?.chargesEnabled);
  const started = Boolean(state?.accountId);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.stripeConnect.title')}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.stripeConnect.description')}
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

      {/* Nothing a club can do about this one — it is the platform's own setup. */}
      {state && !state.platformConfigured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('settings.stripeConnect.platformNotConfigured')}
        </Alert>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        {ready ? (
          <>
            <CheckCircleIcon color="success" />
            <Chip color="success" label={t('settings.stripeConnect.status.ready')} />
          </>
        ) : started ? (
          <Chip color="warning" label={t('settings.stripeConnect.status.incomplete')} />
        ) : (
          <Chip label={t('settings.stripeConnect.status.notStarted')} />
        )}
      </Stack>

      <Typography variant="body2" color="textSecondary" paragraph>
        {t(
          ready
            ? 'settings.stripeConnect.readyBody'
            : started
              ? 'settings.stripeConnect.incompleteBody'
              : 'settings.stripeConnect.notStartedBody'
        )}
      </Typography>

      {/*
        What Stripe is still waiting for. Shown verbatim: these are Stripe's own
        requirement identifiers, and translating or paraphrasing them would make
        them impossible to match against what Stripe's own screens ask for.
      */}
      {state && state.requirementsDue.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            {t('settings.stripeConnect.outstanding')}
          </Typography>
          <List dense>
            {state.requirementsDue.map((requirement) => (
              <ListItem key={requirement} disableGutters>
                <ListItemText primary={requirement} />
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
        <Button
          variant={ready ? 'outlined' : 'contained'}
          onClick={startOnboarding}
          disabled={starting || !state?.platformConfigured}
        >
          {t(
            started
              ? 'settings.stripeConnect.actions.continue'
              : 'settings.stripeConnect.actions.start'
          )}
        </Button>
        <Button onClick={load} disabled={starting}>
          {t('settings.stripeConnect.actions.refresh')}
        </Button>
      </Stack>

      {state?.accountId && (
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
          {t('settings.stripeConnect.accountId', { accountId: state.accountId })}
        </Typography>
      )}
    </Box>
  );
};

export default StripeConnectPanel;
