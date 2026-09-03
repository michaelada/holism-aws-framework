/**
 * Scanning tickets at a gate.
 *
 * Two things are worth testing here and they are not the CRUD. The first is
 * that **a credential handed to a volunteer stays narrow** — expired, revoked
 * and never-real links are indistinguishable, a wrong PIN is counted, and a
 * device stops working the moment its session does. The second is that **a
 * refusal says why**, because "already used, admitted at 09:20 by Ann" is the
 * sentence a steward needs and "invalid" is not.
 *
 * The atomic admission itself is asserted here only as the shape of the
 * statement: whether Postgres serialises two gates is Postgres's promise, not
 * something a mocked pool can demonstrate.
 */

import crypto from 'crypto';
import { GateScanService } from '../gate-scan.service';
import { db } from '../../database/pool';
import { signTicketCode, resetSigningKeys } from '../ticket-token.service';
import { ValidationError, NotFoundError, AppError } from '../../middleware/errors';

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new GateScanService();
const query = db.query as jest.Mock;

const ORG = 'org-1';
const EVENT = 'event-1';

/*
 * Real ids, because the codes are real now.
 *
 * A scanned code is read before anything is looked up, so `'a'` — which these
 * tests used to present — is refused as a forgery before it reaches a query.
 * `EVENT_UUID` is the event a signed token is minted for; `EVENT` stays the
 * device's opaque event id for the paths that never see a token.
 */
const TICKET_UUID = '123e4567-e89b-12d3-a456-426614174000';
const EVENT_UUID = '99887766-5544-3322-1100-aabbccddeeff';
const OTHER_EVENT_UUID = '11111111-2222-3333-4444-555555555555';

const rows = (...values: any[]) => ({ rows: values });
const none = () => ({ rows: [] });

const device = { deviceId: 'device-1', stewardName: 'Ann', eventId: EVENT };
/** The same steward, on the event a signed token is minted for. */
const signedDevice = { ...device, eventId: EVENT_UUID };

/** A live session row, as `unlock` reads it. */
const sessionRow = (over: Record<string, unknown> = {}) => ({
  id: 'session-1',
  organisation_id: ORG,
  event_id: EVENT,
  event_name: 'Autumn Gate Day',
  token: 'link-token',
  pin_hash: 'unset',
  pin_salt: 'salt',
  failed_attempts: 0,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  revoked_at: null,
  created_at: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  query.mockReset();
  process.env.TICKET_SIGNING_KEYS = `1:${crypto.randomBytes(32).toString('base64')}`;
  resetSigningKeys();
});

