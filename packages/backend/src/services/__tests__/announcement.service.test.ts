/**
 * A club's notices, and when they are shown.
 *
 * The window is the whole control — there is no draft flag — so most of what
 * matters here is arithmetic about time and the refusals that keep a club from
 * writing a notice that can never appear.
 */

import { AnnouncementService } from '../announcement.service';
import { db } from '../../database/pool';
import { fileUploadService } from '../file-upload.service';

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../file-upload.service', () => ({
  fileUploadService: { getFileUrl: jest.fn() },
}));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new AnnouncementService();
const mockDb = db as jest.Mocked<typeof db>;
const signUrl = fileUploadService.getFileUrl as jest.Mock;

const ORG = 'org-1';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'ann-1',
  organisation_id: ORG,
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  starts_at: '2026-09-01T09:00:00.000Z',
  ends_at: '2026-09-06T18:00:00.000Z',
  image_key: null,
  image_mime: null,
  image_placement: null,
  link_label: null,
  link_url: null,
  created_at: '2026-08-30T10:00:00.000Z',
  updated_at: '2026-08-30T10:00:00.000Z',
  ...over,
});

const window = {
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-06T18:00:00.000Z',
};

beforeEach(() => {
  mockDb.query.mockReset();
  signUrl.mockReset();
  signUrl.mockResolvedValue('https://s3.example.test/signed');
});

describe('list', () => {
  it('returns a club’s announcements, finished ones included', async () => {
    // The list is a record as well as a working screen.
    mockDb.query.mockResolvedValue({ rows: [row(), row({ id: 'ann-2' })] } as never);

    const announcements = await service.list(ORG);

    expect(announcements).toHaveLength(2);
    expect(String(mockDb.query.mock.calls[0][0])).toContain('organisation_id = $1');
  });

  it('says whether each one is showing now', async () => {
    const now = new Date('2026-09-03T12:00:00.000Z');
    mockDb.query.mockResolvedValue({
      rows: [
        row(),
        row({ id: 'later', starts_at: '2026-10-01T00:00:00.000Z', ends_at: '2026-10-08T00:00:00.000Z' }),
      ],
    } as never);
    jest.useFakeTimers().setSystemTime(now);

    const [showing, scheduled] = await service.list(ORG);

    expect(showing.showing).toBe(true);
    expect(scheduled.showing).toBe(false);
    jest.useRealTimers();
  });
});

describe('get', () => {
  it('refuses an announcement belonging to another club', async () => {
    /*
     * The route's guard already authorises the club; this is the second lock.
     * A 404 rather than a 403, because confirming the id exists is the leak.
     */
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await expect(service.get(ORG, 'somebody-elses')).rejects.toThrow(/not found/i);
    expect(String(mockDb.query.mock.calls[0][0])).toContain('organisation_id = $2');
  });
});

describe('activeFor', () => {
  it('asks the database for the window, not the caller', async () => {
    /*
     * The clock that decides is the one the club's dates were written against.
     * Filtering in the client would make a member with a wrong device clock see
     * a different noticeboard from everyone else.
     */
    const now = new Date('2026-09-03T12:00:00.000Z');
    mockDb.query.mockResolvedValue({ rows: [row()] } as never);

    await service.activeFor(ORG, now);

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(String(sql)).toContain('starts_at <= $2 AND ends_at > $2');
    expect(params).toEqual([ORG, now]);
  });

  it('puts the newest first', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await service.activeFor(ORG);

    expect(String(mockDb.query.mock.calls[0][0])).toContain('ORDER BY starts_at DESC');
  });
});

