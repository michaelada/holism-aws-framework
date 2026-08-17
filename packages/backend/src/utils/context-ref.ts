/**
 * `context_ref` as an object, whatever the driver handed back.
 *
 * node-pg parses jsonb, but a row written before the column existed has null,
 * and a hand-repaired row can hold a string. An unreadable context is an empty
 * one — the caller then fails with "no options recorded", which says what is
 * wrong, rather than a TypeError that does not.
 *
 * Lives here rather than beside one of its callers because both fulfilment and
 * the capture-time availability check read the same column, and two copies of
 * this would eventually disagree about what an unreadable value means.
 */
export const parseContextRef = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};
