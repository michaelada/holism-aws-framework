import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The three smaller super-admin services: payment methods, platform posts and
 * the audit trail.
 *
 * They are thin over axios, so what they contribute is the URL, the body shape
 * and — for audit — the query string. That last one is the substance here: the
 * server reads repeated filters as repeated keys, so an array flattened to
 * `?category=a,b` silently returns the wrong slice of the audit trail, which is
 * the one place in the product where being shown the wrong rows matters most.
 */

const { client } = vi.hoisted(() => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => client),
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

import * as paymentMethodApi from '../paymentMethodApi';
import * as postApi from '../postApi';
import * as auditApi from '../auditApi';

/* Captured at import time: each module registers this once, in its own
 * constructor, and `clearAllMocks` erases the record of that call. */
const interceptors = client.interceptors.request.use.mock.calls.map(([onRequest]) => onRequest);

const axiosError = (serverMessage?: string) => ({
  isAxiosError: true,
  message: 'Request failed with status code 500',
  response: serverMessage ? { data: { error: serverMessage } } : undefined,
});

/** The query string of the most recent GET. */
const lastQuery = () => new URL(`http://x${client.get.mock.calls.at(-1)![0]}`).searchParams;

beforeEach(() => {
  client.get.mockReset().mockResolvedValue({ data: [] });
  client.post.mockReset().mockResolvedValue({ data: {} });
  client.put.mockReset().mockResolvedValue({ data: {} });
  client.delete.mockReset().mockResolvedValue({ data: undefined });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).keycloak;
});

describe('the super-admin services — authenticating', () => {
  it('every one of them attaches the current Keycloak token', () => {
    (window as unknown as Record<string, unknown>).keycloak = { token: 'live-token' };

    // Each service builds its own client; one of them forgetting the header is
    // a whole screen that 401s while the rest of the app works.
    expect(interceptors.length).toBeGreaterThanOrEqual(3);
    interceptors.forEach((onRequest) => {
      expect(onRequest({ headers: {} }).headers.Authorization).toBe('Bearer live-token');
    });
  });

  it('sends no header before anyone has signed in', () => {
    interceptors.forEach((onRequest) => {
      expect(onRequest({ headers: {} }).headers.Authorization).toBeUndefined();
    });
  });
});

describe('paymentMethodApi', () => {
  it('lists the platform’s payment methods', async () => {
    client.get.mockResolvedValue({ data: [{ id: 'stripe' }] });

    await expect(paymentMethodApi.getPaymentMethods()).resolves.toEqual([{ id: 'stripe' }]);
    expect(client.get).toHaveBeenCalledWith('/api/admin/payment-methods');
  });

  it('lists what one organisation has enabled', async () => {
    await paymentMethodApi.getOrgPaymentMethods('org-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/payment-methods');
  });

  it('reports the server’s own reason for a refusal', async () => {
    client.get.mockRejectedValue(axiosError('Stripe account not connected'));

    await expect(paymentMethodApi.getPaymentMethods()).rejects.toThrow(
      'Stripe account not connected'
    );
  });

  it('still says something useful when the server explained nothing', async () => {
    client.get.mockRejectedValue(axiosError());

    await expect(paymentMethodApi.getOrgPaymentMethods('org-1')).rejects.toThrow(
      /failed to fetch organization payment methods/i
    );
  });

  it('passes a non-HTTP failure through unchanged', async () => {
    client.get.mockRejectedValue(new TypeError('boom'));

    await expect(paymentMethodApi.getPaymentMethods()).rejects.toThrow('boom');
  });

  it('refuses the withdrawn update helper rather than half-doing it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // It has no endpoint behind it; silently resolving would look like a save.
    await expect(paymentMethodApi.updateOrgPaymentMethods('org-1', ['stripe'])).rejects.toThrow(
      /updateOrganization/
    );
    expect(client.put).not.toHaveBeenCalled();
  });
});

