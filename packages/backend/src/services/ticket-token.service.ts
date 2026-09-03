import crypto from 'crypto';
import { logger } from '../config/logger';

/**
 * What a ticket's QR code carries.
 *
 * Until now it carried an opaque UUID and nothing else, which made the code a
 * *reference* — meaningful only to the database that issued it. That is a safe
 * default and it is why the old scanner had to ask the server about everything,
 * including whether a code was ours at all.
 *
 * A signed token is the same reference plus two claims and a signature over
 * them: **which event** the ticket is for and **when it stops being valid**. So
 * a gate can tell a forgery, a code for last month's gate day and an expired
 * ticket apart from a real one before it looks anything up.
 *
 * ## What signing does and does not buy
 *
 * It answers *"did we issue this?"*. It does **not** answer *"has it been used
 * already?"* — nothing self-contained can, because use is a fact about the
 * world after the code was minted. That question is still settled by the atomic
 * `UPDATE` in `gate-scan.service`, and offline by the downloaded manifest.
 * Signing is a second lock on the door, not a replacement for the first.
 *
 * ## Why HMAC rather than a public-key signature
 *
 * The usual argument for Ed25519 is that a verifier can check a signature
 * without holding a secret — which matters when the verifier is untrusted, as a
 * steward's phone is. It does not apply here: the scanner already downloads a
 * **manifest** of the event's tickets when it unlocks, so offline it can
 * recognise our codes without any cryptography at all, and online the server
 * verifies. Nothing needs the key except us.
 *
 * So the key never leaves the server, and HMAC-SHA256 truncated to 128 bits is
 * both smaller and simpler than a 64-byte signature. That size is not cosmetic:
 * a QR is scanned in a field, in the rain, on a cracked phone camera, and every
 * byte is another module in the grid.
 *
 * ## The format
 *
 * ```
 * base64url( payload ‖ tag )
 *
 * payload = version(1) ‖ keyId(1) ‖ ticketUuid(16) ‖ eventUuid(16) ‖ expiry(4)
 * tag     = HMAC-SHA256(payload, key)[0..16]
 * ```
 *
 * 54 bytes, 72 characters. The UUIDs are raw bytes rather than their 36-character
 * text form, which is where most of the saving is.
 *
 * ## Old tickets keep working
 *
 * Every ticket issued before this carries a bare UUID in the QR of an email
 * somebody already has. Those cannot be reissued, so `parseTicketCode` accepts
 * them, and they are no less safe than they were yesterday: a v4 UUID is 122
 * random bits and was never guessable. What they lack is the offline claims —
 * a legacy code has to be looked up to learn anything at all.
 *
 * See docs/SIGNED_TICKET_CODES.md.
 */

/** The only format in circulation. A second one would take the next number. */
const VERSION = 1;

const PAYLOAD_BYTES = 38;
const TAG_BYTES = 16;

/** `123e4567-e89b-12d3-a456-426614174000` — what every pre-existing ticket holds. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SigningKey {
  id: number;
  key: Buffer;
}

export type TicketCode =
  /** A signed token we minted, and the claims it carries. */
  | {
      kind: 'signed';
      qrCode: string;
      eventId: string;
      expiresAt: Date;
    }
  /** A bare UUID from a ticket issued before signing. Carries no claims. */
  | { kind: 'legacy'; qrCode: string }
  /** Not one of ours: wrong shape, unknown key, or the tag does not match. */
  | { kind: 'invalid'; reason: 'malformed' | 'unknown_key' | 'bad_signature' };

/**
 * The keys, newest first.
 *
 * `TICKET_SIGNING_KEYS` is `id:secret` pairs, comma separated, most recent
 * first — `2:Zm9v…,1:YmFy…`. The **first** signs; **all** of them verify, which
 * is what makes a key rotatable without invalidating tickets already in
 * people's inboxes. Secrets are base64; anything shorter than 32 bytes is
 * refused rather than quietly used, because a short HMAC key is the kind of
 * mistake that looks like it is working.
 */
function loadKeys(): SigningKey[] {
  const configured = process.env.TICKET_SIGNING_KEYS?.trim();
  if (!configured) return [];

  const keys: SigningKey[] = [];

  for (const entry of configured.split(',')) {
    const [rawId, ...rest] = entry.trim().split(':');
    const secret = rest.join(':');
    const id = Number(rawId);

    if (!Number.isInteger(id) || id < 1 || id > 255 || !secret) {
      logger.error('Ignoring a malformed TICKET_SIGNING_KEYS entry', { id: rawId });
      continue;
    }

    const key = Buffer.from(secret, 'base64');
    if (key.length < 32) {
      logger.error('Ignoring a TICKET_SIGNING_KEYS entry whose secret is too short', { id });
      continue;
    }

    keys.push({ id, key });
  }

  return keys;
}

