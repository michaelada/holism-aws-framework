import * as fc from 'fast-check';
import { logQueryPerformance, QUERY_PERFORMANCE_THRESHOLD, logger } from '../logger';

/**
 * Feature: aws-web-app-framework, Property 28: Query Performance Logging
 * 
 * For any database query that exceeds a performance threshold (e.g., 1000ms),
 * the Framework should log the query with optimization suggestions.
 * 
 * Validates: Requirements 20.5
 */

// Mock logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    colorize: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    errors: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

describe('Property 28: Query Performance Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queries exceeding threshold are logged with warning level and optimization suggestions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }), // SQL query
        fc.integer({ min: QUERY_PERFORMANCE_THRESHOLD + 1, max: 10000 }), // Duration above threshold
        fc.option(fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { maxLength: 10 })), // Query params
        (query, duration, params) => {
          // Clear mocks before each property test run
          (logger.warn as jest.Mock).mockClear();
          (logger.debug as jest.Mock).mockClear();

          logQueryPerformance(query, duration, params || undefined);

          // Verify warning was logged
          expect(logger.warn).toHaveBeenCalled();
          const warnCall = (logger.warn as jest.Mock).mock.calls[0];

          // Should log as slow query
          expect(warnCall[0]).toBe('Slow query detected');

          // Should include query details
          expect(warnCall[1]).toHaveProperty('query');
          expect(typeof warnCall[1].query).toBe('string');
          expect(warnCall[1]).toHaveProperty('duration', `${duration}ms`);
          expect(warnCall[1]).toHaveProperty('threshold', `${QUERY_PERFORMANCE_THRESHOLD}ms`);

          // Should include optimization suggestion
          expect(warnCall[1]).toHaveProperty('suggestion');
          expect(warnCall[1].suggestion).toContain('index');
          expect(warnCall[1].suggestion).toContain('optimiz');

          // Should include params if provided
          if (params) {
            expect(warnCall[1]).toHaveProperty('params');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('queries below threshold are logged with debug level without warnings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }), // SQL query
        fc.integer({ min: 1, max: QUERY_PERFORMANCE_THRESHOLD - 1 }), // Duration below threshold
        fc.option(fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { maxLength: 10 })), // Query params
        (query, duration, params) => {
          // Clear mocks before each property test run
          (logger.warn as jest.Mock).mockClear();
          (logger.debug as jest.Mock).mockClear();

          logQueryPerformance(query, duration, params || undefined);

          // Should not log warning
          expect(logger.warn).not.toHaveBeenCalled();

          // Should log debug
          expect(logger.debug).toHaveBeenCalled();
          const debugCall = (logger.debug as jest.Mock).mock.calls[0];

          expect(debugCall[0]).toBe('Query executed');
          expect(debugCall[1]).toHaveProperty('query');
          expect(typeof debugCall[1].query).toBe('string');
          expect(debugCall[1]).toHaveProperty('duration', `${duration}ms`);

          // Should not include optimization suggestion for fast queries
          expect(debugCall[1]).not.toHaveProperty('suggestion');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('queries at exact threshold are logged with warning', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (query) => {
          // Clear mocks before each property test run
          (logger.warn as jest.Mock).mockClear();
          (logger.debug as jest.Mock).mockClear();

          logQueryPerformance(query, QUERY_PERFORMANCE_THRESHOLD);

          // At threshold should trigger warning
          expect(logger.warn).toHaveBeenCalled();
          const warnCall = (logger.warn as jest.Mock).mock.calls[0];

          expect(warnCall[0]).toBe('Slow query detected');
          expect(warnCall[1]).toHaveProperty('query');
          expect(typeof warnCall[1].query).toBe('string');
          expect(warnCall[1]).toHaveProperty('duration', `${QUERY_PERFORMANCE_THRESHOLD}ms`);
          expect(warnCall[1]).toHaveProperty('suggestion');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('all queries include duration in milliseconds format', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.integer({ min: 1, max: 10000 }),
        (query, duration) => {
          // Clear mocks before each property test run
          (logger.warn as jest.Mock).mockClear();
          (logger.debug as jest.Mock).mockClear();

          logQueryPerformance(query, duration);

          // Either warn or debug should be called
          const logCalls = [
            ...(logger.warn as jest.Mock).mock.calls,
            ...(logger.debug as jest.Mock).mock.calls
          ];

          expect(logCalls.length).toBeGreaterThan(0);

          // Get the most recent call
          const relevantCall = logCalls[logCalls.length - 1];
          expect(relevantCall).toBeDefined();

          // Duration should be formatted with 'ms' suffix
          expect(relevantCall[1].duration).toBe(`${duration}ms`);
          expect(typeof relevantCall[1].duration).toBe('string');
          expect(relevantCall[1].duration).toMatch(/^\d+ms$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
