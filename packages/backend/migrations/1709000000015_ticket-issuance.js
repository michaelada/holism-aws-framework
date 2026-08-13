/* eslint-disable camelcase */

/**
 * Make electronic tickets issuable by the server.
 *
 * `electronic_tickets` has existed since 1707000000010, but nothing ever wrote
 * to it — tickets were only ever built client-side for preview. Members now get
 * a ticket automatically when their event entry is confirmed
 * (`fulfilment.service.ts`), which needs two things the table did not have.
 *
 * **1. A sequence for `ticket_reference`.**
 * The reference format is `TKT-YYYY-NNNNNN` (see `ticketGeneration.ts`), and
 * the column is UNIQUE. Deriving the number from a count of existing rows races
 * under concurrent fulfilment — two payments confirmed in the same instant read
 * the same count and one insert dies on the unique index. A sequence is the one
 * source of numbers that cannot hand out the same value twice.
 *
 * It is not reset per year. A reference only has to be unique and readable, and
 * a January rollover that reuses numbers from last year is a worse property
 * than numbers that simply keep climbing.
 *
 * **2. One ticket per entry.**
 * Fulfilment is driven by Stripe webhooks, and Stripe will resend an event it
 * has already sent. Without a unique key, a replayed `payment_intent.succeeded`
 * issues a second ticket for the same entry: the member holds two QR codes that
 * both scan valid, and the gate has no way to tell which one it already let in.
 * The constraint makes issuance idempotent — the retry conflicts and is
 * ignored, rather than duplicating.
 *
 * This encodes "an entry has at most one ticket", which is true today because
 * fulfilment creates entries with `quantity` 1. If entries for a party of four
 * ever issue four tickets, this constraint is the thing to revisit — it is the
 * only place that assumption is written down.
 *
 * Safe to apply: no rows exist, because nothing has ever inserted one.
 */

exports.up = (pgm) => {
  pgm.createSequence('electronic_ticket_reference_seq', {
    ifNotExists: true,
    start: 1,
  });

  pgm.addConstraint('electronic_tickets', 'electronic_tickets_entry_unique', {
    unique: ['event_entry_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('electronic_tickets', 'electronic_tickets_entry_unique');
  pgm.dropSequence('electronic_ticket_reference_seq', { ifExists: true });
};
