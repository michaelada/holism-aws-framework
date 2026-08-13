/* eslint-disable camelcase */

/**
 * Per-line fulfilment tracking on `payment_transactions`.
 *
 * Marking the *payment* paid is not the same as having created the entry or
 * membership it paid for. Those are separate writes that can fail
 * independently — a full activity, a missing form submission — and a webhook
 * retry has to be able to finish the job without redoing the parts that
 * already succeeded.
 *
 * So fulfilment state lives on the line, not the payment:
 *
 *   - `fulfilled_at` is the idempotency guard. A line with a timestamp is never
 *     fulfilled again, so a retry cannot issue a second entry.
 *   - `fulfilment_ref` points at what was created, which is what lets a refund
 *     later find the row it needs to undo.
 *   - `fulfilment_error` records why a line could not be fulfilled, so an order
 *     that is paid but incomplete is visible rather than silently short.
 *
 * A single `fulfilled` boolean on the payment would lose all of that: one
 * failed line would either block the whole order or be forgotten.
 */

exports.up = (pgm) => {
  pgm.addColumns('payment_transactions', {
    fulfilled_at: {
      type: 'timestamp',
    },
    /** The `event_entries.id` / `members.id` this line produced. */
    fulfilment_ref: {
      type: 'uuid',
    },
    /**
     * Why this line could not be fulfilled.
     *
     * Kept rather than thrown away: a paid order with an unfulfilled line needs
     * a human to look at it, and "which order and why" is the whole question.
     */
    fulfilment_error: {
      type: 'text',
    },
  });

  /*
   * Finds the outstanding work for a payment. Partial, because the rows that
   * matter are the unfulfilled ones and they are a shrinking minority.
   */
  pgm.createIndex('payment_transactions', ['payment_id'], {
    name: 'payment_transactions_unfulfilled_index',
    where: 'fulfilled_at IS NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('payment_transactions', ['payment_id'], {
    name: 'payment_transactions_unfulfilled_index',
  });
  pgm.dropColumns('payment_transactions', [
    'fulfilled_at',
    'fulfilment_ref',
    'fulfilment_error',
  ]);
};
