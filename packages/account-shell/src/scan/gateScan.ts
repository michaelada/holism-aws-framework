import axios from 'axios';

/**
 * The gate scanner's own client, storage and offline rules.
 *
 * Deliberately not `useAccountApi`. That hook carries a member's Keycloak
 * token, caches by member id, and reports offline as a failure — three things
 * that are wrong here. A steward has no account: their credential is a device
 * token from `POST /api/scan/:token/unlock`, and being offline is a normal
 * afternoon at a gate rather than an error.
 *
 * See docs/GATE_SCANNING.md.
 */

export type RefusalReason =
  | 'not_found'
  | 'wrong_event'
  | 'already_used'
  | 'expired'
  | 'cancelled'
  | 'withdrawn'
  /** Not a code we issued — a forgery, or a QR from another system entirely. */
  | 'forged';

export interface ScanOutcome {
  qrCode: string;
  admitted: boolean;
  reason?: RefusalReason;
  holderName?: string;
  activityName?: string;
  used?: number;
  admits?: number;
  previousScanAt?: string | null;
  previousScanBy?: string | null;
}

export interface ManifestTicket {
  /** The ticket's identifier. A scanned code is resolved to this before matching. */
  qrCode: string;
  ticketReference: string;
  holderName: string;
  activityName: string | null;
  admits: number;
  used: number;
  validUntil: string;
  void: boolean;
}

export interface Device {
  deviceToken: string;
  eventId: string;
  eventName: string;
  expiresAt: string;
  stewardName: string;
}

/** A scan made while offline, waiting for a signal. */
export interface QueuedScan {
  qrCode: string;
  scannedAt: string;
  /** What the steward was told at the gate, so a later disagreement is visible. */
  shownAsAdmitted: boolean;
}

const DEVICE_KEY = 'gate-scan.device';
const MANIFEST_KEY = 'gate-scan.manifest';
const QUEUE_KEY = 'gate-scan.queue';

/**
 * Storage that cannot throw.
 *
 * Private browsing on iOS, a full quota, a browser set to block site data: any
 * of them turns a read into an exception, and a scanner that white-screens at
 * a gate is worse than one that has forgotten its manifest.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Nothing to do: scanning still works, it just will not survive a reload. */
  }
}

function forget(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* As above. */
  }
}

export const loadDevice = (): Device | null => read<Device | null>(DEVICE_KEY, null);
export const saveDevice = (device: Device): void => write(DEVICE_KEY, device);

/** Forget everything about this session — sign-out, or a session that ended. */
export function clearSession(): void {
  forget(DEVICE_KEY);
  forget(MANIFEST_KEY);
  forget(QUEUE_KEY);
}

export const loadManifest = (): ManifestTicket[] => read<ManifestTicket[]>(MANIFEST_KEY, []);
export const saveManifest = (tickets: ManifestTicket[]): void => write(MANIFEST_KEY, tickets);

export const loadQueue = (): QueuedScan[] => read<QueuedScan[]>(QUEUE_KEY, []);
export const saveQueue = (queue: QueuedScan[]): void => write(QUEUE_KEY, queue);

/** Give a name and the PIN, and get a token for this phone. */
export async function unlock(token: string, name: string, pin: string): Promise<Device> {
  const { data } = await axios.post(`/api/scan/${encodeURIComponent(token)}/unlock`, { name, pin });
  return data as Device;
}

export async function fetchManifest(deviceToken: string): Promise<ManifestTicket[]> {
  const { data } = await axios.get('/api/scan/manifest', {
    headers: { Authorization: `Bearer ${deviceToken}` },
  });
  return (data?.tickets ?? []) as ManifestTicket[];
}

export async function postScans(
  deviceToken: string,
  scans: Array<{ qrCode: string; scannedAt: string; location?: string }>
): Promise<ScanOutcome[]> {
  const { data } = await axios.post(
    '/api/scan/scans',
    { scans },
    { headers: { Authorization: `Bearer ${deviceToken}` } }
  );
  return (data?.outcomes ?? []) as ScanOutcome[];
}

/** `123e4567-…` — the code a ticket issued before signing carries. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches the server's format — see backend `ticket-token.service.ts`. */
const TOKEN_BYTES = 54;
const TOKEN_VERSION = 1;

