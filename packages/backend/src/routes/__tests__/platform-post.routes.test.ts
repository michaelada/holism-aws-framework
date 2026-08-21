import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The two halves of platform posts: writing them, and reading them.
 *
 * They are held to opposite standards and that is the point of this file. The
 * admin half is the narrowest permission in the product — the ability to put
 * text in front of every user of the platform at once, on a page they have not
 * signed in to. The public half has no authentication at all and must never be
 * able to fail in a way that takes a login page with it.
 *
 * See docs/PLATFORM_POSTS.md.
 */

jest.mock('../../config/logger');

jest.mock('../../services/platform-post.service', () => ({
  platformPostService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
    setImage: jest.fn(),
    clearImage: jest.fn(),
    imageLocation: jest.fn(),
    listForSurface: jest.fn(),
  },
}));

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: {
    listPublicOrganisations: jest.fn(),
    getPublicOrganisationByCode: jest.fn(),
  },
}));
jest.mock('../../services/account-credentials.service', () => ({
  accountCredentialsService: { confirmEmailChange: jest.fn() },
}));
jest.mock('../../services/public-event.service', () => ({
  publicEventService: {
    listForOrganisation: jest.fn(),
    search: jest.fn(),
    findBySlug: jest.fn(),
    wasPublic: jest.fn(),
    filterOptions: jest.fn(),
    listUrls: jest.fn(),
  },
}));

/** A signed-in caller whose roles each test chooses. */
let roles: string[] = ['super-admin'];

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1', email: 'sam@example.com', roles };
    return next();
  },
  requireRole: (required: string | string[]) => (req: any, res: any, next: any) => {
    const needed = Array.isArray(required) ? required : [required];
    if (!needed.some((role) => req.user?.roles?.includes(role))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  },
}));

import { platformPostService } from '../../services/platform-post.service';
import platformPostRoutes from '../platform-post.routes';
import publicRoutes from '../public.routes';

const mocked = platformPostService as jest.Mocked<typeof platformPostService>;

const app = express();
app.use(express.json());
app.use('/api/admin/posts', platformPostRoutes);
app.use('/api/public', publicRoutes);

let server: Server;
beforeAll((done) => {
  server = app.listen(0, done);
});
afterAll((done) => {
  server.close(done);
});

const post = {
  id: 'post-1',
  title: 'Planned maintenance',
  body: '<p>Sunday.</p>',
  imageUrl: null,
  links: [],
  status: 'active',
  showOnAccountLogin: true,
  showOnOrgadminLogin: true,
  displayOrder: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  roles = ['super-admin'];
  mocked.list.mockResolvedValue([post] as any);
  mocked.get.mockResolvedValue(post as any);
  mocked.create.mockResolvedValue(post as any);
  mocked.update.mockResolvedValue(post as any);
  mocked.remove.mockResolvedValue({ imageKey: null });
  mocked.reorder.mockResolvedValue(undefined);
  mocked.listForSurface.mockResolvedValue([post] as any);
});

describe('who may write a post', () => {
  it('lets a super admin', async () => {
    await request(server).get('/api/admin/posts').expect(200);
  });

  it('refuses an organisation administrator', async () => {
    /*
     * The permission that matters. An org admin runs one club; a post is shown
     * to every user of the platform, so this is a different power entirely and
     * `admin` must not be enough for it.
     */
    roles = ['admin'];

    await request(server).get('/api/admin/posts').expect(403);
    await request(server).post('/api/admin/posts').send({ title: 'Mine' }).expect(403);
    await request(server).delete('/api/admin/posts/post-1').expect(403);
    expect(mocked.create).not.toHaveBeenCalled();
    expect(mocked.remove).not.toHaveBeenCalled();
  });

  it('refuses an ordinary user', async () => {
    roles = ['user'];
    await request(server).get('/api/admin/posts').expect(403);
  });
});

