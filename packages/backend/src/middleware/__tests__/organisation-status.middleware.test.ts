import { Response, NextFunction } from 'express';
import { loadOrganisationCapabilities, OrganisationRequest } from '../capability.middleware';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

/**
 * An inactive organisation admits nobody — its own administrators included.
 *
 * Before this, every gate in the platform tested `status = 'active'` on the
 * *member* paths only. The org-admin paths filtered on `ou.status`, the user's
 * membership, and never looked at `o.status`. Deactivating an organisation
 * therefore shut its members out while its administrators carried on working
 * inside it, which is the opposite of what "inactive" is taken to mean.
 */
describe('org-admin access is gated on the organisation status', () => {
  let req: Partial<OrganisationRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 'kc-1' } } as Partial<OrganisationRequest>;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  const rowFor = (orgStatus: string) => ({
    rows: [
      {
        user_id: 'ou-1',
        organization_id: 'org-1',
        enabled_capabilities: ['events'],
        org_status: orgStatus,
      },
    ],
  });

  it('lets an administrator of an active organisation through', async () => {
    mockDb.query.mockResolvedValueOnce(rowFor('active') as never);

    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.organisationId).toBe('org-1');
  });

  it('refuses an administrator of an inactive organisation', async () => {
    mockDb.query.mockResolvedValueOnce(rowFor('inactive') as never);

    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'ORGANISATION_INACTIVE' }),
      })
    );
  });

  /**
   * The check runs on every request, not only at sign-in. Gating the login
   * route alone would leave every administrator already signed in working
   * normally until their token expired — precisely the window that matters when
   * an organisation is deactivated.
   */
  it('refuses on a request made with a token issued while the organisation was active', async () => {
    mockDb.query.mockResolvedValueOnce(rowFor('active') as never);
    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    // The organisation is deactivated; the same token is used again.
    jest.clearAllMocks();
    mockDb.query.mockResolvedValueOnce(rowFor('inactive') as never);
    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('reads the organisation status, not only the membership status', async () => {
    mockDb.query.mockResolvedValueOnce(rowFor('active') as never);
    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

    const sql = String(mockDb.query.mock.calls[0][0]);
    expect(sql).toContain('o.status as org_status');
    // The membership filter stays: both conditions have to hold.
    expect(sql).toContain("ou.status = 'active'");
  });

  it('still refuses a user who is not an org admin at all', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

    await loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    );
  });
});