/** What a scanned code turns out to be, once read. */
export interface ScannedCode {
  /** The ticket's identifier, for matching against the manifest. */
  qrCode: string;
  /** From a signed token: which event it is for, and until when. */
  eventId?: string;
  expiresAt?: Date;
}

/**
 * Read a scanned code.
 *
 * **This parses; it does not verify.** The signing key never leaves the server,
 * which is the whole reason the token is an HMAC rather than a public-key
 * signature — so a phone can read what a code *claims* but cannot confirm we
 * minted it. That is not a gap: offline, a code's authenticity is established
 * by its being in the manifest we downloaded, and online the server checks the
 * tag before admitting anybody.
 *
 * What the claims buy at the gate is speed and honesty about the two things a
 * manifest cannot answer: a ticket for **another event** and an **expired** one
 * are refused on sight rather than reported as unrecognised.
 *
 * Returns `null` for a QR that is not one of ours at all — a parcel label, a
 * poster, a WiFi code — which is a very common thing to point a camera at.
 */
export function readScannedCode(code: string): ScannedCode | null {
  const presented = code?.trim() ?? '';

  if (UUID.test(presented)) return { qrCode: presented.toLowerCase() };

  let bytes: Uint8Array;
  try {
    // base64url → base64, which is what `atob` understands.
    const base64 = presented.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }

  if (bytes.length !== TOKEN_BYTES || bytes[0] !== TOKEN_VERSION) return null;

  const hex = (from: number, to: number) =>
    Array.from(bytes.subarray(from, to), (b) => b.toString(16).padStart(2, '0')).join('');

  const uuid = (at: number) =>
    [
      hex(at, at + 4),
      hex(at + 4, at + 6),
      hex(at + 6, at + 8),
      hex(at + 8, at + 10),
      hex(at + 10, at + 16),
    ].join('-');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    qrCode: uuid(2),
    eventId: uuid(18),
    expiresAt: new Date(view.getUint32(34) * 1000),
  };
}

/**
 * The same decision the server makes, made against the cached manifest.
 *
 * Used only when there is no signal, and it is deliberately the *same shape*
 * as the server's answer so the result screen has one thing to render. It also
 * writes the count back into the manifest, which is what stops the same code
 * being admitted twice on this phone while offline.
 *
 * What it cannot do is stop a second phone admitting the same ticket at
 * another gate — that is the honest limit of offline scanning, and it is
 * detected on sync rather than prevented.
 */
export function decideLocally(
  manifest: ManifestTicket[],
  code: string,
  now = new Date(),
  eventId?: string
): ScanOutcome {
  const qrCode = code;

  /*
   * A code we cannot read at all is a forgery or, far more often, a QR from
   * something else entirely. Either way it names no ticket, so there is nothing
   * to look up.
   */
  const scanned = readScannedCode(code);
  if (!scanned) return { qrCode, admitted: false, reason: 'forged' };

  /*
   * The token says which event it is for. Answered before the manifest,
   * because "this is last month's gate day" is a better sentence than "not one
   * of ours" and the manifest cannot tell them apart — a ticket for another
   * event is absent from it either way.
   */
  if (eventId && scanned.eventId && scanned.eventId !== eventId) {
    return { qrCode, admitted: false, reason: 'wrong_event' };
  }

  const ticket = manifest.find((candidate) => candidate.qrCode === scanned.qrCode);

  if (!ticket) {
    // A signed token for this event that is not on the list was issued after
    // the manifest was downloaded — sold on the gate this morning. Still
    // refused offline, because nothing here knows what it admits or whether it
    // has been used; the queue puts it to the server, which does.
    return { qrCode, admitted: false, reason: 'not_found' };
  }

  const shared = {
    qrCode,
    holderName: ticket.holderName,
    activityName: ticket.activityName ?? undefined,
    admits: ticket.admits,
  };

  if (ticket.void) return { ...shared, admitted: false, reason: 'cancelled', used: ticket.used };
  if (new Date(ticket.validUntil) <= now) {
    return { ...shared, admitted: false, reason: 'expired', used: ticket.used };
  }
  if (ticket.used >= ticket.admits) {
    return { ...shared, admitted: false, reason: 'already_used', used: ticket.used };
  }

  ticket.used += 1;
  return { ...shared, admitted: true, used: ticket.used };
}