describe('postApi', () => {
  it('lists the platform posts', async () => {
    await postApi.getPosts();

    expect(client.get).toHaveBeenCalledWith('/api/admin/posts');
  });

  it('reads one post', async () => {
    await postApi.getPost('p-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/posts/p-1');
  });

  it('creates a post', async () => {
    await postApi.createPost({ title: 'Maintenance window' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/admin/posts', { title: 'Maintenance window' });
  });

  it('updates a post in place', async () => {
    await postApi.updatePost('p-1', { title: 'Rescheduled' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/admin/posts/p-1', { title: 'Rescheduled' });
  });

  it('deletes a post', async () => {
    await postApi.deletePost('p-1');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/posts/p-1');
  });

  it('saves a reordering as the whole arrangement', async () => {
    await postApi.reorderPosts(['p-3', 'p-1', 'p-2']);

    // Sending one move instead would let two simultaneous reorders interleave
    // into an order neither person chose.
    expect(client.put).toHaveBeenCalledWith('/api/admin/posts/reorder', {
      orderedIds: ['p-3', 'p-1', 'p-2'],
    });
  });

  it('uploads a post image as multipart form data', async () => {
    const file = new File(['bytes'], 'banner.png', { type: 'image/png' });

    await postApi.uploadPostImage('p-1', file);

    const [url, body, config] = client.post.mock.calls.at(-1)!;
    expect(url).toBe('/api/admin/posts/p-1/image');
    expect((body as FormData).get('file')).toBe(file);
    // A JSON content type here arrives as an unparseable body.
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('removes a post image without removing the post', async () => {
    await postApi.deletePostImage('p-1');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/posts/p-1/image');
  });
});

describe('auditApi — asking for the right slice of the trail', () => {
  it('sends each value of a repeated filter as its own key', async () => {
    await auditApi.getAuditEvents({ category: ['auth', 'payment'] } as never);

    // Comma-joining these returns a different, wrong set of events.
    expect(lastQuery().getAll('category')).toEqual(['auth', 'payment']);
  });

  it('sends a single value as itself', async () => {
    await auditApi.getAuditEvents({ actorId: 'user-1' } as never);

    expect(lastQuery().get('actorId')).toBe('user-1');
  });

  it('leaves out filters that were never set', async () => {
    await auditApi.getAuditEvents({
      actorId: undefined,
      category: null,
      search: '',
      page: 2,
    } as never);

    // An empty `search=` is a filter the server will honour, matching nothing.
    const q = lastQuery();
    expect(q.has('actorId')).toBe(false);
    expect(q.has('category')).toBe(false);
    expect(q.has('search')).toBe(false);
    expect(q.get('page')).toBe('2');
  });

  it('keeps a page number of zero rather than dropping it as falsy', async () => {
    await auditApi.getAuditEvents({ page: 0 } as never);

    expect(lastQuery().get('page')).toBe('0');
  });

  it('sends no query at all when nothing was asked for', async () => {
    await auditApi.getAuditEvents({} as never);

    expect(client.get).toHaveBeenCalledWith('/api/admin/audit?');
  });
});

describe('auditApi — the rest of the trail', () => {
  it('reads one audit event', async () => {
    await auditApi.getAuditEvent('ev-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/audit/ev-1');
  });

  it('reads the filter options the trail offers', async () => {
    await auditApi.getAuditFilters();

    expect(client.get).toHaveBeenCalledWith('/api/admin/audit/filters');
  });

  it('reads the trail’s health', async () => {
    await auditApi.getAuditHealth();

    expect(client.get).toHaveBeenCalledWith('/api/admin/audit/health');
  });
});

describe('auditApi — live sessions', () => {
  it('lists who is signed in', async () => {
    await auditApi.getSessions();

    expect(client.get).toHaveBeenCalledWith('/api/admin/sessions');
  });

  it('revokes one session by its own id', async () => {
    await auditApi.revokeSession('sess-1');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/sessions/sess-1');
  });

  it('signs a user out everywhere, addressed by their Keycloak id', async () => {
    await auditApi.revokeAllSessions('kc-9');

    // The user path and the session path are one segment apart; crossing them
    // either kills one device or kills someone else's.
    expect(client.delete).toHaveBeenCalledWith('/api/admin/sessions/user/kc-9');
  });
});