describe('create', () => {
  beforeEach(() => mockDb.query.mockResolvedValue({ rows: [row()] } as never));

  it('stores the notice against the club', async () => {
    await service.create(ORG, { title: '  Clubhouse closed  ', description: '<p>x</p>', ...window });

    const params = mockDb.query.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(ORG);
    // Trimmed: a title with a stray space reads as a different notice in a list.
    expect(params[1]).toBe('Clubhouse closed');
  });

  it('refuses a notice with no title', async () => {
    await expect(service.create(ORG, { title: '   ', ...window })).rejects.toThrow(/needs a title/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('refuses a window that ends before it begins', async () => {
    /*
     * Such a row can never be shown, so nothing downstream would ever report it
     * as wrong — the club would simply never see their notice.
     */
    await expect(
      service.create(ORG, { title: 'AGM', startsAt: window.endsAt, endsAt: window.startsAt })
    ).rejects.toThrow(/must be after/i);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('refuses a window that begins and ends at the same moment', async () => {
    // Zero-length: showing for nobody.
    await expect(
      service.create(ORG, { title: 'AGM', startsAt: window.startsAt, endsAt: window.startsAt })
    ).rejects.toThrow(/must be after/i);
  });

  it('refuses a date it cannot read', async () => {
    await expect(
      service.create(ORG, { title: 'AGM', startsAt: 'next Tuesday', endsAt: window.endsAt })
    ).rejects.toThrow(/when this starts/i);
  });

  it('refuses a placement that is not one of the three', async () => {
    await expect(
      service.create(ORG, { title: 'AGM', ...window, imagePlacement: 'sidebar' as never })
    ).rejects.toThrow(/background, header or footer/i);
  });
});

describe('update', () => {
  it('404s rather than writing to another club’s announcement', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await expect(service.update(ORG, 'ann-1', { title: 'New', ...window })).rejects.toThrow(
      /not found/i
    );
  });
});

describe('images', () => {
  it('signs a URL rather than returning a key', async () => {
    // A club's notices are for its members; an unauthenticated address would
    // serve them to anyone holding an id.
    mockDb.query.mockResolvedValue({
      rows: [row({ image_key: 'organisations/org-1/announcements/ann-1/image.jpg', image_placement: 'background' })],
    } as never);

    const [announcement] = await service.list(ORG);

    expect(signUrl).toHaveBeenCalledWith(
      'organisations/org-1/announcements/ann-1/image.jpg',
      3600
    );
    expect(announcement.imageUrl).toBe('https://s3.example.test/signed');
    expect(announcement.imagePlacement).toBe('background');
  });

  it('keeps the notice when its picture cannot be signed', async () => {
    // The words are the announcement; the picture is decoration.
    signUrl.mockRejectedValue(new Error('no such object'));
    mockDb.query.mockResolvedValue({ rows: [row({ image_key: 'gone.jpg' })] } as never);

    const [announcement] = await service.list(ORG);

    expect(announcement.title).toBe('Clubhouse closed Saturday');
    expect(announcement.imageUrl).toBeNull();
  });

  it('reports no placement where there is no image', async () => {
    // A card claiming a background it has no picture for is not renderable.
    mockDb.query.mockResolvedValue({
      rows: [row({ image_key: null, image_placement: 'background' })],
    } as never);

    expect((await service.list(ORG))[0].imagePlacement).toBeNull();
  });

  it('reports the key it replaced, so the old object can be removed', async () => {
    /*
     * Read before the update rather than from `RETURNING`, which gives the new
     * row: a replaced picture would otherwise stay in the bucket forever with
     * nothing left knowing its key.
     */
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ image_key: 'old.jpg' }] } as never)
      .mockResolvedValueOnce({ rows: [row({ image_key: 'new.jpg' })] } as never);

    const { previousKey } = await service.setImage(ORG, 'ann-1', {
      s3Key: 'new.jpg',
      mimeType: 'image/jpeg',
    });

    expect(previousKey).toBe('old.jpg');
  });

  it('gives an uploaded image somewhere to go', async () => {
    // An image with no placement renders as nothing, and forgetting the radio
    // buttons is the commonest way to get there.
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ image_key: null }] } as never)
      .mockResolvedValueOnce({ rows: [row({ image_key: 'new.jpg', image_placement: 'header' })] } as never);

    await service.setImage(ORG, 'ann-1', { s3Key: 'new.jpg', mimeType: 'image/jpeg' });

    expect(String(mockDb.query.mock.calls[1][0])).toContain("COALESCE($5, image_placement, 'header')");
  });

  it('forgets the placement along with the picture', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ image_key: 'old.jpg' }] } as never)
      .mockResolvedValueOnce({ rows: [row()] } as never);

    const { previousKey, announcement } = await service.clearImage(ORG, 'ann-1');

    expect(previousKey).toBe('old.jpg');
    expect(announcement.imagePlacement).toBeNull();
    expect(String(mockDb.query.mock.calls[1][0])).toContain('image_placement = NULL');
  });

  it('404s on an announcement that is not this club’s', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await expect(service.clearImage(ORG, 'ann-1')).rejects.toThrow(/not found/i);
  });
});

