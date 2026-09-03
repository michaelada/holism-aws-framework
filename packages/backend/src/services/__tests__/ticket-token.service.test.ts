/**
 * The string a ticket's QR carries.
 *
 * Three properties matter and the rest is arithmetic. **A code we did not mint
 * is refused** — that is the entire point of signing. **A code we did mint is
 * accepted, and gives back exactly what was signed** — an identifier that
 * comes back wrong is worse than one that fails to come back. And **a ticket
 * issued before signing still works**, because its QR is in an email nobody
 * can recall.
 */

import crypto from 'crypto';
import {
  signTicketCode,
  parseTicketCode,
  ticketIdFromCode,
  resetSigningKeys,
  signingKeys,
} from '../ticket-token.service';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const KEY_ONE = crypto.randomBytes(32).toString('base64');
const KEY_TWO = crypto.randomBytes(32).toString('base64');

const TICKET = '123e4567-e89b-12d3-a456-426614174000';
const EVENT = '99887766-5544-3322-1100-aabbccddeeff';
const VALID_UNTIL = new Date('2026-09-03T23:59:59.000Z');

const withKeys = (value: string | undefined) => {
  if (value === undefined) delete process.env.TICKET_SIGNING_KEYS;
  else process.env.TICKET_SIGNING_KEYS = value;
  resetSigningKeys();
};

const original = process.env.TICKET_SIGNING_KEYS;

beforeEach(() => withKeys(`1:${KEY_ONE}`));
afterAll(() => withKeys(original));

describe('signing a ticket code', () => {
  it('gives back the identifier, the event and the expiry it was given', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    expect(parseTicketCode(token)).toEqual({
      kind: 'signed',
      qrCode: TICKET,
      eventId: EVENT,
      // Second resolution: the expiry is a day boundary, not a stopwatch.
      expiresAt: new Date(Math.floor(VALID_UNTIL.getTime() / 1000) * 1000),
    });
  });

  it('stays small enough to print', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    /*
     * 72 characters. Twice a UUID, which takes the QR from about version 3 to
     * version 6 — the reason `generateQRCodeDataURL` draws wider now. A change
     * that pushes this materially higher needs the same conversation again.
     */
    expect(token).toHaveLength(72);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic, so re-signing the same ticket does not change it', () => {
    expect(signTicketCode(TICKET, EVENT, VALID_UNTIL)).toEqual(
      signTicketCode(TICKET, EVENT, VALID_UNTIL)
    );
  });

  it('produces a different code for a different ticket, event or expiry', () => {
    const base = signTicketCode(TICKET, EVENT, VALID_UNTIL);

    expect(signTicketCode('00000000-0000-4000-8000-000000000001', EVENT, VALID_UNTIL)).not.toEqual(base);
    expect(signTicketCode(TICKET, '00000000-0000-4000-8000-000000000002', VALID_UNTIL)).not.toEqual(base);
    expect(signTicketCode(TICKET, EVENT, new Date('2027-01-01'))).not.toEqual(base);
  });
});

describe('refusing what we did not mint', () => {
  it('refuses a token whose payload has been edited', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;
    const bytes = Buffer.from(token, 'base64url');

    // Change the event the code claims to be for — the interesting forgery,
    // because it is the one that would get somebody into the wrong gate.
    bytes[18] ^= 0xff;

    expect(parseTicketCode(bytes.toString('base64url'))).toEqual({
      kind: 'invalid',
      reason: 'bad_signature',
    });
  });

  it('refuses a token whose tag has been edited', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;
    const bytes = Buffer.from(token, 'base64url');
    bytes[bytes.length - 1] ^= 0xff;

    expect(parseTicketCode(bytes.toString('base64url')).kind).toBe('invalid');
  });

  it('refuses a token signed with a key this server does not have', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    withKeys(`2:${KEY_TWO}`);

    expect(parseTicketCode(token)).toEqual({ kind: 'invalid', reason: 'unknown_key' });
  });

  it.each([
    ['empty', ''],
    ['a poster’s URL', 'https://example.test/whats-on'],
    ['a WiFi QR', 'WIFI:S:ClubHouse;T:WPA;P:hunter2;;'],
    ['base64 of the wrong length', Buffer.alloc(20).toString('base64url')],
    ['a plausible token of the wrong version', Buffer.alloc(54, 9).toString('base64url')],
  ])('refuses %s as malformed', (_label, code) => {
    expect(parseTicketCode(code)).toEqual({ kind: 'invalid', reason: 'malformed' });
  });
});

describe('tickets issued before signing', () => {
  it('accepts a bare UUID and gives back the identifier', () => {
    expect(parseTicketCode(TICKET)).toEqual({ kind: 'legacy', qrCode: TICKET });
  });

  it('accepts one in upper case, as a scanner may report it', () => {
    expect(parseTicketCode(TICKET.toUpperCase())).toEqual({ kind: 'legacy', qrCode: TICKET });
  });

  it('accepts one even when a signing key is configured', () => {
    // The whole point: turning signing on must not invalidate what is already
    // in somebody's inbox.
    expect(signingKeys()).toHaveLength(1);
    expect(parseTicketCode(TICKET).kind).toBe('legacy');
  });
});

describe('when no key is configured', () => {
  beforeEach(() => withKeys(undefined));

  it('signs nothing, so the caller falls back to the plain identifier', () => {
    expect(signTicketCode(TICKET, EVENT, VALID_UNTIL)).toBeNull();
  });

  it('still accepts the codes those tickets carry', () => {
    expect(parseTicketCode(TICKET).kind).toBe('legacy');
  });

  it('cannot verify a token signed elsewhere', () => {
    withKeys(`1:${KEY_ONE}`);
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;
    withKeys(undefined);

    expect(parseTicketCode(token)).toEqual({ kind: 'invalid', reason: 'unknown_key' });
  });
});

describe('rotating the key', () => {
  it('signs with the first and verifies against any', () => {
    withKeys(`1:${KEY_ONE}`);
    const old = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    // A new key added in front: everything already issued must keep scanning.
    withKeys(`2:${KEY_TWO},1:${KEY_ONE}`);
    const fresh = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    expect(fresh).not.toEqual(old);
    expect(parseTicketCode(old).kind).toBe('signed');
    expect(parseTicketCode(fresh).kind).toBe('signed');
    expect(ticketIdFromCode(old)).toBe(TICKET);
    expect(ticketIdFromCode(fresh)).toBe(TICKET);
  });

  it('ignores a secret too short to be an HMAC key rather than using it', () => {
    withKeys(`1:${Buffer.alloc(8).toString('base64')}`);

    expect(signingKeys()).toHaveLength(0);
    expect(signTicketCode(TICKET, EVENT, VALID_UNTIL)).toBeNull();
  });

  it('ignores a malformed entry and keeps the rest', () => {
    withKeys(`nonsense,1:${KEY_ONE}`);

    expect(signingKeys().map((key) => key.id)).toEqual([1]);
  });
});

describe('resolving a code to a ticket', () => {
  it('names the ticket for a signed token and for a legacy code alike', () => {
    const token = signTicketCode(TICKET, EVENT, VALID_UNTIL)!;

    expect(ticketIdFromCode(token)).toBe(TICKET);
    expect(ticketIdFromCode(TICKET)).toBe(TICKET);
  });

  it('names nothing for a code we did not mint', () => {
    expect(ticketIdFromCode('not-a-ticket')).toBeNull();
  });
});
