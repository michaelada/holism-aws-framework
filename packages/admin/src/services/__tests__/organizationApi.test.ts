import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Every call the super-admin UI makes about organisations, their types, their
 * users and their fees.
 *
 * These are thin wrappers, which is the reason to pin them: the paths are the
 * only thing they contribute, and a wrong one fails at runtime against a live
 * backend rather than in review. Three groups carry real consequence —
 *
 *  - **fees**, where the request body shape decides what a club is charged;
 *  - **users and roles**, where an id in the wrong path segment reaches another
 *    organisation's user;
 *  - **the auth interceptor**, which reads the Keycloak token off `window` on
 *    every request, so a token refreshed mid-session is actually used.
 */

// Hoisted: the module builds its axios client at import time, so the stand-in
// has to exist before the mock factory runs.
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
  default: { create: vi.fn(() => client) },
}));

import * as api from '../organizationApi';

/** The interceptor pair the module registered when it was first imported. */
const requestInterceptor = () => client.interceptors.request.use.mock.calls[0];

const answers = (data: unknown) => {
  client.get.mockResolvedValue({ data });
  client.post.mockResolvedValue({ data });
  client.put.mockResolvedValue({ data });
  client.delete.mockResolvedValue({ data });
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  answers({});
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).keycloak;
});

describe('organizationApi — authenticating', () => {
  it('attaches the token that is current at the moment of the request', () => {
    const [onRequest] = requestInterceptor();
    (window as unknown as Record<string, unknown>).keycloak = { token: 'first' };

    const before = onRequest({ headers: {} });
    (window as unknown as Record<string, unknown>).keycloak = { token: 'refreshed' };
    const after = onRequest({ headers: {} });

    // Keycloak refreshes silently; a token read once goes stale and 401s.
    expect(before.headers.Authorization).toBe('Bearer first');
    expect(after.headers.Authorization).toBe('Bearer refreshed');
  });

  it('sends no header at all before anyone has signed in', () => {
    const [onRequest] = requestInterceptor();

    const config = onRequest({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('rejects a request that failed before it was sent', async () => {
    const [, onRequestError] = requestInterceptor();

    await expect(onRequestError(new Error('aborted'))).rejects.toThrow('aborted');
  });
});

describe('organizationApi — organisation types', () => {
  it('lists the types', async () => {
    answers([{ id: 'ot-1' }]);

    await expect(api.getOrganizationTypes()).resolves.toEqual([{ id: 'ot-1' }]);
    expect(client.get).toHaveBeenCalledWith('/api/admin/organization-types');
  });

  it('reads one type by id', async () => {
    await api.getOrganizationTypeById('ot-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organization-types/ot-1');
  });

  it('creates a type', async () => {
    await api.createOrganizationType({ name: 'Riding Club' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/admin/organization-types', {
      name: 'Riding Club',
    });
  });

  it('updates a type in place', async () => {
    await api.updateOrganizationType('ot-1', { name: 'Pony Club' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organization-types/ot-1', {
      name: 'Pony Club',
    });
  });

  it('deletes a type', async () => {
    await api.deleteOrganizationType('ot-1');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/organization-types/ot-1');
  });

  it('lists the capabilities a type can grant', async () => {
    await api.getCapabilities();

    expect(client.get).toHaveBeenCalledWith('/api/admin/capabilities');
  });
});

describe('organizationApi — organisations', () => {
  it('lists every organisation when no type is named', async () => {
    await api.getOrganizations();

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations', { params: {} });
  });

  it('narrows the list to one organisation type', async () => {
    await api.getOrganizations('ot-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations', {
      params: { organizationTypeId: 'ot-1' },
    });
  });

  it('reads one organisation by id', async () => {
    await api.getOrganizationById('org-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1');
  });

  it('creates an organisation', async () => {
    await api.createOrganization({ name: 'Meath Hunt' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/admin/organizations', { name: 'Meath Hunt' });
  });

  it('updates an organisation', async () => {
    await api.updateOrganization('org-1', { name: 'Meath Hunt Club' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1', {
      name: 'Meath Hunt Club',
    });
  });

  it('checks a URL code on its own for a new organisation', async () => {
    await api.checkUrlCodeAvailability('meath');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/url-code-available', {
      params: { code: 'meath' },
    });
  });

  it('excludes an organisation’s own code when it is being edited', async () => {
    await api.checkUrlCodeAvailability('meath', 'org-1');

    // Without this the club's existing code reads as taken by someone else.
    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/url-code-available', {
      params: { code: 'meath', excludeId: 'org-1' },
    });
  });

  it('sends capabilities under the name the backend expects', async () => {
    await api.updateOrganizationCapabilities('org-1', ['memberships', 'events']);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1/capabilities', {
      enabledCapabilities: ['memberships', 'events'],
    });
  });

  it('turns off every capability when handed an empty list', async () => {
    await api.updateOrganizationCapabilities('org-1', []);

    // An empty list is a decision, not a missing value; it must still be sent.
    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1/capabilities', {
      enabledCapabilities: [],
    });
  });
});

