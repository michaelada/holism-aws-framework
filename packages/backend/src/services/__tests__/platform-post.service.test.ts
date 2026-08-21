/**
 * Platform posts — the announcements shown on both login pages.
 *
 * The audience is what makes this worth testing carefully. A post is rendered
 * to everybody signing in to either application, on a page they have not
 * authenticated on, and one of the two consumers — the Keycloak login theme —
 * is plain JavaScript with no sanitiser of its own. So the two properties
 * pinned down here are that the public read is *already safe*, and that a link
 * URL cannot be a script.
 *
 * See docs/PLATFORM_POSTS.md.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));


import { db } from '../../database/pool';
import { platformPostService, sanitiseBody } from '../platform-post.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';

const mockDb = db as jest.Mocked<typeof db>;

const row = (over: Record<string, any> = {}) => ({
  id: 'post-1',
  title: 'Planned maintenance',
  body: '<p>We will be unavailable on <strong>Sunday</strong>.</p>',
  image_key: null,
  image_mime: null,
  links: [{ label: 'Status page', url: 'https://status.example.com' }],
  status: 'active',
  show_on_account_login: true,
  show_on_orgadmin_login: false,
  display_order: 0,
  created_at: new Date('2026-08-20'),
  updated_at: new Date('2026-08-20'),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('what a login page is given', () => {
  it('sanitises the body, because one of its readers cannot', async () => {
    /*
     * The Keycloak theme sets `innerHTML` from this. It has no DOMPurify, no
     * build step and no way to acquire either, so leaving sanitisation to the
     * caller means leaving it to the caller that cannot do it.
     */
    mockDb.query.mockResolvedValue({
      rows: [row({ body: '<p>Hello</p><script>alert(1)</script>' })],
    } as any);

    const posts = await platformPostService.listForSurface('account');

    expect(posts[0].body).toContain('<p>Hello</p>');
    expect(posts[0].body).not.toContain('<script>');
  });

  it('strips an event handler smuggled onto an allowed tag', async () => {
    mockDb.query.mockResolvedValue({
      rows: [row({ body: '<p onmouseover="steal()">Hover me</p>' })],
    } as any);

    const posts = await platformPostService.listForSurface('account');

    expect(posts[0].body).not.toContain('onmouseover');
    expect(posts[0].body).toContain('Hover me');
  });

  it('refuses a javascript: URL inside the body', () => {
    const cleaned = sanitiseBody('<a href="javascript:alert(1)">Click</a>');

    expect(cleaned).not.toContain('javascript:');
  });

  it('keeps the formatting an announcement actually uses', () => {
    const html =
      '<p>Read the <a href="https://example.com">notes</a>.</p><ul><li>One</li></ul>';

    expect(sanitiseBody(html)).toContain('<a href="https://example.com"');
    expect(sanitiseBody(html)).toContain('<li>One</li>');
  });

  it('asks only for active posts flagged for that surface', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    await platformPostService.listForSurface('orgadmin');

    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('show_on_orgadmin_login = TRUE');
    expect(sql).toContain('ORDER BY display_order ASC');
  });

  it('never lets a surface name reach the SQL', async () => {
    /*
     * The column is chosen from a fixed map rather than interpolated. This is
     * the one place a caller-supplied string gets near a column name.
     */
    await expect(
      platformPostService.listForSurface('orgadmin; DROP TABLE platform_posts' as any)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('serves an image from the platform, not from a signed S3 URL', async () => {
    // Two clients read this and neither should have to refresh an expiring URL.
    mockDb.query.mockResolvedValue({
      rows: [row({ image_key: 'platform/posts/post-1/image_x.png' })],
    } as any);

    const posts = await platformPostService.listForSurface('account');

    expect(posts[0].imageUrl).toMatch(/^\/api\/public\/posts\/post-1\/image\?v=[0-9a-f]{12}$/);
  });
});

describe('the image URL changes when the image does', () => {
  /*
   * The bug this describes: the URL was `/posts/:id/image`, derived from the
   * post — which does not change when its picture does. So a replaced image was
   * served from cache at the same address, and a removed one stayed on screen.
   * An operator swapped a picture, looked at the login page, and saw the old
   * one looking back.
   */
  const urlFor = async (imageKey: string | null) => {
    mockDb.query.mockResolvedValue({ rows: [row({ image_key: imageKey })] } as any);
    return (await platformPostService.listForSurface('account'))[0].imageUrl;
  };

  it('gives a different URL to different bytes', async () => {
    const first = await urlFor('platform/posts/post-1/image_111_aaa.png');
    const second = await urlFor('platform/posts/post-1/image_222_bbb.png');

    expect(first).not.toBe(second);
  });

  it('gives the same URL to the same image, so it stays cacheable', async () => {
    // A token that changed per read would defeat caching as thoroughly in the
    // other direction.
    const first = await urlFor('platform/posts/post-1/image_111_aaa.png');
    const second = await urlFor('platform/posts/post-1/image_111_aaa.png');

    expect(first).toBe(second);
  });

  it('gives no URL at all once the image is removed', async () => {
    expect(await urlFor(null)).toBeNull();
  });
});

describe('what the editor is given', () => {
  it('returns the body exactly as written, so it round-trips', async () => {
    /*
     * The admin read is deliberately *not* sanitised. Sanitising here would
     * quietly rewrite an author's post every time they opened it to edit, and
     * repeated saves would erode it.
     */
    const written = '<p>Hello</p><script>alert(1)</script>';
    mockDb.query.mockResolvedValue({ rows: [row({ body: written })] } as any);

    const post = await platformPostService.get('post-1');

    expect(post.body).toBe(written);
  });

  it('reports a missing post rather than returning nothing', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    await expect(platformPostService.get('gone')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('links', () => {
  const create = (links: unknown) =>
    platformPostService.create({ title: 'A post', links: links as any });

  it('refuses a javascript: URL', async () => {
    // Stored XSS aimed at everybody who signs in.
    await expect(create([{ label: 'Click', url: 'javascript:alert(1)' }])).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('refuses data: and other non-web schemes', async () => {
    await expect(
      create([{ label: 'Click', url: 'data:text/html,<script>alert(1)</script>' }])
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(create([{ label: 'Mail', url: 'mailto:someone@example.com' }])).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('refuses something that is not a URL at all', async () => {
    await expect(create([{ label: 'Click', url: 'example.com' }])).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('refuses a link missing either half', async () => {
    // A link with no text is invisible; one with no destination does nothing.
    await expect(create([{ label: 'Click', url: '' }])).rejects.toBeInstanceOf(ValidationError);
    await expect(create([{ label: '', url: 'https://example.com' }])).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('accepts http and https, and trims them', async () => {
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    await create([{ label: '  Status  ', url: '  https://status.example.com  ' }]);

    const params = mockDb.query.mock.calls[0][1] as any[];
    expect(JSON.parse(params[2])).toEqual([
      { label: 'Status', url: 'https://status.example.com' },
    ]);
  });
});

describe('the title', () => {
  it('is required', async () => {
    await expect(platformPostService.create({ title: '   ' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('is bounded to what the column holds', async () => {
    await expect(
      platformPostService.create({ title: 'x'.repeat(256) })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('creating', () => {
  it('appends rather than inserting, so nothing already arranged moves', async () => {
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    await platformPostService.create({ title: 'A post' });

    expect(mockDb.query.mock.calls[0][0] as string).toContain(
      'MAX(display_order) + 1'
    );
  });

  it('defaults to inactive and to neither surface', async () => {
    /*
     * A post nobody asked to publish is not published. The default matters
     * because the audience is the entire platform.
     */
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    await platformPostService.create({ title: 'A post' });

    const params = mockDb.query.mock.calls[0][1] as any[];
    expect(params[3]).toBe('inactive');
    expect(params[4]).toBe(false);
    expect(params[5]).toBe(false);
  });

  it('treats anything but the exact string "active" as inactive', async () => {
    mockDb.query.mockResolvedValue({ rows: [row()] } as any);

    await platformPostService.create({ title: 'A post', status: 'ACTIVE' as any });

    expect((mockDb.query.mock.calls[0][1] as any[])[3]).toBe('inactive');
  });
});

describe('reordering', () => {
  it('rewrites the whole arrangement in one statement', async () => {
    /*
     * One statement rather than a move-up/move-down pair: two people reordering
     * at once then end with one of their arrangements rather than an
     * interleaving of both.
     */
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    await platformPostService.reorder(['a', 'b', 'c']);

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(mockDb.query.mock.calls[0][0] as string).toContain('WITH ORDINALITY');
    expect(mockDb.query.mock.calls[0][1]).toEqual([['a', 'b', 'c']]);
  });

  it('refuses a list that names the same post twice', async () => {
    // Two rows would be given the same position and the order becomes arbitrary.
    await expect(platformPostService.reorder(['a', 'b', 'a'])).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('does nothing at all for an empty list', async () => {
    await platformPostService.reorder([]);

    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('refuses something that is not a list', async () => {
    await expect(platformPostService.reorder('a,b' as any)).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});

describe('the image', () => {
  it('is not served for a post that has been taken down', async () => {
    // Taking a post down takes its picture down with it.
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    expect(await platformPostService.imageLocation('post-1')).toBeNull();
    expect(mockDb.query.mock.calls[0][0] as string).toContain("status = 'active'");
  });

  it('reports the previous key when cleared, so S3 can be tidied', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ image_key: 'platform/posts/post-1/old.png' }],
    } as any);

    expect(await platformPostService.clearImage('post-1')).toEqual({
      imageKey: 'platform/posts/post-1/old.png',
    });
  });

  it('reads the old key before nulling it, rather than after', async () => {
    /*
     * `UPDATE … SET image_key = NULL … RETURNING image_key` reads perfectly and
     * is wrong: Postgres `RETURNING` gives the **new** row, so it returned the
     * null it had just written. The caller saw "no previous image" every time
     * and every replaced or removed picture stayed in the bucket forever.
     *
     * Asserted on the SQL because the failure is invisible in the result: the
     * old statement returned a row, with the wrong value in it.
     */
    mockDb.query.mockResolvedValue({ rows: [{ image_key: null }] } as any);

    await platformPostService.clearImage('post-1');

    const sql = mockDb.query.mock.calls[0][0] as string;
    expect(sql).toContain('WITH previous AS');
    expect(sql).not.toMatch(/RETURNING\s+image_key/);
  });

  it('reports the key when the post is deleted, for the same reason', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ image_key: 'platform/posts/post-1/x.png' }] } as any);

    expect(await platformPostService.remove('post-1')).toEqual({
      imageKey: 'platform/posts/post-1/x.png',
    });
  });
});
