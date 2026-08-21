/**
 * Which of a club's own form fields must never have their answers logged.
 *
 * The failure that matters here is silent: a lookup that matches nothing
 * redacts nothing, and the log fills up with medical notes while every test
 * still passes. So the tests are about matching, and about the cache being
 * wrong in the safe direction only.
 */

jest.mock('../../../config/logger');
jest.mock('../../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../../database/pool';
import { logger } from '../../../config/logger';
import { sensitiveFieldsFor, forgetSensitiveFields } from '../sensitive-fields';

const mockDb = db as jest.Mocked<typeof db>;
const ORG = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  forgetSensitiveFields(undefined); // clears everything
  mockDb.query.mockResolvedValue({ rows: [] } as any);
});

describe('matching an answer to a field', () => {
  it('matches on the field name and on its label', async () => {
    /*
     * A submission's answers are keyed by whichever the form used — the
     * machine name in one place, the question text in another. Matching only
     * one of the two is a redaction that silently does nothing.
     */
    mockDb.query.mockResolvedValue({
      rows: [{ name: 'medicalConditions', label: 'Any medical conditions?' }],
    } as any);

    const fields = await sensitiveFieldsFor(ORG);

    expect(fields.has('medicalConditions')).toBe(true);
    expect(fields.has('Any medical conditions?')).toBe(true);
  });

  it('is empty for an organisation that has marked nothing', async () => {
    expect((await sensitiveFieldsFor(ORG)).size).toBe(0);
  });

  it('is empty, without a query, when there is no organisation', async () => {
    expect((await sensitiveFieldsFor(null)).size).toBe(0);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('asks only for the marked fields', async () => {
    await sensitiveFieldsFor(ORG);

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain('is_sensitive = true');
    expect(params).toEqual([ORG]);
  });
});

describe('the cache', () => {
  it('reads once for repeated lookups', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ name: 'dietary', label: 'Dietary needs' }] } as any);

    await sensitiveFieldsFor(ORG);
    await sensitiveFieldsFor(ORG);
    await sensitiveFieldsFor(ORG);

    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('keeps organisations apart', async () => {
    const OTHER = '22222222-2222-2222-2222-222222222222';

    mockDb.query.mockResolvedValueOnce({ rows: [{ name: 'a', label: 'A' }] } as any);
    mockDb.query.mockResolvedValueOnce({ rows: [{ name: 'b', label: 'B' }] } as any);

    expect((await sensitiveFieldsFor(ORG)).has('a')).toBe(true);
    expect((await sensitiveFieldsFor(OTHER)).has('a')).toBe(false);
  });

  it('re-reads after a field is marked', async () => {
    // The dangerous direction: a field just marked sensitive must stop being
    // logged now, not a minute from now.
    mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
    expect((await sensitiveFieldsFor(ORG)).size).toBe(0);

    mockDb.query.mockResolvedValueOnce({
      rows: [{ name: 'medicalConditions', label: 'Any medical conditions?' }],
    } as any);
    forgetSensitiveFields(ORG);

    expect((await sensitiveFieldsFor(ORG)).has('medicalConditions')).toBe(true);
  });
});

describe('when the marks cannot be read', () => {
  it('says so loudly rather than defaulting quietly', async () => {
    /*
     * Failing closed redacts everything and destroys the trail; failing open
     * logs a medical note. Neither is acceptable as a silent default, so the
     * failure is shouted about.
     */
    mockDb.query.mockRejectedValue(new Error('relation "application_fields" does not exist'));

    const fields = await sensitiveFieldsFor(ORG);

    expect(fields.size).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('sensitive-field'),
      expect.objectContaining({ organisationId: ORG })
    );
  });

  it('does not cache a failure', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('connection reset'));
    await sensitiveFieldsFor(ORG);

    mockDb.query.mockResolvedValueOnce({ rows: [{ name: 'dietary', label: 'Dietary' }] } as any);
    expect((await sensitiveFieldsFor(ORG)).has('dietary')).toBe(true);
  });
});