describe('organizationApi — fees', () => {
  it('reads a type’s handling fees together with how many clubs inherit them', async () => {
    answers({ fees: [{ paymentMethodId: 'pm-1' }], organisationCount: 12 });

    const result = await api.getOrganizationTypePaymentFees('ot-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organization-types/ot-1/payment-fees');
    expect(result.organisationCount).toBe(12);
  });

  it('unwraps the saved fees rather than returning the envelope', async () => {
    answers({ fees: [{ paymentMethodId: 'pm-1', handlingFeeFixed: 50 }] });

    const result = await api.setOrganizationTypePaymentFees('ot-1', [
      { paymentMethodId: 'pm-1', handlingFeeFixed: 50 } as never,
    ]);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organization-types/ot-1/payment-fees', {
      fees: [{ paymentMethodId: 'pm-1', handlingFeeFixed: 50 }],
    });
    // Callers assign this straight into form state; an envelope shows as blank fees.
    expect(result).toEqual([{ paymentMethodId: 'pm-1', handlingFeeFixed: 50 }]);
  });

  it('reads one organisation’s application fees', async () => {
    await api.getOrganizationApplicationFees('org-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/application-fees');
  });

  it('saves application fees, keeping nulls that mean "use the default"', async () => {
    await api.setOrganizationApplicationFees('org-1', [
      { paymentMethodId: 'pm-1', applicationFeeFixed: null, applicationFeePercentage: 1.5 },
    ]);

    // A dropped null reads as "charge zero", which is a different agreement.
    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1/application-fees', {
      fees: [{ paymentMethodId: 'pm-1', applicationFeeFixed: null, applicationFeePercentage: 1.5 }],
    });
  });

  it('resets one payment method back to the type default', async () => {
    await api.resetOrganizationApplicationFee('org-1', 'pm-1');

    expect(client.post).toHaveBeenCalledWith(
      '/api/admin/organizations/org-1/application-fees/pm-1/reset'
    );
  });

  it('reads the platform starting values used to pre-fill a new type', async () => {
    await api.getCardPaymentMethodDefaults();

    expect(client.get).toHaveBeenCalledWith(
      '/api/admin/organization-types/payment-fees/defaults'
    );
  });

  it('lists the payment methods', async () => {
    await api.getPaymentMethods();

    expect(client.get).toHaveBeenCalledWith('/api/admin/payment-methods');
  });
});

describe('organizationApi — users', () => {
  it('lists everyone in an organisation when no type is asked for', async () => {
    await api.getOrganizationUsers('org-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/users', { params: {} });
  });

  it('separates administrators from account users', async () => {
    await api.getOrganizationUsers('org-1', 'org-admin');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/users', {
      params: { userType: 'org-admin' },
    });
  });

  it('reads one user inside their own organisation', async () => {
    await api.getOrganizationUserById('org-1', 'user-9');

    // User ids are only meaningful under their organisation.
    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/users/user-9');
  });

  it('creates an administrator on the admin path, not the general one', async () => {
    await api.createOrganizationAdminUser('org-1', { email: 'a@b.com' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/admin/organizations/org-1/users/admin', {
      email: 'a@b.com',
    });
  });

  it('updates a user', async () => {
    await api.updateOrganizationUser('org-1', 'user-9', { firstName: 'Aoife' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1/users/user-9', {
      firstName: 'Aoife',
    });
  });

  it('deletes a user', async () => {
    await api.deleteOrganizationUser('org-1', 'user-9');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/organizations/org-1/users/user-9');
  });

  it('assigns a role by posting the role id, not by naming it in the path', async () => {
    await api.assignRoleToUser('org-1', 'user-9', 'role-3');

    expect(client.post).toHaveBeenCalledWith('/api/admin/organizations/org-1/users/user-9/roles', {
      roleId: 'role-3',
    });
  });

  it('removes a role by addressing it in the path', async () => {
    await api.removeRoleFromUser('org-1', 'user-9', 'role-3');

    expect(client.delete).toHaveBeenCalledWith(
      '/api/admin/organizations/org-1/users/user-9/roles/role-3'
    );
  });

  it('sends a new password in the body, never in the URL', async () => {
    await api.resetUserPassword('org-1', 'user-9', 'sup3r-secret');

    const [url, body] = client.post.mock.calls.at(-1)!;
    // A password in a path lands in every access log between here and the API.
    expect(url).not.toContain('sup3r-secret');
    expect(body).toEqual({ newPassword: 'sup3r-secret' });
  });
});

describe('organizationApi — roles', () => {
  it('lists an organisation’s roles', async () => {
    await api.getOrganizationRoles('org-1');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/roles');
  });

  it('reads one role', async () => {
    await api.getOrganizationRoleById('org-1', 'role-3');

    expect(client.get).toHaveBeenCalledWith('/api/admin/organizations/org-1/roles/role-3');
  });

  it('creates a role', async () => {
    await api.createOrganizationRole('org-1', { name: 'Treasurer' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/admin/organizations/org-1/roles', {
      name: 'Treasurer',
    });
  });

  it('updates a role', async () => {
    await api.updateOrganizationRole('org-1', 'role-3', { name: 'Secretary' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/admin/organizations/org-1/roles/role-3', {
      name: 'Secretary',
    });
  });

  it('deletes a role', async () => {
    await api.deleteOrganizationRole('org-1', 'role-3');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/organizations/org-1/roles/role-3');
  });
});

describe('organizationApi — the shared logo for a type', () => {
  it('uploads the file as multipart form data', async () => {
    const file = new File(['png-bytes'], 'crest.png', { type: 'image/png' });

    await api.uploadOrganizationTypeLogo('ot-1', file);

    const [url, body, config] = client.post.mock.calls.at(-1)!;
    expect(url).toBe('/api/admin/organization-types/ot-1/logo');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    // A JSON content type here reaches the server as an unparseable body.
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('removes the logo, handing each club back its own', async () => {
    await api.deleteOrganizationTypeLogo('ot-1');

    expect(client.delete).toHaveBeenCalledWith('/api/admin/organization-types/ot-1/logo');
  });
});

describe('organizationApi — failures', () => {
  it('lets a rejected request through to the caller', async () => {
    client.get.mockRejectedValue(new Error('503 Service Unavailable'));

    // Swallowing this would show an empty list as though there were no clubs.
    await expect(api.getOrganizations()).rejects.toThrow('503 Service Unavailable');
  });
});
