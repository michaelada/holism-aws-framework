/**
 * The rule a gate applies when there is no signal.
 *
 * This is the same decision the server makes, made against a downloaded list,
 * and it has to be the same or a steward is told one thing at the gate and a
 * club sees another an hour later. What it deliberately does *not* try to do
 * is see the other gate — that is the honest limit of offline scanning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  decideLocally,
  readScannedCode,
  loadQueue,
  saveQueue,
  clearSession,
  type ManifestTicket,
} from '../gateScan';

/*
 * A signed token, built the way the server builds one, so the scanner's reader
 * is tested against the real format rather than against its own idea of it.
 * The tag is not checked here — the key is server-side, which is the point —
 * so any 16 bytes stand in for it.
 */
const TICKET_UUID = '123e4567-e89b-12d3-a456-426614174000';
const EVENT_UUID = '99887766-5544-3322-1100-aabbccddeeff';
const OTHER_TICKET = '00000000-1111-2222-3333-444444444444';

const token = (qrCode = TICKET_UUID, eventId = EVENT_UUID, expiry = new Date('2026-12-31')) => {
  const bytes = new Uint8Array(54);
  bytes[0] = 1; // version
  bytes[1] = 1; // key id
  const uuidBytes = (uuid: string) =>
    Uint8Array.from(uuid.replace(/-/g, '').match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  bytes.set(uuidBytes(qrCode), 2);
  bytes.set(uuidBytes(eventId), 18);
  new DataView(bytes.buffer).setUint32(34, Math.floor(expiry.getTime() / 1000));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const ticket = (over: Partial<ManifestTicket> = {}): ManifestTicket => ({
  qrCode: TICKET_UUID,
  ticketReference: 'TKT-1',
  holderName: 'Ann',
  activityName: 'Day ticket',
  admits: 1,
  used: 0,
  validUntil: new Date(Date.now() + 3600_000).toISOString(),
  void: false,
  ...over,
});

describe('deciding without a signal', () => {
  it('admits a ticket that has not been used up, and counts it', () => {
    const manifest = [ticket({ admits: 4, used: 1 })];

    const outcome = decideLocally(manifest, TICKET_UUID);

    expect(outcome).toMatchObject({ admitted: true, used: 2, admits: 4, holderName: 'Ann' });
    // The count is written back, which is what stops a second admission here.
    expect(manifest[0].used).toBe(2);
  });

  it('refuses the same ticket the second time, on this phone at least', () => {
    const manifest = [ticket()];

    expect(decideLocally(manifest, TICKET_UUID).admitted).toBe(true);
    expect(decideLocally(manifest, TICKET_UUID)).toMatchObject({
      admitted: false,
      reason: 'already_used',
    });
  });

  it('lets a family ticket through as many times as it admits, and no more', () => {
    const manifest = [ticket({ admits: 3 })];

    const outcomes = [1, 2, 3, 4].map(() => decideLocally(manifest, TICKET_UUID));

    expect(outcomes.map((outcome) => outcome.admitted)).toEqual([true, true, true, false]);
    expect(outcomes[3].reason).toBe('already_used');
  });

  it('refuses a cancelled ticket or a withdrawn entry without counting it', () => {
    const manifest = [ticket({ void: true })];

    expect(decideLocally(manifest, TICKET_UUID)).toMatchObject({ admitted: false, reason: 'cancelled' });
    expect(manifest[0].used).toBe(0);
  });

  it('refuses one that is out of date', () => {
    const manifest = [ticket({ validUntil: new Date(Date.now() - 1000).toISOString() })];

    expect(decideLocally(manifest, TICKET_UUID).reason).toBe('expired');
  });

  it('says nothing about a code that is not on the list', () => {
    expect(decideLocally([ticket()], OTHER_TICKET)).toEqual({
      qrCode: OTHER_TICKET,
      admitted: false,
      reason: 'not_found',
    });
  });
});

describe('reading a scanned code', () => {
  it('reads a bare UUID from a ticket issued before signing', () => {
    expect(readScannedCode(TICKET_UUID)).toEqual({ qrCode: TICKET_UUID });
  });

  it('reads the identifier, the event and the expiry out of a signed token', () => {
    const expiry = new Date('2026-09-04T00:00:00.000Z');

    expect(readScannedCode(token(TICKET_UUID, EVENT_UUID, expiry))).toEqual({
      qrCode: TICKET_UUID,
      eventId: EVENT_UUID,
      expiresAt: expiry,
    });
  });

  it.each([
    ['a poster’s URL', 'https://example.test/whats-on'],
    ['a WiFi QR', 'WIFI:S:ClubHouse;T:WPA;P:hunter2;;'],
    ['nothing', ''],
  ])('reads %s as not one of ours', (_label, code) => {
    // A camera at a gate is pointed at a great many things that are not
    // tickets. None of them should look like one.
    expect(readScannedCode(code)).toBeNull();
  });
});

describe('deciding on a signed token', () => {
  it('matches the manifest on the identifier inside the token', () => {
    const manifest = [ticket({ admits: 2 })];

    const outcome = decideLocally(manifest, token(), new Date(), EVENT_UUID);

    expect(outcome).toMatchObject({ admitted: true, holderName: 'Ann', used: 1 });
  });

  it('refuses a ticket for another event on sight, without the manifest', () => {
    const elsewhere = token(TICKET_UUID, '11111111-2222-3333-4444-555555555555');

    expect(decideLocally([ticket()], elsewhere, new Date(), EVENT_UUID)).toMatchObject({
      admitted: false,
      reason: 'wrong_event',
    });
  });

  it('refuses a code that is not one of ours as a forgery, not as unknown', () => {
    // "Not one of ours" and "not recognised" are different sentences at a gate:
    // the first is a QR off a poster, the second is somebody's real ticket for
    // the wrong day.
    expect(decideLocally([ticket()], 'https://example.test', new Date(), EVENT_UUID)).toMatchObject({
      admitted: false,
      reason: 'forged',
    });
  });

  it('still says not found for a signed ticket sold after the manifest was taken', () => {
    const soldThisMorning = token('55555555-6666-7777-8888-999999999999', EVENT_UUID);

    expect(decideLocally([ticket()], soldThisMorning, new Date(), EVENT_UUID)).toMatchObject({
      admitted: false,
      reason: 'not_found',
    });
  });
});

describe('what is kept between reloads', () => {
  beforeEach(() => window.localStorage.clear());

  it('remembers queued scans, and forgets everything when the steward finishes', () => {
    saveQueue([{ qrCode: 'a', scannedAt: '2026-09-02T10:00:00.000Z', shownAsAdmitted: true }]);

    expect(loadQueue()).toHaveLength(1);

    clearSession();
    expect(loadQueue()).toEqual([]);
  });

  it('survives storage that refuses to answer', () => {
    // Private browsing, a full quota, or a browser set to block site data. A
    // scanner that white-screens at a gate is worse than one with no memory.
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    expect(loadQueue()).toEqual([]);

    getItem.mockRestore();
  });
});
