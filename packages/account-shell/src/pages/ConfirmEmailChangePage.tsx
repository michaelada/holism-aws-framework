import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAccountApi } from '../hooks/useAccountApi';

/**
 * P6 — the page the email-change link lands on.
 *
 * **A page rather than a dialog, and unbranded.** It is opened cold from a mail
 * client, often in a different browser from the one that asked for the change,
 * with no session and no organisation resolved. There is nothing to return to
 * and nothing to decorate it with.
 *
 * **Anonymous.** Requiring a sign-in here would ask the member to authenticate
 * with the address they are in the middle of replacing. The token in the link
 * is the authority, which is safe because getting one needed their current
 * password *and* control of the address it was sent to.
 *
 * **One failure message for expired, used and never-valid.** Distinguishing
 * them would tell somebody guessing at tokens which ones exist.
 */

type Outcome =
  | { state: 'working' }
  | { state: 'done'; email: string }
  | { state: 'failed' };

export const ConfirmEmailChangePage: React.FC = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { execute } = useAccountApi<{ email: string }>();

  const token = params.get('token');
  const [outcome, setOutcome] = useState<Outcome>({ state: 'working' });

  /*
   * Once, even though React 18's development mode mounts effects twice. The
   * token is single-use, so a second call would consume nothing and report
   * failure over a change that had just succeeded.
   */
  const attempted = useRef(false);

  const confirm = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setOutcome({ state: 'failed' });
      return;
    }

    try {
      const result = await execute({
        method: 'POST',
        url: '/api/public/email-change/confirm',
        data: { token },
        anonymous: true,
      });
      setOutcome({ state: 'done', email: result.email });
    } catch {
      setOutcome({ state: 'failed' });
    }
  }, [execute, token]);

  useEffect(() => {
    void confirm();
  }, [confirm]);

  const signIn = () => {
    // The directory rather than a club: this identity may belong to several,
    // and the link carried no organisation with it.
    window.location.assign('/account/');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card>
        <CardContent sx={{ py: 5 }}>
          {outcome.state === 'working' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress aria-label={t('common.loading')} />
            </Box>
          )}

          {outcome.state === 'done' && (
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: '3rem' }} />
              <Typography variant="h5">{t('confirmEmail.doneTitle')}</Typography>
              <Typography variant="body1" color="text.secondary">
                {t('confirmEmail.doneBody', { email: outcome.email })}
              </Typography>
              <Button variant="contained" onClick={signIn}>
                {t('confirmEmail.goToSignIn')}
              </Button>
            </Stack>
          )}

          {outcome.state === 'failed' && (
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <ErrorOutlineIcon color="warning" sx={{ fontSize: '3rem' }} />
              <Typography variant="h5">{t('confirmEmail.failedTitle')}</Typography>
              <Typography variant="body1" color="text.secondary">
                {t('confirmEmail.failedBody')}
              </Typography>
              <Button variant="contained" onClick={signIn}>
                {t('confirmEmail.goToSignIn')}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default ConfirmEmailChangePage;
