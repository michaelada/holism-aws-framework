/**
 * What never reaches the audit table, and what a change record looks like.
 *
 * An audit log is a copy of your data with none of the access control that
 * protects the original, kept for years, read by administrators who may have no
 * business reason to see any particular field. The bar for writing something
 * down here is therefore higher than the bar for storing it in the first place.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.5.
 */

import {
  diff,
  created,
  deleted,
  redactObject,
  isNeverLogged,
  buildSearchText,
  REDACTED,
} from '../audit.redaction';

describe('credentials are never written down', () => {
  it('catches the spellings a password actually arrives under', () => {
    /*
     * Matched as a substring rather than by exact name: these turn up as
     * `password`, `newPassword`, `password_confirm`, `currentPassword`, and a
     * list of exact names is a list somebody has to keep complete.
     */
    for (const field of [
      'password',
      'newPassword',
      'current_password',
      'passwordConfirm',
      'PASSWORD',
    ]) {
      expect(isNeverLogged(field)).toBe(true);
    }
  });

  it('catches tokens, secrets, card and bank details', () => {
    for (const field of [
      'accessToken',
      'client_secret',
      'apiKey',
      'cardNumber',
      'cvv',
      'iban',
      'sortCode',
      'accountNumber',
      'stripePrivateKey',
    ]) {
      expect(isNeverLogged(field)).toBe(true);
    }
  });

  it('leaves ordinary fields alone', () => {
    // Greedy matching earns its keep only if it does not eat the log.
    for (const field of ['name', 'fee', 'email', 'entriesLimit', 'displayName']) {
      expect(isNeverLogged(field)).toBe(false);
    }
  });

  it('redacts the value but keeps the field', () => {
    /*
     * "This changed and we are not showing you to what" is information. A
     * missing key would read as "this field was not touched".
     */
    const result = redactObject({ email: 'a@b.test', password: 'hunter2' });

    expect(result).toEqual({ email: 'a@b.test', password: REDACTED });
  });
});

describe('fields a form marked sensitive', () => {
  it('records that they were answered without copying the answer', () => {
    /*
     * The seeded entry form asks for medical notes and an emergency contact.
     * Copying those here would create a second store of special-category data
     * with a different audience and a different retention. Option (c): present
     * but hidden.
     */
    const result = redactObject(
      { riderName: 'Saoirse Brennan', medicalNotes: 'asthma inhaler', ageGroup: 'Under 14' },
      new Set(['medicalNotes'])
    );

    expect(result).toEqual({
      riderName: 'Saoirse Brennan',
      medicalNotes: REDACTED,
      ageGroup: 'Under 14',
    });
  });

  it('hides both sides of a change to a sensitive field', () => {
    const result = diff(
      { medicalNotes: 'old' },
      { medicalNotes: 'new' },
      { sensitiveFields: new Set(['medicalNotes']) }
    );

    expect(result.medicalNotes).toEqual({ from: REDACTED, to: REDACTED });
  });
});

describe('what changed', () => {
  it('reports only the fields that differ', () => {
    // A one-field edit should produce a one-field record, not a wall of
    // identical values a reader has to diff by eye.
    const result = diff(
      { name: 'Grade 1', fee: 2500, limit: 40 },
      { name: 'Grade 1', fee: 3000, limit: 40 }
    );

    expect(result).toEqual({ fee: { from: 2500, to: 3000 } });
  });

  it('treats null and absent as the same thing', () => {
    // A column that goes from SQL NULL to an absent key is not a change.
    expect(diff({ note: null }, {})).toEqual({});
  });

  it('records a field being set for the first time', () => {
    expect(diff({}, { limit: 40 })).toEqual({ limit: { from: null, to: 40 } });
  });

  it('ignores the timestamps that change on every write', () => {
    // Left in, every diff would carry a row of noise that means nothing.
    const result = diff(
      { fee: 2500, updated_at: '2026-01-01' },
      { fee: 2500, updated_at: '2026-08-21' }
    );

    expect(result).toEqual({});
  });

  it('compares nested values by shape, not by identity', () => {
    expect(diff({ links: [{ a: 1 }] }, { links: [{ a: 1 }] })).toEqual({});
    expect(diff({ links: [{ a: 1 }] }, { links: [{ a: 2 }] })).toHaveProperty('links');
  });

  it('keeps the whole row for a create and a delete', () => {
    // For those two the whole row *is* the point: there is no "before" to diff
    // against, and a delete record with only the id answers nothing.
    expect(created({ name: 'Grade 1', fee: 2500 })).toEqual({
      created: { name: 'Grade 1', fee: 2500 },
    });
    expect(deleted({ name: 'Grade 1', fee: 2500 })).toEqual({
      deleted: { name: 'Grade 1', fee: 2500 },
    });
  });

  it('redacts inside a create and a delete too', () => {
    expect(created({ email: 'a@b.test', password: 'x' })).toEqual({
      created: { email: 'a@b.test', password: REDACTED },
    });
  });
});

describe('the searchable text', () => {
  it('gathers the actor, the thing and the values that changed', () => {
    const text = buildSearchText({
      actorDisplay: 'Aoife Byrne',
      actorEmail: 'admin@kildarehunt.test',
      action: 'membership.created',
      entityType: 'membership',
      entityLabel: 'Senior Member',
      changes: { created: { membershipNumber: 'KHP-0241' } },
    });

    expect(text).toContain('Aoife Byrne');
    expect(text).toContain('KHP-0241');
    expect(text).toContain('Senior Member');
  });

  it('cannot be used to find a redacted value', () => {
    /*
     * The values arrive already redacted, so a password is not searchable —
     * which matters, because the free-text index is the one thing that reads
     * every value in the table.
     */
    const text = buildSearchText({
      action: 'auth.password-changed',
      changes: created({ password: 'hunter2' }),
    });

    expect(text).not.toContain('hunter2');
    expect(text).toContain(REDACTED);
  });

  it('leaves out long blobs that would bloat the index', () => {
    // A rich-text body or a data URI makes nothing findable that a shorter
    // value would not, and the trigram index pays for every character.
    const text = buildSearchText({ action: 'post.created', changes: { body: 'x'.repeat(500) } });

    expect(text).not.toContain('x'.repeat(500));
  });
});