/*
 * Read once. The keys come from the environment and do not change while the
 * process runs; re-reading per scan would be work at the one moment there is a
 * queue.
 */
let cached: SigningKey[] | null = null;
let warned = false;

export function signingKeys(): SigningKey[] {
  if (cached === null) {
    cached = loadKeys();

    if (cached.length === 0 && !warned) {
      warned = true;
      /*
       * Not fatal. A club that has not configured a key still issues tickets —
       * they carry the plain UUID, exactly as every ticket did before this
       * existed. Loud, because it is not what anyone deploying intends.
       */
      logger.warn(
        'No TICKET_SIGNING_KEYS configured: tickets will carry unsigned codes. ' +
          'See docs/SIGNED_TICKET_CODES.md.'
      );
    }
  }

  return cached;
}

/** Tests and key rotation in a long-running process. */
export function resetSigningKeys(): void {
  cached = null;
  warned = false;
}

const uuidToBytes = (uuid: string): Buffer => Buffer.from(uuid.replace(/-/g, ''), 'hex');

const bytesToUuid = (bytes: Buffer): string =>
  [
    bytes.subarray(0, 4).toString('hex'),
    bytes.subarray(4, 6).toString('hex'),
    bytes.subarray(6, 8).toString('hex'),
    bytes.subarray(8, 10).toString('hex'),
    bytes.subarray(10, 16).toString('hex'),
  ].join('-');

const tagFor = (payload: Buffer, key: Buffer): Buffer =>
  crypto.createHmac('sha256', key).update(payload).digest().subarray(0, TAG_BYTES);

/**
 * The code to print on a ticket.
 *
 * Returns `null` when no key is configured, and the caller then falls back to
 * the ticket's UUID — so an unconfigured deployment issues exactly what it
 * issued before rather than failing to issue at all.
 */
export function signTicketCode(
  qrCode: string,
  eventId: string,
  validUntil: Date | string
): string | null {
  const [key] = signingKeys();
  if (!key) return null;

  if (!UUID.test(qrCode) || !UUID.test(eventId)) {
    logger.error('Refusing to sign a ticket code with a malformed id', { qrCode, eventId });
    return null;
  }

  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) {
    logger.error('Refusing to sign a ticket code with no expiry', { qrCode });
    return null;
  }

  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload.writeUInt8(VERSION, 0);
  payload.writeUInt8(key.id, 1);
  uuidToBytes(qrCode).copy(payload, 2);
  uuidToBytes(eventId).copy(payload, 18);
  /*
   * Seconds, not milliseconds: four bytes reach 2106 at second resolution and
   * only 1970 at millisecond resolution. A ticket's expiry is a day boundary,
   * so the second is already more precision than the field carries.
   */
  payload.writeUInt32BE(Math.floor(expiry.getTime() / 1000), 34);

  return Buffer.concat([payload, tagFor(payload, key.key)]).toString('base64url');
}

/**
 * Read a presented code.
 *
 * Everything a gate needs to decide *without asking us* comes out of here. The
 * comparison is `timingSafeEqual`, which for a tag nobody is submitting at
 * volume is more habit than necessity — but the habit is the point.
 */
export function parseTicketCode(code: string): TicketCode {
  const presented = code?.trim() ?? '';

  if (UUID.test(presented)) return { kind: 'legacy', qrCode: presented.toLowerCase() };

  let raw: Buffer;
  try {
    raw = Buffer.from(presented, 'base64url');
  } catch {
    return { kind: 'invalid', reason: 'malformed' };
  }

  if (raw.length !== PAYLOAD_BYTES + TAG_BYTES) return { kind: 'invalid', reason: 'malformed' };
  if (raw.readUInt8(0) !== VERSION) return { kind: 'invalid', reason: 'malformed' };

  const payload = raw.subarray(0, PAYLOAD_BYTES);
  const presentedTag = raw.subarray(PAYLOAD_BYTES);

  const key = signingKeys().find((candidate) => candidate.id === payload.readUInt8(1));
  if (!key) return { kind: 'invalid', reason: 'unknown_key' };

  if (!crypto.timingSafeEqual(presentedTag, tagFor(payload, key.key))) {
    return { kind: 'invalid', reason: 'bad_signature' };
  }

  return {
    kind: 'signed',
    qrCode: bytesToUuid(payload.subarray(2, 18)),
    eventId: bytesToUuid(payload.subarray(18, 34)),
    expiresAt: new Date(payload.readUInt32BE(34) * 1000),
  };
}

/**
 * The ticket a presented code names, or `null` if it names none.
 *
 * A convenience for the paths that only want the identifier — the org-admin's
 * lookup-by-QR, for instance. The gate wants the refusal reason as well and
 * uses `parseTicketCode` directly.
 */
export function ticketIdFromCode(code: string): string | null {
  const parsed = parseTicketCode(code);
  return parsed.kind === 'invalid' ? null : parsed.qrCode;
}
