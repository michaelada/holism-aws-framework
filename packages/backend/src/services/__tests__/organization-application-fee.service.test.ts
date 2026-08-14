import { organizationApplicationFeeService } from '../organization-application-fee.service';
import { db } from '../../database/pool';
import { ValidationError } from '../../middleware/errors';
import { createMockClient } from '../../test-helpers/mock-db-client';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

const ORG = 'org-1';
const TYPE = 'type-1';

const orgRow = {
  id: ORG,
  organization_type_id: TYPE,
  currency: 'EUR',
  type_name: 'Sailing Club',
};

const feeRow = (over: Record<string, unknown> = {}) => ({
  payment_method_id: 'pm-stripe',
  payment_method_name: 'stripe',
  payment_method_display_name: 'Pay By Card (Stripe)',
  type_fixed: '0.50',
  type_percentage: '2.00',
  org_fixed: '0.25',
  org_percentage: '1.00',
  has_org_row: true,
  ...over,
});

describe('organizationApplicationFeeService.getForOrganisation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null for an organisation that does not exist', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] } as never);
    await expect(organizationApplicationFeeService.getForOrganisation(ORG)).resolves.toBeNull();
  });

  it("uses the organisation's own value and reports the type default alongside", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [orgRow] } as never)
      .mockResolvedValueOnce({ rows: [feeRow()] } as never);

    const result = await organizationApplicationFeeService.getForOrganisation(ORG);

    expect(result!.fees[0]).toMatchObject({
      applicationFeeFixed: 0.25,
      applicationFeePercentage: 1,
      typeDefaultFixed: 0.5,
      typeDefaultPercentage: 2,
      source: 'organisation',
    });
  });

  /**
   * Only reachable when a payment method is added to a type after the
   * organisation was created — every other organisation has a row from
   * copy-on-create or the migration's backfill.
   */
  it("falls back to the type when the organisation has no row for that method", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [orgRow] } as never)
      .mockResolvedValueOnce({
        rows: [feeRow({ has_org_row: false, org_fixed: null, org_percentage: null })],
      } as never);

    const result = await organizationApplicationFeeService.getForOrganisation(ORG);

    expect(result!.fees[0]).toMatchObject({
      applicationFeeFixed: 0.5,
      applicationFeePercentage: 2,
      source: 'type-fallback',
    });
  });

  /**
   * The distinction COALESCE cannot make. An organisation row of NULL/NULL is a
   * deliberate "take the handling fee", and must win over a type that has a
   * split configured — it is not the same as having no row at all.
   */
  it('honours a deliberate unconfigured value on the organisation over the type', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [orgRow] } as never)
      .mockResolvedValueOnce({
        rows: [feeRow({ has_org_row: true, org_fixed: null, org_percentage: null })],
      } as never);

    const result = await organizationApplicationFeeService.getForOrganisation(ORG);

    expect(result!.fees[0]).toMatchObject({
      applicationFeeFixed: null,
      applicationFeePercentage: null,
      typeDefaultFixed: 0.5,
      source: 'organisation',
    });
  });
});

describe('organizationApplicationFeeService.setForOrganisation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a half-set pair before writing anything', async () => {
    const client = createMockClient();
    (mockDb.getClient as jest.Mock).mockResolvedValue(client);

    await expect(
      organizationApplicationFeeService.setForOrganisation(ORG, [
        { paymentMethodId: 'pm-stripe', applicationFeeFixed: 0.25, applicationFeePercentage: '' },
      ])
    ).rejects.toBeInstanceOf(ValidationError);

    // Validation happens before the transaction opens, so nothing was touched.
    expect(mockDb.getClient).not.toHaveBeenCalled();
  });

  it('rejects a negative rate', async () => {
    await expect(
      organizationApplicationFeeService.setForOrganisation(ORG, [
        { paymentMethodId: 'pm-stripe', applicationFeeFixed: -1, applicationFeePercentage: 2 },
      ])
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts a blank pair as "take the handling fee"', async () => {
    const client = createMockClient();
    (mockDb.getClient as jest.Mock).mockResolvedValue(client);
    mockDb.query
      .mockResolvedValueOnce({ rows: [orgRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await organizationApplicationFeeService.setForOrganisation(ORG, [
      { paymentMethodId: 'pm-stripe', applicationFeeFixed: '', applicationFeePercentage: '' },
    ]);

    const insert = client.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('INSERT INTO organization_payment_application_fees')
    );
    expect(insert![1]).toEqual([ORG, 'pm-stripe', null, null]);
  });

  it('rolls back when one method fails, rather than leaving a split save', async () => {
    const client = createMockClient();
    (mockDb.getClient as jest.Mock).mockResolvedValue(client);
    client.query.mockImplementation((sql: string) => {
      if (String(sql).includes('INSERT INTO organization_payment_application_fees')) {
        return Promise.reject(new Error('constraint violation'));
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      organizationApplicationFeeService.setForOrganisation(ORG, [
        { paymentMethodId: 'pm-stripe', applicationFeeFixed: 0.25, applicationFeePercentage: 1 },
      ])
    ).rejects.toThrow('constraint violation');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('organizationApplicationFeeService.copyFromType', () => {
  beforeEach(() => jest.clearAllMocks());

  it('copies every method the type carries, NULLs included', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 2 } as never);

    const copied = await organizationApplicationFeeService.copyFromType(ORG, TYPE);

    expect(copied).toBe(2);
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO organization_payment_application_fees');
    expect(sql).toContain('FROM organization_type_payment_fees');
    expect(params).toEqual([ORG, TYPE]);
  });

  /**
   * A creation-time copy must never overwrite a value someone set deliberately,
   * so the conflict clause is DO NOTHING rather than DO UPDATE.
   */
  it('never overwrites an existing row', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await organizationApplicationFeeService.copyFromType(ORG, TYPE);
    expect(String(mockDb.query.mock.calls[0][0])).toContain('DO NOTHING');
  });
});
