import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { Html5Qrcode } from 'html5-qrcode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  clearSession,
  decideLocally,
  readScannedCode,
  fetchManifest,
  loadDevice,
  loadManifest,
  loadQueue,
  postScans,
  saveDevice,
  saveManifest,
  saveQueue,
  unlock,
  type Device,
  type ManifestTicket,
  type QueuedScan,
  type ScanOutcome,
} from '../scan/gateScan';

/**
 * The gate.
 *
 * A steward opens the link on their own phone, gives their name and the PIN,
 * and is scanning within seconds. No account, no install, and nothing to clean
 * up afterwards — the credential expires with the session the club created.
 *
 * **The result screen is the feature.** Somebody is standing in front of the
 * steward with a queue behind them, so the answer is one colour, one name, and
 * one sentence: *"Admitted at 09:20 at the Main gate"* tells a steward what to
 * ask; *"already scanned"* does not.
 *
 * **It keeps working with no signal.** The manifest is downloaded at unlock,
 * scans are decided against it and queued, and the queue drains when a signal
 * returns. Where the server then disagrees — another gate got there first —
 * that is surfaced afterwards rather than quietly dropped.
 *
 * See docs/GATE_SCANNING.md.
 */

const READER_ID = 'gate-scan-reader';

/** Ignore a code re-read by the camera within this window. */
const REPEAT_MS = 2500;

type Phase = 'locked' | 'unlocking' | 'scanning';

