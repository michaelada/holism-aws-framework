# Property-Based Testing Guide

## Overview

This project uses [fast-check](https://fast-check.dev/) for property-based testing (PBT). Property-based testing is a testing methodology where you define properties (universal truths) that should hold for all inputs, and the testing library generates hundreds of random test cases to verify those properties.

## What is Property-Based Testing?

Unlike traditional example-based testing where you write specific test cases with known inputs and outputs, property-based testing:

1. **Defines Properties**: You specify what should always be true about your code
2. **Generates Inputs**: The library generates random inputs automatically
3. **Finds Edge Cases**: It discovers edge cases you might not have thought of
4. **Shrinks Failures**: When a test fails, it finds the minimal failing case

### Example Comparison

**Example-Based Test:**
```typescript
it('should add two numbers', () => {
  expect(add(2, 3)).toBe(5);
  expect(add(0, 0)).toBe(0);
  expect(add(-1, 1)).toBe(0);
});
```

**Property-Based Test:**
```typescript
it('should be commutative', () => {
  fc.assert(
    fc.property(
      fc.integer(),
      fc.integer(),
      (a, b) => add(a, b) === add(b, a)
    ),
    { numRuns: 100 }
  );
});
```

## Installation

Fast-check is already installed in both frontend and backend packages:

- **Backend**: `packages/backend/package.json` - Uses Jest
- **Frontend**: `packages/orgadmin-shell/package.json` - Uses Vitest

```json
{
  "devDependencies": {
    "fast-check": "^3.15.1"
  }
}
```

## Configuration

### Backend (Jest)

The backend uses Jest as the test runner. Property tests work out of the box:

```typescript
import * as fc from 'fast-check';

describe('My Property Tests', () => {
  it('should verify a property', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        (num) => num + 0 === num
      ),
      { numRuns: 100 }
    );
  });
});
```

### Frontend (Vitest)

The frontend uses Vitest as the test runner. Configuration is in `vite.config.ts`:

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('My Property Tests', () => {
  it('should verify a property', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (str) => str.length >= 0
      ),
      { numRuns: 100 }
    );
  });
});
```

## File Naming Convention

Property-based tests should be in separate files with the `.property.test.ts` or `.property.test.tsx` suffix:

```
src/
  __tests__/
    myFeature.test.ts           # Unit tests
    myFeature.property.test.ts  # Property tests
```

## Common Arbitraries (Generators)

Fast-check provides many built-in generators:

### Primitives
```typescript
fc.boolean()                    // true or false
fc.integer()                    // any integer
fc.integer({ min: 0, max: 100 }) // bounded integer
fc.float()                      // floating point number
fc.string()                     // any string
fc.string({ minLength: 5 })     // string with constraints
fc.char()                       // single character
```

### Collections
```typescript
fc.array(fc.integer())          // array of integers
fc.array(fc.string(), { maxLength: 10 }) // bounded array
fc.set(fc.integer())            // set of unique integers
fc.tuple(fc.string(), fc.integer()) // fixed-size tuple
```

### Objects
```typescript
fc.record({
  name: fc.string(),
  age: fc.integer({ min: 0, max: 120 }),
  active: fc.boolean()
})

fc.object()                     // any object
```

### Specialized
```typescript
fc.uuid()                       // UUID string
fc.emailAddress()               // valid email
fc.webUrl()                     // valid URL
fc.date()                       // Date object
fc.constantFrom('a', 'b', 'c')  // one of specific values
```

### Combinators
```typescript
fc.oneof(fc.string(), fc.integer()) // either string or integer
fc.option(fc.string())          // string or null
fc.array(fc.integer()).map(arr => arr.sort()) // transform generated values
```

## Writing Property Tests

### 1. Identify Properties

Good properties to test:

- **Invariants**: Things that should always be true
  - Array length is always non-negative
  - Sorted array elements are in order
  
- **Idempotence**: Doing something twice = doing it once
  - `trim(trim(str)) === trim(str)`
  - `sort(sort(arr)) === sort(arr)`
  
- **Commutativity**: Order doesn't matter
  - `a + b === b + a`
  - `set.union(a, b) === set.union(b, a)`
  
- **Associativity**: Grouping doesn't matter
  - `(a + b) + c === a + (b + c)`
  
- **Round-trip**: Encode then decode returns original
  - `decode(encode(data)) === data`
  - `JSON.parse(JSON.stringify(obj)) === obj`
  
- **Inverse operations**: One undoes the other
  - `reverse(reverse(arr)) === arr`
  - `encrypt(decrypt(data)) === data`

### 2. Write the Test

```typescript
import * as fc from 'fast-check';

