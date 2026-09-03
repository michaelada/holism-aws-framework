/**
 * The gate's own surface.
 *
 * The interesting property is negative: this router is reachable without a
 * Keycloak token, so what a scanner token *cannot* do is the security
 * argument. Every route but the unlock is gated on a live device, and a batch
 * of queued scans is applied one at a time so a duplicate inside one queue is
 * decided rather than raced.
 */

jest.mock('../../services/gate-scan.service', () => ({
  gateScanService: {
    unlock: jest.fn(),
    deviceFor: jest.fn(),
    manifest: jest.fn(),
    scan: jest.fn(),
  },
}));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import gateScanRoutes from '../../routes/gate-scan.routes';
import { gateScanService } from '../../services/gate-scan.service';
import { AppError, ValidationError } from '../../middleware/errors';

const app = express();
app.use(express.json());
app.use('/api/scan', gateScanRoutes);

const service = gateScanService as jest.Mocked<typeof gateScanService>;

const device = {
  deviceId: 'device-1',
  sessionId: 'session-1',
  stewardName: 'Ann',
  eventId: 'event-1',
  organisationId: 'org-1',
};

beforeEach(() => jest.clearAllMocks());

describe('unlocking', () => {
  it('passes the name and PIN through and answers with a scanner token', async () => {
    (service.unlock as jest.Mock).mockResolvedValue({
      deviceToken: 'scanner-token',
      eventId: 'event-1',
      eventName: 'Autumn Gate Day',
      expiresAt: '2026-09-03T18:00:00.000Z',
      stewardName: 'Ann',
    });

    const response = await request(app)
      .post('/api/scan/link-token/unlock')
      .send({ name: 'Ann', pin: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.deviceToken).toBe('scanner-token');
    expect(service.unlock).toHaveBeenCalledWith('link-token', 'Ann', '123456');
  });

  it('answers 403 for a link that is no longer valid', async () => {
    (service.unlock as jest.Mock).mockRejectedValue(
      new AppError(403, 'SCAN_LINK_INVALID', 'This scanning link is no longer valid.')
    );

    const response = await request(app)
      .post('/api/scan/link-token/unlock')
      .send({ name: 'Ann', pin: '123456' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SCAN_LINK_INVALID');
  });

  it('answers 400 when the steward gave no name', async () => {
    (service.unlock as jest.Mock).mockRejectedValue(new ValidationError('Enter your name'));

    const response = await request(app).post('/api/scan/link-token/unlock').send({ pin: '123456' });

    expect(response.status).toBe(400);
  });
});

describe('everything else', () => {
  it('needs a scanner token', async () => {
    const response = await request(app).get('/api/scan/manifest');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SCAN_SESSION_ENDED');
    expect(service.manifest).not.toHaveBeenCalled();
  });

  it('stops a phone whose session has ended, mid-afternoon', async () => {
    (service.deviceFor as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post('/api/scan/scans')
      .set('Authorization', 'Bearer revoked-token')
      .send({ scans: [{ qrCode: 'a' }] });

    expect(response.status).toBe(401);
    expect(service.scan).not.toHaveBeenCalled();
  });

  it('returns the manifest for the device’s own event, and no other', async () => {
    (service.deviceFor as jest.Mock).mockResolvedValue(device);
    (service.manifest as jest.Mock).mockResolvedValue([{ qrCode: 'a' }]);

    const response = await request(app)
      .get('/api/scan/manifest')
      .set('Authorization', 'Bearer scanner-token');

    expect(response.status).toBe(200);
    expect(response.body.eventId).toBe('event-1');
    expect(service.manifest).toHaveBeenCalledWith('event-1');
  });
});

describe('a queue arriving at once', () => {
  it('decides each scan in turn, in the order sent', async () => {
    (service.deviceFor as jest.Mock).mockResolvedValue(device);

    const order: string[] = [];
    (service.scan as jest.Mock).mockImplementation(async (_device, scan) => {
      order.push(scan.qrCode);
      // The second of a pair must not see the same count as the first, which
      // it would if these ran together.
      return { qrCode: scan.qrCode, admitted: order.filter((c) => c === scan.qrCode).length === 1 };
    });

    const response = await request(app)
      .post('/api/scan/scans')
      .set('Authorization', 'Bearer scanner-token')
      .send({ scans: [{ qrCode: 'a' }, { qrCode: 'a' }, { qrCode: 'b' }] });

    expect(response.status).toBe(200);
    expect(order).toEqual(['a', 'a', 'b']);
    expect(response.body.outcomes.map((outcome: any) => outcome.admitted)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('refuses a body that is not a list of scans', async () => {
    (service.deviceFor as jest.Mock).mockResolvedValue(device);

    const response = await request(app)
      .post('/api/scan/scans')
      .set('Authorization', 'Bearer scanner-token')
      .send({ qrCode: 'a' });

    expect(response.status).toBe(400);
  });

  it('refuses a batch far larger than a gate could produce', async () => {
    (service.deviceFor as jest.Mock).mockResolvedValue(device);

    const response = await request(app)
      .post('/api/scan/scans')
      .set('Authorization', 'Bearer scanner-token')
      .send({ scans: new Array(201).fill({ qrCode: 'a' }) });

    expect(response.status).toBe(400);
    expect(service.scan).not.toHaveBeenCalled();
  });
});