export const GateScanPage: React.FC = () => {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const online = useOnlineStatus();

  const [phase, setPhase] = useState<Phase>('locked');
  const [device, setDevice] = useState<Device | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [queued, setQueued] = useState<QueuedScan[]>([]);
  const [disagreements, setDisagreements] = useState<ScanOutcome[]>([]);
  const [manualCode, setManualCode] = useState('');

  /*
   * Refs rather than state for everything the camera callback touches. That
   * callback is registered once with the scanner library and would otherwise
   * close over the first render's values forever.
   */
  const manifestRef = useRef<ManifestTicket[]>([]);
  const deviceRef = useRef<Device | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  /** A session already unlocked on this phone survives a reload. */
  useEffect(() => {
    const existing = loadDevice();
    if (!existing) return;
    deviceRef.current = existing;
    manifestRef.current = loadManifest();
    setDevice(existing);
    setQueued(loadQueue());
    setPhase('scanning');
  }, []);

  const rememberQueue = useCallback((next: QueuedScan[]) => {
    saveQueue(next);
    setQueued(next);
  }, []);

  /**
   * Send whatever is waiting, and say so when the server disagrees.
   *
   * The queue is cleared only on a successful round trip: a failure here means
   * the scans are still owed, and dropping them would lose the record of who
   * came through.
   */
  const drainQueue = useCallback(async () => {
    const current = loadQueue();
    const activeDevice = deviceRef.current;
    if (!activeDevice || current.length === 0) return;

    try {
      const outcomes = await postScans(
        activeDevice.deviceToken,
        current.map((scan) => ({ qrCode: scan.qrCode, scannedAt: scan.scannedAt }))
      );

      const surprises = outcomes.filter(
        (result, index) => current[index]?.shownAsAdmitted && !result.admitted
      );
      if (surprises.length > 0) setDisagreements((prev) => [...surprises, ...prev]);

      rememberQueue([]);
    } catch {
      /* Still offline, or the server is unreachable. Try again next time. */
    }
  }, [rememberQueue]);

  /** Drain on reconnect, and once on arriving already online. */
  useEffect(() => {
    if (phase === 'scanning' && online) void drainQueue();
  }, [online, phase, drainQueue]);

  const handleUnlock = useCallback(async () => {
    setError(null);
    setPhase('unlocking');
    try {
      const unlocked = await unlock(token, name.trim(), pin.trim());
      const tickets = await fetchManifest(unlocked.deviceToken);

      saveDevice(unlocked);
      saveManifest(tickets);
      deviceRef.current = unlocked;
      manifestRef.current = tickets;
      setDevice(unlocked);
      setPhase('scanning');
    } catch (failure: any) {
      setError(failure?.response?.data?.error?.message ?? failure?.response?.data?.error ?? t('scan.unlockFailed'));
      setPhase('locked');
    }
  }, [name, pin, t, token]);

  /**
   * One scan, from the camera or typed in.
   *
   * Online, the server's answer is the one shown — it is the only one that can
   * see the other gate. Offline, the manifest decides and the scan is queued.
   */
  const handleCode = useCallback(
    async (qrCode: string) => {
      const activeDevice = deviceRef.current;
      if (!activeDevice || !qrCode) return;

      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === qrCode && now - last.at < REPEAT_MS) return;
      lastCodeRef.current = { code: qrCode, at: now };

      const scannedAt = new Date().toISOString();

      if (navigator.onLine !== false) {
        try {
          const [serverOutcome] = await postScans(activeDevice.deviceToken, [{ qrCode, scannedAt }]);
          if (serverOutcome) {
            /*
             * Keep the cached copy in step, so that if the signal drops a
             * moment later the manifest already knows this one has been used.
             */
            const identifier = readScannedCode(qrCode)?.qrCode;
            const cached = manifestRef.current.find((ticket) => ticket.qrCode === identifier);
            if (cached && typeof serverOutcome.used === 'number') cached.used = serverOutcome.used;
            saveManifest(manifestRef.current);
            setOutcome(serverOutcome);
            return;
          }
        } catch {
          /* Fall through and decide locally: a gate does not stop for a 502. */
        }
      }

      const localOutcome = decideLocally(
        manifestRef.current,
        qrCode,
        new Date(),
        activeDevice.eventId
      );
      saveManifest(manifestRef.current);
      setOutcome(localOutcome);
      rememberQueue([...loadQueue(), { qrCode, scannedAt, shownAsAdmitted: localOutcome.admitted }]);
    },
    [rememberQueue]
  );

  /** Start the camera when scanning begins, and stop it on the way out. */
  useEffect(() => {
    if (phase !== 'scanning') return undefined;

    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          void handleCode(decoded);
        },
        () => {
          /* Called for every frame without a code. Not an error worth showing. */
        }
      )
      .catch(() => {
        if (!cancelled) setCameraError(t('scan.cameraFailed'));
      });

    return () => {
      cancelled = true;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          /* Already stopped, or never started. */
        });
      scannerRef.current = null;
    };
  }, [phase, handleCode, t]);

  const signOut = useCallback(() => {
    clearSession();
    deviceRef.current = null;
    manifestRef.current = [];
    setDevice(null);
    setQueued([]);
    setOutcome(null);
    setPhase('locked');
  }, []);

  if (phase !== 'scanning') {
    return (
      <Container maxWidth="xs" sx={{ py: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            {t('scan.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('scan.unlockIntro')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              label={t('scan.yourName')}
              helperText={t('scan.yourNameHelper')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              autoComplete="name"
            />
            <TextField
              label={t('scan.pin')}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              fullWidth
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={() => void handleUnlock()}
              disabled={phase === 'unlocking' || !name.trim() || pin.length < 6}
            >
              {phase === 'unlocking' ? <CircularProgress size={24} /> : t('scan.startScanning')}
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  const admitted = outcome?.admitted === true;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.900', color: 'common.white' }}>
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Box>
            <Typography variant="subtitle1">{device?.eventName}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t('scan.scanningAs', { name: device?.stewardName })}
            </Typography>
          </Box>
          <Button size="small" color="inherit" onClick={signOut}>
            {t('scan.finish')}
          </Button>
        </Stack>

        {!online && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {t('scan.offline')}
          </Alert>
        )}
        {queued.length > 0 && (
          <Chip
            size="small"
            color="warning"
            sx={{ mb: 1 }}
            label={t('scan.waiting', { count: queued.length })}
          />
        )}
        {cameraError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {cameraError}
          </Alert>
        )}

        {/* The camera mounts into this element; the library manages its contents. */}
        <Box id={READER_ID} sx={{ width: '100%', borderRadius: 1, overflow: 'hidden' }} />

        {outcome && (
          <Paper
            sx={{
              mt: 2,
              p: 2,
              bgcolor: admitted ? 'success.main' : 'error.main',
              color: 'common.white',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {admitted ? <CheckCircleIcon fontSize="large" /> : <CancelIcon fontSize="large" />}
              <Box>
                <Typography variant="h6">
                  {admitted ? t('scan.admitted') : t(`scan.refused.${outcome.reason ?? 'not_found'}`)}
                </Typography>
                {outcome.holderName && (
                  <Typography variant="body1">{outcome.holderName}</Typography>
                )}
                {outcome.activityName && (
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {outcome.activityName}
                  </Typography>
                )}
                {typeof outcome.used === 'number' && typeof outcome.admits === 'number' && (
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {t('scan.countOf', { used: outcome.used, admits: outcome.admits })}
                  </Typography>
                )}
                {outcome.reason === 'already_used' && outcome.previousScanAt && (
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {t('scan.previously', {
                      when: new Date(outcome.previousScanAt).toLocaleTimeString(),
                      who: outcome.previousScanBy ?? t('scan.anotherSteward'),
                    })}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>
        )}

        {/*
          A damaged code, or a camera that will not focus in low light. Typing
          the reference off the ticket is slower than scanning and better than
          turning somebody away.
        */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField
            size="small"
            fullWidth
            variant="filled"
            label={t('scan.enterCode')}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            sx={{ bgcolor: 'common.white', borderRadius: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => {
              void handleCode(manualCode.trim());
              setManualCode('');
            }}
            disabled={!manualCode.trim()}
          >
            {t('scan.check')}
          </Button>
        </Stack>

        {disagreements.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">{t('scan.disagreementsTitle')}</Typography>
            {disagreements.map((disagreement, index) => (
              <Typography variant="body2" key={`${disagreement.qrCode}-${index}`}>
                {disagreement.holderName ?? disagreement.qrCode} —{' '}
                {t(`scan.refused.${disagreement.reason ?? 'not_found'}`)}
              </Typography>
            ))}
          </Alert>
        )}
      </Container>
    </Box>
  );
};

export default GateScanPage;
