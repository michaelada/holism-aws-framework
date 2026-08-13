import { Response } from 'express';
import {
  resolveAccountOrganisation,
  requireAccountCapability,
  AccountRequest,
} from '../account-auth.middleware';
import { accountOrganisationService } from '../../services/account-organisation.service';

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: { resolveMembership: jest.fn() },
}));
jest.mock('../../config/logger');

const mockResolve = accountOrganisationService.resolveMembership as jest.Mock;

const membership = {
  organisationId: 'org-1',
  organisationUserId: 'ou-1',
  urlCode: 'khpc',
  displayName: 'Kildare Hunt Pony Club',
  currency: 'EUR',
  language: 'en-GB',
  capabilities: ['memberships'],
  status: 'active',
};

const makeRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response & { status: jest.Mock; json: jest.Mock };
};

const makeReq = (over: Partial<AccountRequest> = {}): AccountRequest =>
  ({
    user: { userId: 'kc-1', email: 'm@example.com', username: 'm', roles: [], groups: [] },
    params: { orgCode: 'khpc' },
    ...over,
  } as AccountRequest);

describe('resolveAccountOrganisation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches the membership and continues for an active member', async () => {
    mockResolve.mockResolvedValue({ ok: true, membership });
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await resolveAccountOrganisation()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.account).toEqual(membership);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('resolves using the code from the path and the id from the token', async () => {
    mockResolve.mockResolvedValue({ ok: true, membership });
    await resolveAccountOrganisation()(makeReq(), makeRes(), jest.fn());

    expect(mockResolve).toHaveBeenCalledWith('kc-1', 'khpc');
  });

  it('rejects an unauthenticated request before touching the database', async () => {
    const res = makeRes();
    const next = jest.fn();

    await resolveAccountOrganisation()(makeReq({ user: undefined }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('rejects a request with no organisation in the path', async () => {
    const res = makeRes();
    await resolveAccountOrganisation()(makeReq({ params: {} as any }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('can read the code from a differently named parameter', async () => {
    mockResolve.mockResolvedValue({ ok: true, membership });
    await resolveAccountOrganisation('organisation')(
      makeReq({ params: { organisation: 'bdtc' } as any }),
      makeRes(),
      jest.fn()
    );

    expect(mockResolve).toHaveBeenCalledWith('kc-1', 'bdtc');
  });

  describe('refusals', () => {
    // The account application shows a different screen for each of these, so
    // the code has to survive to the client rather than collapsing to a 403.
    const cases: Array<[string, number]> = [
      ['NOT_CONNECTED', 403],
      ['PENDING_APPROVAL', 403],
      ['REGISTRATION_REJECTED', 403],
      ['ACCOUNT_INACTIVE', 403],
      ['ORGANISATION_UNAVAILABLE', 404],
    ];

    it.each(cases)('returns %s as HTTP %i with a machine-readable code', async (reason, status) => {
      mockResolve.mockResolvedValue({ ok: false, reason });
      const res = makeRes();
      const next = jest.fn();

      await resolveAccountOrganisation()(makeReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: reason, urlCode: 'khpc' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('never attaches an account on refusal', async () => {
      mockResolve.mockResolvedValue({ ok: false, reason: 'NOT_CONNECTED' });
      const req = makeReq();

      await resolveAccountOrganisation()(req, makeRes(), jest.fn());

      expect(req.account).toBeUndefined();
    });

    it('gives every refusal a human-readable message', async () => {
      for (const [reason] of cases) {
        jest.clearAllMocks();
        mockResolve.mockResolvedValue({ ok: false, reason });
        const res = makeRes();
        await resolveAccountOrganisation()(makeReq(), res, jest.fn());

        const payload = res.json.mock.calls[0][0];
        expect(typeof payload.error.message).toBe('string');
        expect(payload.error.message.length).toBeGreaterThan(0);
      }
    });
  });

  it('fails closed when membership resolution throws', async () => {
    mockResolve.mockRejectedValue(new Error('database down'));
    const res = makeRes();
    const next = jest.fn();

    await resolveAccountOrganisation()(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAccountCapability', () => {
  const withCapabilities = (capabilities: string[]) =>
    makeReq({ account: { ...membership, capabilities } });

  it('allows a request when the organisation has the capability', () => {
    const next = jest.fn();
    const res = makeRes();

    requireAccountCapability('memberships')(withCapabilities(['memberships']), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('refuses when the capability is not enabled', () => {
    const res = makeRes();
    const next = jest.fn();

    requireAccountCapability('merchandise')(withCapabilities(['memberships']), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CAPABILITY_NOT_ENABLED' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('treats a list as "any of these is enough"', () => {
    // My Entries & Bookings is reachable with either events or bookings.
    const next = jest.fn();
    requireAccountCapability(['event-management', 'calendar-bookings'])(
      withCapabilities(['calendar-bookings']),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('refuses when none of the listed capabilities is enabled', () => {
    const res = makeRes();
    requireAccountCapability(['event-management', 'calendar-bookings'])(
      withCapabilities(['memberships']),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('fails closed when the organisation was never resolved', () => {
    // A misordered route is a programming error, and must not read as access.
    const res = makeRes();
    const next = jest.fn();

    requireAccountCapability('memberships')(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses when the organisation has no capabilities at all', () => {
    const res = makeRes();
    requireAccountCapability('memberships')(withCapabilities([]), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
