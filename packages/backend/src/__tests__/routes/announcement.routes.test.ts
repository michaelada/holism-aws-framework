/**
 * The org-admin's announcements endpoints.
 *
 * What this file is about is the wiring: that every route is behind the
 * capability as well as the organisation scope, that the club a request
 * concerns comes from the middleware rather than from the body, and that an
 * image upload tidies up the object it replaced. The service has its own suite.
 */

const pass = (_req: any, _res: any, next: any) => next();

/** Set by the capability stub, so a test can turn the club's feature off. */
let capabilityEnabled = true;

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1' };
    next();
  },
}));

jest.mock('../../middleware/capability.middleware', () => ({
  requireOrgAdminCapability: () => [
    (req: any, res: any, next: any) => {
      if (!capabilityEnabled) {
        return res.status(403).json({ error: 'Capability not enabled' });
      }
      req.organisationId = 'org-1';
      req.organisationUserId = 'ou-1';
      next();
    },
  ],
}));

jest.mock('../../middleware/organisation-scope.middleware', () => ({
  byResource: () => pass,
  byCurrentOrganisation: () => pass,
}));

jest.mock('../../middleware/audit.middleware', () => ({
  audited: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/announcement.service', () => ({
  announcementService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setImage: jest.fn(),
    clearImage: jest.fn(),
  },
  IMAGE_PLACEMENTS: ['background', 'header', 'footer'],
}));

