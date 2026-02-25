# Property-Based Testing Quick Reference

## Basic Template

```typescript
import * as fc from 'fast-check';

describe('Feature Name', () => {
  it('should verify property description', () => {
    fc.assert(
      fc.property(
        fc.integer(),  // Generator 1
        fc.string(),   // Generator 2
        (num, str) => {
          // Your property test logic
          return true; // or false
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Async Template

```typescript
await fc.assert(
  fc.asyncProperty(
    fc.uuid(),
    async (id) => {
      const result = await someAsyncFunction(id);
      return result.id === id;
    }
  ),
  { numRuns: 100 }
);
```

## Common Generators

| Generator | Description | Example |
|-----------|-------------|---------|
| `fc.boolean()` | true or false | `true`, `false` |
| `fc.integer()` | Any integer | `-42`, `0`, `1000` |
| `fc.integer({ min: 0, max: 100 })` | Bounded integer | `0`, `50`, `100` |
| `fc.float()` | Floating point | `3.14`, `-0.5` |
| `fc.string()` | Any string | `""`, `"abc"`, `"🎉"` |
| `fc.string({ minLength: 5 })` | String with min length | `"hello"`, `"world"` |
| `fc.uuid()` | UUID string | `"550e8400-e29b-41d4-a716-446655440000"` |
| `fc.emailAddress()` | Valid email | `"user@example.com"` |
| `fc.array(fc.integer())` | Array of integers | `[]`, `[1, 2, 3]` |
| `fc.array(fc.string(), { maxLength: 5 })` | Bounded array | `["a", "b"]` |
| `fc.constantFrom('a', 'b', 'c')` | One of values | `"a"`, `"b"`, or `"c"` |
| `fc.record({ name: fc.string(), age: fc.integer() })` | Object | `{ name: "Alice", age: 30 }` |
| `fc.oneof(fc.string(), fc.integer())` | Union type | `"hello"` or `42` |
| `fc.option(fc.string())` | Optional value | `"hello"` or `null` |

## Common Properties to Test

### 1. Invariants
```typescript
// Array length is always non-negative
fc.property(fc.array(fc.anything()), (arr) => arr.length >= 0)
```

### 2. Idempotence
```typescript
// Doing twice = doing once
fc.property(fc.string(), (str) => str.trim() === str.trim().trim())
```

### 3. Commutativity
```typescript
// Order doesn't matter
fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a)
```

### 4. Associativity
```typescript
// Grouping doesn't matter
fc.property(
  fc.integer(), fc.integer(), fc.integer(),
  (a, b, c) => (a + b) + c === a + (b + c)
)
```

### 5. Round-trip
```typescript
// Encode then decode returns original
fc.property(fc.anything(), (data) => 
  JSON.parse(JSON.stringify(data)) === data
)
```

### 6. Inverse Operations
```typescript
// One undoes the other
fc.property(fc.array(fc.integer()), (arr) => {
  const reversed = arr.reverse();
  const doubleReversed = reversed.reverse();
  return JSON.stringify(arr) === JSON.stringify(doubleReversed);
})
```

## Preconditions

Use `fc.pre()` to filter inputs:

```typescript
fc.property(
  fc.integer(),
  fc.integer(),
  (a, b) => {
    fc.pre(a !== b);  // Only test when a and b are different
    return a < b || a > b;
  }
)
```

## Configuration Options

```typescript
fc.assert(
  fc.property(/* ... */),
  {
    numRuns: 100,        // Number of test cases (default: 100)
    seed: 42,            // Seed for reproducibility
    path: "0:1:2",       // Replay specific failing case
    verbose: true,       // Show all test cases
    timeout: 5000,       // Timeout per test (ms)
  }
);
```

## Custom Generators

### Module ID Generator
```typescript
const moduleIdArbitrary = fc.constantFrom(
  'dashboard', 'users', 'forms', 'events', 
  'memberships', 'calendar', 'payments'
);
```

### User Object Generator
```typescript
const userArbitrary = fc.record({
  userId: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  active: fc.boolean(),
  createdAt: fc.date()
});
```

### Preferences Generator
```typescript
const preferencesArbitrary = fc.record({
  welcomeDismissed: fc.boolean(),
  modulesVisited: fc.array(
    fc.constantFrom('dashboard', 'users', 'forms', 'events', 
                   'memberships', 'calendar', 'payments'),
    { maxLength: 7 }
  )
});
```

## Running Tests

```bash
# Run all tests
npm run test --workspace=packages/backend
npm run test --workspace=packages/orgadmin-shell

# Run only property tests
npm run test --workspace=packages/backend -- property.test.ts
npm run test --workspace=packages/orgadmin-shell -- property.test.ts

# Run specific file
npm run test --workspace=packages/backend -- user-preferences.property.test.ts

# Run with coverage
npm run test:coverage --workspace=packages/backend
```

## Debugging Failures

When a test fails, you'll see:

```
Property failed after 23 tests
{ seed: 1234567890, path: "22:0:1", endOnFailure: true }
Counterexample: [42, -17]
Shrunk 3 time(s)
```

To reproduce:
```typescript
fc.assert(
  fc.property(/* ... */),
  { seed: 1234567890, path: "22:0:1" }
);
```

## Common Patterns

### Testing API Calls
```typescript
await fc.assert(
  fc.asyncProperty(
    fc.uuid(),
    async (userId) => {
      mockAxios.get.mockResolvedValue({ data: { id: userId } });
      const result = await api.getUser(userId);
      return result.id === userId;
    }
  )
);
```

### Testing React Components
```typescript
await fc.assert(
  fc.asyncProperty(
    fc.boolean(),
    async (isOpen) => {
      const { getByTestId } = render(<Dialog open={isOpen} />);
      const dialog = getByTestId('dialog');
      return isOpen ? dialog.style.display !== 'none' : true;
    }
  )
);
```

### Testing Data Transformations
```typescript
fc.assert(
  fc.property(
    fc.array(fc.integer()),
    (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      // Property: sorted array has same length
      return sorted.length === arr.length;
    }
  )
);
```

## Tips

1. **Start simple**: Begin with basic properties
2. **Use descriptive names**: Explain what property you're testing
3. **Document properties**: Add comments explaining the property
4. **Combine with unit tests**: Property tests complement, not replace
5. **Use appropriate numRuns**: 100 is usually good, 1000+ for thorough testing
6. **Test edge cases explicitly**: Property tests find unexpected edges, but test known edges too

## File Naming

```
src/
  __tests__/
    feature.test.ts           # Unit tests
    feature.property.test.ts  # Property tests
```

## Verification

Run verification tests to ensure setup is working:

```bash
npm run test --workspace=packages/orgadmin-shell -- setup-verification.property.test.ts
npm run test --workspace=packages/backend -- setup-verification.property.test.ts
```

## Resources

- [Full Guide](./PROPERTY_BASED_TESTING_GUIDE.md)
- [Fast-check Docs](https://fast-check.dev/)
- [Arbitraries Reference](https://fast-check.dev/docs/core-blocks/arbitraries/)