describe('writing', () => {
  it('creates and answers 201', async () => {
    const response = await request(server)
      .post('/api/admin/posts')
      .send({ title: 'Planned maintenance' });

    expect(response.status).toBe(201);
    expect(mocked.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Planned maintenance' })
    );
  });

  it('turns a refusal from the service into a 400 with its reason', async () => {
    /*
     * The author typed something the service will not store — most often a link
     * that is not http(s). They need the reason, not "something went wrong".
     */
    const { ValidationError } = jest.requireActual('../../middleware/errors');
    mocked.create.mockRejectedValue(new ValidationError('Links must start with http:// or https://'));

    const response = await request(server).post('/api/admin/posts').send({ title: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/http/);
  });

  it('answers 404 for a post that is not there', async () => {
    const { NotFoundError } = jest.requireActual('../../middleware/errors');
    mocked.get.mockRejectedValue(new NotFoundError('Post not found'));

    await request(server).get('/api/admin/posts/gone').expect(404);
  });

  it('deletes with no content', async () => {
    await request(server).delete('/api/admin/posts/post-1').expect(204);
    expect(mocked.remove).toHaveBeenCalledWith('post-1');
  });
});

describe('reordering', () => {
  it('is reachable, rather than being read as a post id', async () => {
    /*
     * `/reorder` is declared before `/:id`. Declared after, Express matches the
     * parameterised route first and the whole arrangement is silently sent to
     * "fetch the post called reorder".
     */
    await request(server)
      .put('/api/admin/posts/reorder')
      .send({ orderedIds: ['b', 'a'] })
      .expect(200);

    expect(mocked.reorder).toHaveBeenCalledWith(['b', 'a']);
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it('answers with the list in its new order', async () => {
    // So the screen does not have to guess what the server made of it.
    await request(server).put('/api/admin/posts/reorder').send({ orderedIds: ['a'] });

    expect(mocked.list).toHaveBeenCalled();
  });
});

describe('what a login page reads', () => {
  it('needs no token at all', async () => {
    const response = await request(server).get('/api/public/posts?surface=account');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('asks the service for the surface named in the query', async () => {
    await request(server).get('/api/public/posts?surface=orgadmin').expect(200);

    expect(mocked.listForSurface).toHaveBeenCalledWith('orgadmin');
  });

  it('refuses a surface it was not taught', async () => {
    // The value reaches a column lookup. Anything unrecognised is refused
    // rather than passed on.
    await request(server).get('/api/public/posts?surface=../../etc/passwd').expect(400);
    await request(server).get('/api/public/posts').expect(400);

    expect(mocked.listForSurface).not.toHaveBeenCalled();
  });

  it('answers an empty list rather than an error when the lookup fails', async () => {
    /*
     * The property this endpoint exists to preserve. A login page must render
     * whatever happens here: nobody on it can report a broken announcements
     * panel, and a 500 must not be able to take the sign-in form with it.
     */
    mocked.listForSurface.mockRejectedValue(new Error('database is down'));

    const response = await request(server).get('/api/public/posts?surface=account');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('is readable from another origin', async () => {
    // The Keycloak login themes read this, and are not always same-origin.
    const response = await request(server).get('/api/public/posts?surface=account');

    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('is revalidated rather than held, so an edit is not invisible for a minute', async () => {
    /*
     * This was `max-age=60`, to spare the database on the busiest anonymous
     * endpoint in the product — and it cost more than it saved. An operator who
     * removed a post's image saw the old one still on the login page and
     * reasonably concluded the removal had not worked.
     *
     * `no-cache` means revalidate, not "do not store": a conditional request
     * still gets a 304 when nothing has changed.
     */
    const response = await request(server).get('/api/public/posts?surface=account');

    expect(response.headers['cache-control']).toBe('no-cache');
  });
});

describe('a post’s image', () => {
  it('is not served for a post with none', async () => {
    mocked.imageLocation.mockResolvedValue(null);

    await request(server).get('/api/public/posts/post-1/image').expect(404);
  });

  it('does not fail loudly when S3 does', async () => {
    // A missing image is a missing image; the panel around it still renders.
    mocked.imageLocation.mockRejectedValue(new Error('S3 unreachable'));

    await request(server).get('/api/public/posts/post-1/image').expect(404);
  });
});