jest.mock('../../services/file-upload.service', () => ({
  fileUploadService: {
    validateFile: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    uploadAnnouncementImage: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import announcementRouter from '../../routes/announcement.routes';
import { announcementService } from '../../services/announcement.service';
import { fileUploadService } from '../../services/file-upload.service';

const app = express();
app.use(express.json());
app.use('/api/orgadmin', announcementRouter);

const service = announcementService as jest.Mocked<typeof announcementService>;
const uploads = fileUploadService as jest.Mocked<typeof fileUploadService>;

const announcement = {
  id: 'ann-1',
  organisationId: 'org-1',
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-06T18:00:00.000Z',
  imageUrl: null,
  imagePlacement: null,
  showing: true,
  createdAt: '2026-08-30T10:00:00.000Z',
  updatedAt: '2026-08-30T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  capabilityEnabled = true;
  service.list.mockResolvedValue([announcement] as never);
  service.get.mockResolvedValue(announcement as never);
  service.create.mockResolvedValue(announcement as never);
  service.update.mockResolvedValue(announcement as never);
  service.remove.mockResolvedValue({ imageKey: null } as never);
});

describe('GET /announcements', () => {
  it('lists the club the middleware resolved, not one from the query', async () => {
    const res = await request(app).get('/api/orgadmin/announcements?organisationId=somebody-else');

    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith('org-1');
    expect(res.body.announcements).toHaveLength(1);
  });

  it('refuses a club without the capability', async () => {
    /*
     * Hiding a menu item is not access control: a club that has not bought the
     * feature must be refused at the URL, not merely not shown the way in.
     */
    capabilityEnabled = false;

    const res = await request(app).get('/api/orgadmin/announcements');

    expect(res.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe('POST /announcements', () => {
  it('records who wrote it, from the token’s membership', async () => {
    const res = await request(app)
      .post('/api/orgadmin/announcements')
      .send({ title: 'AGM', startsAt: announcement.startsAt, endsAt: announcement.endsAt });

    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith('org-1', expect.objectContaining({ title: 'AGM' }), 'ou-1');
  });

  it('passes a refusal back in the service’s own words', async () => {
    const { ValidationError } = jest.requireActual('../../middleware/errors');
    service.create.mockRejectedValue(new ValidationError('Shows until must be after shows from'));

    const res = await request(app).post('/api/orgadmin/announcements').send({ title: 'AGM' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be after/i);
  });
});

describe('DELETE /announcements/:id', () => {
  it('removes the picture with the notice', async () => {
    // Nothing else will ever know the key once the row is gone.
    service.remove.mockResolvedValue({ imageKey: 'organisations/org-1/x.jpg' } as never);

    const res = await request(app).delete('/api/orgadmin/announcements/ann-1');

    expect(res.status).toBe(204);
    expect(uploads.deleteFile).toHaveBeenCalledWith('organisations/org-1/x.jpg');
  });

  it('still removes the notice when the bucket refuses', async () => {
    // The row is the record; the object is a copy of a picture.
    service.remove.mockResolvedValue({ imageKey: 'x.jpg' } as never);
    uploads.deleteFile.mockRejectedValue(new Error('S3 is having a day'));

    expect((await request(app).delete('/api/orgadmin/announcements/ann-1')).status).toBe(204);
  });

  it('404s for an announcement that is not this club’s', async () => {
    const { NotFoundError } = jest.requireActual('../../middleware/errors');
    service.remove.mockRejectedValue(new NotFoundError('Announcement not found'));

    expect((await request(app).delete('/api/orgadmin/announcements/ann-1')).status).toBe(404);
  });
});

describe('POST /announcements/:id/image', () => {
  beforeEach(() => {
    uploads.uploadAnnouncementImage.mockResolvedValue({
      s3Key: 'organisations/org-1/announcements/ann-1/image_new.jpg',
      fileName: 'clubhouse.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
    } as never);
    service.setImage.mockResolvedValue({
      announcement: { ...announcement, imageUrl: 'https://signed', imagePlacement: 'background' },
      previousKey: null,
    } as never);
  });

  it('stores the image under the club and the announcement', async () => {
    const res = await request(app)
      .post('/api/orgadmin/announcements/ann-1/image')
      .field('placement', 'background')
      .attach('file', Buffer.from('not really a jpeg'), 'clubhouse.jpg');

    expect(res.status).toBe(200);
    expect(uploads.uploadAnnouncementImage).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1', announcementId: 'ann-1' })
    );
    expect(service.setImage).toHaveBeenCalledWith(
      'org-1',
      'ann-1',
      expect.objectContaining({ placement: 'background' })
    );
  });

  it('deletes the picture it replaced', async () => {
    // Replacing an image otherwise leaves the old object behind forever.
    service.setImage.mockResolvedValue({
      announcement,
      previousKey: 'organisations/org-1/announcements/ann-1/image_old.jpg',
    } as never);

    await request(app)
      .post('/api/orgadmin/announcements/ann-1/image')
      .attach('file', Buffer.from('x'), 'new.jpg');

    expect(uploads.deleteFile).toHaveBeenCalledWith(
      'organisations/org-1/announcements/ann-1/image_old.jpg'
    );
  });

  it('refuses a request with no file', async () => {
    const res = await request(app).post('/api/orgadmin/announcements/ann-1/image');

    expect(res.status).toBe(400);
    expect(uploads.uploadAnnouncementImage).not.toHaveBeenCalled();
  });

  it('refuses a file that is not an image we accept', async () => {
    uploads.validateFile.mockReturnValue({ valid: false, errors: ['File type not allowed'] } as never);

    const res = await request(app)
      .post('/api/orgadmin/announcements/ann-1/image')
      .attach('file', Buffer.from('MZ'), 'payload.exe');

    expect(res.status).toBe(400);
    expect(uploads.uploadAnnouncementImage).not.toHaveBeenCalled();
  });
});

describe('DELETE /announcements/:id/image', () => {
  it('keeps the announcement and tidies the object', async () => {
    service.clearImage.mockResolvedValue({
      announcement,
      previousKey: 'organisations/org-1/x.jpg',
    } as never);

    const res = await request(app).delete('/api/orgadmin/announcements/ann-1/image');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Clubhouse closed Saturday');
    expect(uploads.deleteFile).toHaveBeenCalledWith('organisations/org-1/x.jpg');
  });
});
