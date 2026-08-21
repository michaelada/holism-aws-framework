/* eslint-disable camelcase */

/**
 * Marking a form field as sensitive.
 *
 * The audit trail records the answers somebody gave on a form, because "what
 * did they actually submit" is the question an entry dispute turns on. But a
 * club designing its own form can ask for anything — a medical condition, a
 * child's date of birth, a dietary requirement — and those answers should not
 * be sitting in a log that a super admin can free-text search.
 *
 * The redaction list in audit.redaction.ts catches the fields we can name in
 * advance: password, token, card number. It cannot catch a field a club invents
 * and calls "Any medical conditions we should know about?".
 *
 * So the club says. A field marked sensitive is recorded as **present but
 * hidden**: the trail still shows that the question was answered and when,
 * which is what an audit needs, and the answer itself never leaves the form.
 *
 * Defaults to false, so nothing changes for existing fields — a club that has
 * not thought about this gets today's behaviour, and opting a field in is a
 * deliberate act.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §4.
 */

exports.up = (pgm) => {
  pgm.addColumn('application_fields', {
    is_sensitive: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment:
        'Answers to this field are recorded in the audit trail as present-but-hidden, never as values.',
    },
  });

  /*
   * Partial, because the interesting set is tiny and the query that uses it
   * only ever asks for the sensitive ones. A full index on a boolean that is
   * false almost everywhere earns nothing.
   */
  pgm.createIndex('application_fields', ['organisation_id'], {
    name: 'application_fields_sensitive_index',
    where: 'is_sensitive = true',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('application_fields', ['organisation_id'], {
    name: 'application_fields_sensitive_index',
  });
  pgm.dropColumn('application_fields', 'is_sensitive');
};