describe('Property: Array Sorting', () => {
  it('should maintain array length', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          return sorted.length === arr.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        (arr) => {
          const sorted1 = [...arr].sort((a, b) => a - b);
          const sorted2 = [...sorted1].sort((a, b) => a - b);
          return JSON.stringify(sorted1) === JSON.stringify(sorted2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 3. Use Preconditions

Sometimes you need to filter inputs:

```typescript
fc.assert(
  fc.property(
    fc.integer(),
    fc.integer(),
    (a, b) => {
      // Only test when a and b are different
      fc.pre(a !== b);
      
      return a < b || a > b;
    }
  ),
  { numRuns: 100 }
);
```

### 4. Async Properties

For testing async code:

```typescript
await fc.assert(
  fc.asyncProperty(
    fc.string(),
    async (userId) => {
      const user = await fetchUser(userId);
      return user.id === userId;
    }
  ),
  { numRuns: 100 }
);
```

## Configuration Options

```typescript
fc.assert(
  fc.property(/* ... */),
  {
    numRuns: 100,        // Number of test cases to generate (default: 100)
    seed: 42,            // Seed for reproducibility
    path: "0:1:2",       // Replay a specific failing case
    verbose: true,       // Show all test cases
    timeout: 5000,       // Timeout per test case (ms)
  }
);
```

## Best Practices

### 1. Start Simple

Begin with simple properties and gradually add complexity:

```typescript
// Simple: Check basic invariant
it('should never return negative length', () => {
  fc.assert(
    fc.property(fc.array(fc.anything()), (arr) => arr.length >= 0)
  );
});

// Complex: Check business logic
it('should maintain user data isolation', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ userId: fc.uuid(), data: fc.anything() })),
      (users) => {
        // Complex property checking isolation
      }
    )
  );
});
```

### 2. Use Descriptive Test Names

```typescript
// Bad
it('test 1', () => { /* ... */ });

// Good
it('should maintain data integrity when storing and retrieving preferences', () => {
  /* ... */
});
```

### 3. Document Properties

Add comments explaining what property you're testing:

```typescript
/**
 * Property: User Data Isolation
 * 
 * For any authenticated user, when retrieving preferences, the system
 * should return only that user's data and never expose another user's data.
 * 
 * Validates: Requirements 9.4
 */
it('should only return preferences for the requested user', () => {
  // Test implementation
});
```

### 4. Use Appropriate numRuns

- **Quick feedback**: 10-50 runs
- **Standard testing**: 100 runs (default)
- **Thorough testing**: 1000+ runs
- **CI/CD**: Consider lower runs for speed

### 5. Combine with Unit Tests

Property tests complement, not replace, unit tests:

```typescript
// Unit test: Specific example
it('should add 2 + 3 = 5', () => {
  expect(add(2, 3)).toBe(5);
});

// Property test: Universal truth
it('should be commutative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => 
      add(a, b) === add(b, a)
    )
  );
});
```

## Debugging Failed Properties

When a property test fails, fast-check provides:

1. **The failing input**: The specific values that caused the failure
2. **Shrunk input**: The minimal failing case
3. **Seed and path**: To reproduce the failure

Example failure output:
```
Property failed after 23 tests
{ seed: 1234567890, path: "22:0:1", endOnFailure: true }
Counterexample: [42, -17]
Shrunk 3 time(s)
Got error: Expected true but got false
```

To reproduce:
```typescript
fc.assert(
  fc.property(/* ... */),
  { seed: 1234567890, path: "22:0:1" }
);
```

## Examples from This Project

### Backend: User Data Isolation

```typescript
it('should only return preferences for the requested user', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.record({
        welcomeDismissed: fc.boolean(),
        modulesVisited: fc.array(
          fc.constantFrom('dashboard', 'users', 'forms', 'events', 
                         'memberships', 'calendar', 'payments'),
          { maxLength: 7 }
        )
      }),
      async (userId, preferences) => {
        mockPool.query.mockResolvedValue({
          rows: [{
            welcome_dismissed: preferences.welcomeDismissed,
            modules_visited: preferences.modulesVisited
          }]
        });

        const result = await userPreferencesService.getOnboardingPreferences(userId);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE user_id = $1'),
          [userId]
        );

        return result.welcomeDismissed === preferences.welcomeDismissed;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Frontend: Dismissed Dialogs

```typescript
it('should keep welcome dialog dismissed across application reloads', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(moduleIdArbitrary, { maxLength: 7 }),
      async (initialModulesVisited) => {
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              welcomeDismissed: true,
              modulesVisited: initialModulesVisited,
            },
          },
        });

        const { getByTestId } = render(
          <OnboardingProvider>
            <TestComponent />
          </OnboardingProvider>
        );

        await waitFor(() => {
          expect(getByTestId('loading').textContent).toBe('loaded');
        });

        return getByTestId('welcome-open').textContent === 'closed';
      }
    ),
    { numRuns: 100 }
  );
});
```

## Running Property Tests

### Run all tests (including property tests)
```bash
# Backend
npm run test --workspace=packages/backend

# Frontend
npm run test --workspace=packages/orgadmin-shell
```

### Run only property tests
```bash
# Backend
npm run test --workspace=packages/backend -- property.test.ts

# Frontend
npm run test --workspace=packages/orgadmin-shell -- property.test.ts
```

### Run specific property test file
```bash
# Backend
npm run test --workspace=packages/backend -- user-preferences.property.test.ts

# Frontend
npm run test --workspace=packages/orgadmin-shell -- OnboardingProvider.property.test.tsx
```

### Run with coverage
```bash
# Backend
npm run test:coverage --workspace=packages/backend

# Frontend
npm run test:coverage --workspace=packages/orgadmin-shell
```

## Resources

- [Fast-check Documentation](https://fast-check.dev/)
- [Fast-check GitHub](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Introduction](https://fast-check.dev/docs/introduction/)
- [Arbitraries Reference](https://fast-check.dev/docs/core-blocks/arbitraries/)

## Verification

To verify the setup is working correctly, run the verification tests:

```bash
# Frontend
npm run test --workspace=packages/orgadmin-shell -- setup-verification.property.test.ts

# Backend
npm run test --workspace=packages/backend -- setup-verification.property.test.ts
```

Both test suites should pass with 7 tests each, verifying:
- Basic property testing
- String generators
- Array generators
- Boolean generators
- Record generators
- Async properties
- Custom arbitraries
