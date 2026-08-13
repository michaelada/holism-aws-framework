import { validateRates } from '../organization-type-payment-fee.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('validateRates', () => {
  const valid = { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 23 };

  it('accepts a complete set of rates', () => {
    expect(validateRates(valid)).toEqual(valid);
  });

  it('accepts a tax percentage of exactly zero', () => {
    // Zero is how an organisation type says "no tax element", so it must not
    // be treated as a missing value.
    expect(validateRates({ ...valid, taxPercentage: 0 }).taxPercentage).toBe(0);
  });

  it('accepts zero for every rate', () => {
    expect(validateRates({ fixedFee: 0, percentageFee: 0, taxPercentage: 0 }))
      .toEqual({ fixedFee: 0, percentageFee: 0, taxPercentage: 0 });
  });

  it('coerces numeric strings, which is how form values arrive', () => {
    expect(validateRates({ fixedFee: '0.25', percentageFee: '1.5', taxPercentage: '0' }))
      .toEqual(valid && { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 });
  });

  it('rejects a missing rate', () => {
    expect(() => validateRates({ percentageFee: 1.5, taxPercentage: 0 }))
      .toThrow(/fixedFee is required/);
    expect(() => validateRates({ ...valid, taxPercentage: undefined }))
      .toThrow(/taxPercentage is required/);
  });

  it('rejects a cleared form field', () => {
    expect(() => validateRates({ ...valid, fixedFee: '' }))
      .toThrow(/fixedFee is required/);
  });

  it('rejects values that are not numbers', () => {
    expect(() => validateRates({ ...valid, percentageFee: 'one and a half' }))
      .toThrow(/must be a number/);
  });

  it('rejects negative rates', () => {
    expect(() => validateRates({ ...valid, fixedFee: -1 })).toThrow(/cannot be negative/);
    expect(() => validateRates({ ...valid, percentageFee: -0.1 }))
      .toThrow(/cannot be negative/);
  });

  it('rejects percentages above 100 but allows any positive fixed amount', () => {
    expect(() => validateRates({ ...valid, percentageFee: 101 })).toThrow(/exceed 100/);
    expect(() => validateRates({ ...valid, taxPercentage: 101 })).toThrow(/exceed 100/);
    expect(validateRates({ ...valid, fixedFee: 500 }).fixedFee).toBe(500);
  });

  it('ignores unrelated keys rather than storing them', () => {
    expect(validateRates({ ...valid, somethingElse: 'x' } as any)).toEqual(valid);
  });
});