describe('remove', () => {
  it('reports the image key so the object can be tidied', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ image_key: 'organisations/org-1/x.jpg' }] } as never);

    expect(await service.remove(ORG, 'ann-1')).toEqual({
      imageKey: 'organisations/org-1/x.jpg',
    });
  });

  it('404s rather than deleting another club’s announcement', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await expect(service.remove(ORG, 'ann-1')).rejects.toThrow(/not found/i);
  });
});

/**
 * Where a notice points.
 *
 * The same rules the platform's posts apply, one tier down. The difference that
 * matters is the audience: this button renders on every member's home page, and
 * a club administrator's account is a much softer target than the platform's.
 */
describe('the link', () => {
  beforeEach(() => mockDb.query.mockResolvedValue({ rows: [row()] } as never));

  it('stores both halves, trimmed', async () => {
    await service.create(ORG, {
      title: 'Summer camp',
      ...window,
      linkLabel: '  Book a place  ',
      linkUrl: '  https://kildarehunt.test/camp  ',
    });

    const params = mockDb.query.mock.calls[0][1] as unknown[];
    expect(params).toContain('Book a place');
    expect(params).toContain('https://kildarehunt.test/camp');
  });

  it('stores nothing where a club gave neither', async () => {
    // The commonest case: most notices point nowhere.
    await service.create(ORG, { title: 'Clubhouse closed', ...window });

    const params = mockDb.query.mock.calls[0][1] as unknown[];
    expect(params.filter((value) => value === null).length).toBeGreaterThanOrEqual(2);
  });

  it('refuses half a link', async () => {
    /*
     * A label with no URL is a button that does nothing; a URL with no label is
     * a link with nothing to click. Neither has anything sensible to render.
     */
    await expect(
      service.create(ORG, { title: 'Summer camp', ...window, linkLabel: 'Book a place' })
    ).rejects.toThrow(/both the words on the button and a web address/i);

    await expect(
      service.create(ORG, { title: 'Summer camp', ...window, linkUrl: 'https://example.test' })
    ).rejects.toThrow(/both the words on the button and a web address/i);
  });

  it('refuses a javascript: URL', async () => {
    // Stored XSS aimed at every member of the club, refused on the way in.
    await expect(
      service.create(ORG, {
        title: 'Summer camp',
        ...window,
        linkLabel: 'Book',
        // eslint-disable-next-line no-script-url
        linkUrl: 'javascript:alert(document.cookie)',
      })
    ).rejects.toThrow(/must start with http/i);
  });

  it('refuses mailto:, which looks like a page and is not', async () => {
    await expect(
      service.create(ORG, {
        title: 'Summer camp',
        ...window,
        linkLabel: 'Email us',
        linkUrl: 'mailto:secretary@kildarehunt.test',
      })
    ).rejects.toThrow(/must start with http/i);
  });

  it('refuses something that is not a URL at all', async () => {
    // Told, rather than silently ignored: somebody typed it on purpose.
    await expect(
      service.create(ORG, {
        title: 'Summer camp',
        ...window,
        linkLabel: 'Book',
        linkUrl: 'kildarehunt.test/camp',
      })
    ).rejects.toThrow(/not a valid link/i);
  });

  it('refuses link text too long for a button', async () => {
    await expect(
      service.create(ORG, {
        title: 'Summer camp',
        ...window,
        linkLabel: 'x'.repeat(121),
        linkUrl: 'https://kildarehunt.test',
      })
    ).rejects.toThrow(/too long/i);
  });

  it('returns it as one fact, not two columns', async () => {
    mockDb.query.mockResolvedValue({
      rows: [row({ link_label: 'Book a place', link_url: 'https://kildarehunt.test/camp' })],
    } as never);

    expect((await service.list(ORG))[0].link).toEqual({
      label: 'Book a place',
      url: 'https://kildarehunt.test/camp',
    });
  });

  it('reports no link where a row somehow holds half of one', async () => {
    // The constraint forbids it; if one ever arrives another way, it renders as
    // an ordinary notice rather than as a broken button.
    mockDb.query.mockResolvedValue({ rows: [row({ link_label: 'Book a place' })] } as never);

    expect((await service.list(ORG))[0].link).toBeNull();
  });

  it('clears the link when a club empties the fields', async () => {
    await service.update(ORG, 'ann-1', { title: 'Summer camp', ...window, linkLabel: '', linkUrl: '' });

    const params = mockDb.query.mock.calls[0][1] as unknown[];
    expect(params[7]).toBeNull();
    expect(params[8]).toBeNull();
  });
});
