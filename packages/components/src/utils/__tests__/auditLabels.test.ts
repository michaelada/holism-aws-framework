import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditFieldLabel,
  humaniseFieldName,
} from '../auditLabels';

/**
 * Turning stored identifiers into words.
 *
 * The trail stores `event.updated` and `openDateEntries` because those have to
 * survive renames and be filtered on. A club secretary reading their own log
 * should never see either.
 */

describe('action labels', () => {
  it('names the actions a reader will meet most often', () => {
    expect(auditActionLabel('event.updated')).toBe('Event updated');
    expect(auditActionLabel('auth.login')).toBe('Signed in');
    expect(auditActionLabel('settings.branding-updated')).toBe('Branding changed');
  });

  it('says what happened rather than transliterating the identifier', () => {
    // "Auth login-failed" is what composition would have produced.
    expect(auditActionLabel('auth.login-failed')).toBe('Failed sign-in');
    expect(auditActionLabel('access.denied')).toBe('Access refused');
    expect(auditActionLabel('capability.revoked')).toBe('Capability withdrawn');
  });

  it('still produces something readable for an action not in the map', () => {
    // An unregistered action is a bug elsewhere, not a reason to show nothing.
    expect(auditActionLabel('widget.frobnicated')).toBe('Widget: Frobnicated');
  });

  it('survives an action with no dot', () => {
    expect(auditActionLabel('somethingHappened')).toBe('Something happened');
  });

  it('has no empty labels', () => {
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label, action).toBeTruthy();
      expect(label, action).not.toContain('.');
    }
  });
});

describe('field labels', () => {
  it('uses the curated wording where the generic one reads badly', () => {
    expect(auditFieldLabel('openDateEntries')).toBe('Entries open');
    expect(auditFieldLabel('addConfirmationMessage')).toBe('Add message to confirmation email');
  });

  it('humanises everything else', () => {
    expect(auditFieldLabel('entryFee')).toBe('Entry fee');
    expect(auditFieldLabel('startDate')).toBe('Start date');
  });
});

describe('humanising a field name', () => {
  it('splits camelCase into a sentence', () => {
    expect(humaniseFieldName('openDateEntries')).toBe('Open date entries');
  });

  it('splits snake_case and kebab-case too', () => {
    expect(humaniseFieldName('entry_fee')).toBe('Entry fee');
    expect(humaniseFieldName('event-type')).toBe('Event type');
  });

  it('drops a trailing Id, which means nothing to a reader', () => {
    expect(humaniseFieldName('venueId')).toBe('Venue');
    expect(humaniseFieldName('discountIds')).toBe('Discount');
  });

  it('keeps a name that is only an id', () => {
    // Dropping the word would leave an empty label.
    expect(humaniseFieldName('id')).toBe('Id');
  });

  it('capitalises the first word only', () => {
    // Title case on a whole sentence reads like a headline, not a label.
    expect(humaniseFieldName('showOnOrganisationPage')).toBe('Show on organisation page');
  });

  it('handles digits in the middle of a name', () => {
    expect(humaniseFieldName('logoS3Key')).toBe('Logo s3 key');
  });

  it('returns the original when there is nothing to split', () => {
    expect(humaniseFieldName('name')).toBe('Name');
    expect(humaniseFieldName('')).toBe('');
  });
});