describe('creating a session', () => {
  it('returns a six-digit PIN and stores something else', async () => {
    query
      .mockResolvedValueOnce(rows({ id: EVENT, name: 'Autumn Gate Day' })) // the event
      .mockResolvedValueOnce(rows(sessionRow())) // the insert
      .mockResolvedValueOnce(none()); // the stewards, for the returned shape

    const created = await service.createSession(ORG, EVENT, { hours: 12 });

    expect(created.pin).toMatch(/^\d{6}$/);
    expect(created.token).toBeTruthy();

    const [, insertValues] = query.mock.calls[1];
    // The PIN is not what is written down.
    expect(insertValues).not.toContain(created.pin);
    expect(insertValues[3]).not.toEqual(created.pin);
  });

  it('will not create one for another club’s event', async () => {
    query.mockResolvedValueOnce(none());

    await expect(service.createSession('other-org', EVENT)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('clamps a lifetime nobody should be able to ask for', async () => {
    query
      .mockResolvedValueOnce(rows({ id: EVENT, name: 'Autumn Gate Day' }))
      .mockResolvedValueOnce(rows(sessionRow()))
      .mockResolvedValueOnce(none());

    await service.createSession(ORG, EVENT, { hours: 100000 });

    const [, insertValues] = query.mock.calls[1];
    expect(Number(insertValues[5])).toBe(24 * 7);
  });
});

describe('unlocking', () => {
  /** Unlock once so the stored hash is known, then reuse it. */
  const liveSessionWithPin = async () => {
    query
      .mockResolvedValueOnce(rows({ id: EVENT, name: 'Autumn Gate Day' }))
      .mockResolvedValueOnce(rows(sessionRow()))
      .mockResolvedValueOnce(none());

    const created = await service.createSession(ORG, EVENT);
    const [, insertValues] = query.mock.calls[1];
    query.mockReset();
    return { pin: created.pin, hash: insertValues[3], salt: insertValues[4] };
  };

  it('needs a name, because the name is the point', async () => {
    await expect(service.unlock('link-token', '   ', '123456')).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('gives a phone its own token, and clears the failed count', async () => {
    const { pin, hash, salt } = await liveSessionWithPin();

    query
      .mockResolvedValueOnce(rows(sessionRow({ pin_hash: hash, pin_salt: salt })))
      .mockResolvedValueOnce(none()) // insert device
      .mockResolvedValueOnce(none()); // clear attempts

    const unlocked = await service.unlock('link-token', '  Ann  ', pin);

    expect(unlocked.deviceToken).toBeTruthy();
    expect(unlocked.stewardName).toBe('Ann');
    expect(unlocked.eventId).toBe(EVENT);

    // The raw token is never stored: what goes in is a hash of it.
    const [, deviceValues] = query.mock.calls[1];
    expect(deviceValues[2]).not.toEqual(unlocked.deviceToken);
    expect(query.mock.calls[2][0]).toContain('failed_attempts = 0');
  });

  it('counts a wrong PIN against the link', async () => {
    const { hash, salt } = await liveSessionWithPin();

    query
      .mockResolvedValueOnce(rows(sessionRow({ pin_hash: hash, pin_salt: salt })))
      .mockResolvedValueOnce(none());

    await expect(service.unlock('link-token', 'Ann', '000000')).rejects.toMatchObject({
      code: 'SCAN_PIN_WRONG',
    });
    expect(query.mock.calls[1][0]).toContain('failed_attempts = failed_attempts + 1');
  });

  it.each([
    ['unknown', undefined],
    ['revoked', sessionRow({ revoked_at: new Date().toISOString() })],
    ['expired', sessionRow({ expires_at: new Date(Date.now() - 1000).toISOString() })],
    ['guessed at', sessionRow({ failed_attempts: 10 })],
  ])('answers alike for a link that is %s', async (_label, row) => {
    query.mockResolvedValueOnce(row ? rows(row) : none());

    await expect(service.unlock('link-token', 'Ann', '123456')).rejects.toMatchObject({
      code: 'SCAN_LINK_INVALID',
    });
  });
});

describe('the device behind a scanner token', () => {
  it('is nothing once the session is revoked or expired', async () => {
    // The query itself filters on both, so an ended session returns no row.
    query.mockResolvedValueOnce(none());

    expect(await service.deviceFor('some-token')).toBeNull();
    expect(query.mock.calls[0][0]).toContain('s.revoked_at IS NULL');
    expect(query.mock.calls[0][0]).toContain('s.expires_at > NOW()');
  });
});

describe('the manifest', () => {
  it('folds cancelled tickets and withdrawn entries into one “void”', async () => {
    query.mockResolvedValueOnce(
      rows(
        {
          qr_code: 'a',
          ticket_reference: 'TKT-1',
          customer_name: 'Ann',
          admits: 4,
          scan_count: 1,
          valid_until: new Date().toISOString(),
          status: 'issued',
          activity_name: 'Family',
          entry_status: 'confirmed',
        },
        {
          qr_code: 'b',
          ticket_reference: 'TKT-2',
          customer_name: 'Bo',
          admits: 1,
          scan_count: 0,
          valid_until: new Date().toISOString(),
          status: 'cancelled',
          activity_name: null,
          entry_status: 'confirmed',
        },
        {
          qr_code: 'c',
          ticket_reference: 'TKT-3',
          customer_name: 'Cel',
          admits: 1,
          scan_count: 0,
          valid_until: new Date().toISOString(),
          status: 'issued',
          activity_name: null,
          entry_status: 'removed',
        }
      )
    );

    const manifest = await service.manifest(EVENT);

    expect(manifest.map((ticket) => ticket.void)).toEqual([false, true, true]);
    expect(manifest[0]).toMatchObject({ admits: 4, used: 1, holderName: 'Ann' });
  });
});

describe('a scan', () => {
  it('admits on the strength of the update alone, and says how many are in', async () => {
    query
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          scan_count: 2,
          admits: 4,
          event_activity_id: 'activity-1',
        })
      )
      .mockResolvedValueOnce(rows({ name: 'Family ticket' })) // the activity
      .mockResolvedValueOnce(none()); // the history row

    const outcome = await service.scan(device, { qrCode: TICKET_UUID });

    expect(outcome).toMatchObject({
      admitted: true,
      holderName: 'Ann',
      activityName: 'Family ticket',
      used: 2,
      admits: 4,
    });

    // The ceiling is in the statement, not in a preceding read.
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('scan_count < t.admits');
    expect(sql).toContain("t.status = 'issued'");
  });

  it('refuses a used-up ticket, and says when and by whom it went through', async () => {
    const earlier = new Date(Date.now() - 3600_000).toISOString();

    query
      .mockResolvedValueOnce(none()) // the update admitted nobody
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          event_id: EVENT,
          status: 'issued',
          scan_count: 1,
          admits: 1,
          valid_until: new Date(Date.now() + 3600_000).toISOString(),
          scan_date: earlier,
          activity_name: 'Day ticket',
          entry_status: 'confirmed',
          previous_by: 'Bo',
        })
      )
      .mockResolvedValueOnce(none()); // the history row

    const outcome = await service.scan(device, { qrCode: TICKET_UUID });

    expect(outcome).toMatchObject({
      admitted: false,
      reason: 'already_used',
      holderName: 'Ann',
      previousScanBy: 'Bo',
      previousScanAt: earlier,
    });
  });

  it.each([
    ['wrong_event', { event_id: 'another-event' }],
    ['cancelled', { status: 'cancelled' }],
    ['withdrawn', { entry_status: 'removed' }],
    ['expired', { valid_until: new Date(Date.now() - 1000).toISOString() }],
  ])('refuses with %s', async (reason, over) => {
    query
      .mockResolvedValueOnce(none())
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          event_id: EVENT,
          status: 'issued',
          scan_count: 0,
          admits: 1,
          valid_until: new Date(Date.now() + 3600_000).toISOString(),
          scan_date: null,
          activity_name: null,
          entry_status: 'confirmed',
          previous_by: null,
          ...over,
        })
      )
      .mockResolvedValueOnce(none());

    const outcome = await service.scan(device, { qrCode: TICKET_UUID });
    expect(outcome.reason).toBe(reason);
  });

  it('writes the refusal down, with the steward’s name on it', async () => {
    query
      .mockResolvedValueOnce(none())
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          event_id: EVENT,
          status: 'issued',
          scan_count: 1,
          admits: 1,
          valid_until: new Date(Date.now() + 3600_000).toISOString(),
          scan_date: null,
          activity_name: null,
          entry_status: 'confirmed',
          previous_by: null,
        })
      )
      .mockResolvedValueOnce(none());

    await service.scan(device, { qrCode: TICKET_UUID, location: 'Main gate' });

    const [historySql, historyValues] = query.mock.calls[2];
    expect(historySql).toContain('INSERT INTO ticket_scan_history');
    expect(historyValues).toEqual(
      expect.arrayContaining(['ticket-1', 'Main gate', 'refused', 'device-1', 'Ann', 'already_used'])
    );
  });

  it('says nothing about a code that is not ours', async () => {
    query.mockResolvedValueOnce(none()).mockResolvedValueOnce(none());

    // A well-formed code for a ticket we do not hold — somebody else's ticket,
    // not a forgery.
    const outcome = await service.scan(device, { qrCode: TICKET_UUID });

    expect(outcome).toEqual({ qrCode: TICKET_UUID, admitted: false, reason: 'not_found' });
    // Nothing to write history against, so nothing was written.
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe('a signed code at the gate', () => {
  const signed = () => signTicketCode(TICKET_UUID, EVENT_UUID, new Date(Date.now() + 86_400_000))!;

  it('resolves to the ticket it names and admits on the update', async () => {
    query
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          scan_count: 1,
          admits: 1,
          event_activity_id: null,
        })
      )
      .mockResolvedValueOnce(none()); // the history row

    const outcome = await service.scan(signedDevice, { qrCode: signed() });

    expect(outcome.admitted).toBe(true);
    // The UPDATE matches on the identifier inside the token, not on the token.
    expect(query.mock.calls[0][1][0]).toBe(TICKET_UUID);
  });

  it('refuses a code we did not mint before it looks anything up', async () => {
    const forged = Buffer.from(signed(), 'base64url');
    forged[20] ^= 0xff;

    const outcome = await service.scan(signedDevice, {
      qrCode: forged.toString('base64url'),
    });

    expect(outcome).toMatchObject({ admitted: false, reason: 'forged' });
    // Nothing was asked of the database: a forgery names no ticket.
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses a QR from something else entirely, without a query', async () => {
    const outcome = await service.scan(signedDevice, { qrCode: 'https://example.test/whats-on' });

    expect(outcome).toMatchObject({ admitted: false, reason: 'forged' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reads "wrong event" off the token rather than out of the row', async () => {
    const elsewhere = signTicketCode(
      TICKET_UUID,
      OTHER_EVENT_UUID,
      new Date(Date.now() + 86_400_000)
    )!;

    query
      .mockResolvedValueOnce(
        rows({
          id: 'ticket-1',
          customer_name: 'Ann',
          event_id: OTHER_EVENT_UUID,
          status: 'issued',
          scan_count: 0,
          admits: 1,
          valid_until: new Date(Date.now() + 3600_000).toISOString(),
          scan_date: null,
          activity_name: null,
          entry_status: 'confirmed',
          previous_by: null,
        })
      )
      .mockResolvedValueOnce(none()); // the history row

    const outcome = await service.scan(signedDevice, { qrCode: elsewhere });

    expect(outcome).toMatchObject({ admitted: false, reason: 'wrong_event', holderName: 'Ann' });
    /*
     * The admission UPDATE was never attempted — the token said enough. The
     * read that follows is for the holder's name and to put the refusal in the
     * ticket's history, which is the club's record either way.
     */
    expect(query.mock.calls[0][0]).toContain('SELECT');
  });
});

describe('revoking', () => {
  it('refuses to revoke a session belonging to another club', async () => {
    query.mockResolvedValueOnce(none());

    await expect(service.revokeSession('other-org', 'session-1')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

describe('the errors it throws', () => {
  it('uses codes the scanner can act on', async () => {
    query.mockResolvedValueOnce(none());

    const failure = await service.unlock('nope', 'Ann', '123456').catch((error) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure.statusCode).toBe(403);
  });
});
