import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { gateScanService } from '../services/gate-scan.service';
import { logger } from '../config/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errors';

/**
 * The gate's own surface — `/api/scan/*`.
 *
 * Nothing here goes through Keycloak. A steward at a gate is a volunteer for
 * the afternoon with no account, and the credential they carry is a device
 * token issued by `POST /api/scan/:token/unlock` against a link and a PIN.
 *
 * **What that token can reach is the whole security argument.** One event's
 * tickets: the manifest, and the right to admit somebody. Not the club's
 * members, not its payments, not another event, not even the *list* of other
 * events. It expires with the session it belongs to and can be revoked from
 * the org-admin, which matters because the phone carrying it is somebody's
 * personal one and it is going home in their pocket.
 *
 * Kept apart from `ticketing.routes` deliberately. That file's routes all
 * require an administrator; a reader skimming it should not have to notice
 * that three of them do not.
 *
 * See docs/GATE_SCANNING.md.
 */

const router = Router();

/**
 * Unlocking is guessable in a way the rest is not.
 *
 * The link is shared in a group chat and the PIN is six digits. The service
 * counts wrong PINs per session and stops answering after ten; this stops one
 * host hammering *every* session at once, which the per-session counter cannot
 * see.
 */
const unlockLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

interface ScannerRequest extends Request {
  device?: {
    deviceId: string;
    sessionId: string;
    stewardName: string;
    eventId: string;
    organisationId: string;
  };
}

/**
 * The steward's phone, from the bearer token.
 *
 * Checked on **every** request rather than at unlock alone, so revoking a
 * session or letting it expire stops a phone that is already scanning — which
 * is the difference between revocation meaning something and not.
 */
const requireScanner = async (req: ScannerRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const device = token ? await gateScanService.deviceFor(token) : null;

    if (!device) {
      return res.status(401).json({
        error: { code: 'SCAN_SESSION_ENDED', message: 'This scanning session has ended.' },
      });
    }

    req.device = device;
    return next();
  } catch (error) {
    logger.error('Error authorising a gate scanner:', error);
    return res.status(500).json({ error: 'Could not check this scanner' });
  }
};

function fail(res: Response, error: unknown, whileDoing: string) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
  logger.error(`Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed to ${whileDoing}` });
}

/**
 * @openapi
 * /api/scan/{token}/unlock:
 *   post:
 *     summary: Start scanning, with a name and the PIN
 *     description: >
 *       The name is written onto every scan this phone makes, so a club reading
 *       the history afterwards sees a person rather than a device.
 *     tags: [Gate]
 *     responses:
 *       200:
 *         description: A scanner token, and which event it is for
 *       403:
 *         description: The link is not valid, or the PIN is wrong
 */
router.post('/:token/unlock', unlockLimiter, async (req: Request, res: Response) => {
  try {
    const unlocked = await gateScanService.unlock(
      req.params.token,
      req.body?.name,
      String(req.body?.pin ?? '')
    );
    return res.json(unlocked);
  } catch (error) {
    return fail(res, error, 'start scanning');
  }
});

/**
 * @openapi
 * /api/scan/manifest:
 *   get:
 *     summary: Every ticket for this event, for scanning without a signal
 *     description: >
 *       A few hundred rows and tens of kilobytes, fetched once when the scanner
 *       unlocks. It is what lets a gate in a field keep working.
 *     tags: [Gate]
 *     responses:
 *       200:
 *         description: The tickets, and the event they belong to
 */
router.get('/manifest', requireScanner, async (req: ScannerRequest, res: Response) => {
  try {
    return res.json({
      eventId: req.device!.eventId,
      stewardName: req.device!.stewardName,
      fetchedAt: new Date().toISOString(),
      tickets: await gateScanService.manifest(req.device!.eventId),
    });
  } catch (error) {
    return fail(res, error, 'load the tickets');
  }
});

/**
 * @openapi
 * /api/scan/scans:
 *   post:
 *     summary: Admit one or more people
 *     description: >
 *       A batch, because a scanner that has been offline arrives with a queue —
 *       and one path for live scans and queued ones means the gate's rules
 *       cannot differ between them. Each scan is decided independently; the
 *       response says what happened to each.
 *     tags: [Gate]
 *     responses:
 *       200:
 *         description: One outcome per scan, in the order they were sent
 */
router.post('/scans', requireScanner, async (req: ScannerRequest, res: Response) => {
  try {
    const scans = Array.isArray(req.body?.scans) ? req.body.scans : null;
    if (!scans) return res.status(400).json({ error: 'Send a list of scans' });
    if (scans.length > 200) {
      // A gate does not present two hundred people at once; a body this size is
      // a mistake or a probe, and the queue can drain in more than one request.
      return res.status(400).json({ error: 'Too many scans in one request' });
    }

    const outcomes = [];
    for (const scan of scans) {
      /*
       * Sequential rather than in parallel. Two of the same code inside one
       * queue — the same person scanned twice while offline — must be decided
       * one after the other, or both would see the same count and both be
       * admitted.
       */
      outcomes.push(
        await gateScanService.scan(req.device!, {
          qrCode: String(scan?.qrCode ?? ''),
          scannedAt: scan?.scannedAt,
          location: scan?.location,
        })
      );
    }

    return res.json({ outcomes });
  } catch (error) {
    return fail(res, error, 'record the scans');
  }
});

export default router;
