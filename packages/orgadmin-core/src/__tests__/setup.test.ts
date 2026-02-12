import { describe, it, expect } from 'vitest';
import { ORGADMIN_CORE_VERSION } from '../index';

describe('orgadmin-core package', () => {
  it('should export version constant', () => {
    expect(ORGADMIN_CORE_VERSION).toBe('1.0.0');
  });

  it('should have correct package structure', () => {
    // This test verifies the package can be imported
    expect(ORGADMIN_CORE_VERSION).toBeDefined();
  });
});
