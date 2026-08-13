import {
  validateFieldValue,
  validateSubmissionData,
  ValidatableField,
} from '../application-field-validation';

const field = (over: Partial<ValidatableField> = {}): ValidatableField => ({
  name: 'answer',
  label: 'Answer',
  datatype: 'text',
  ...over,
});

/**
 * The server's own check on application-form answers.
 *
 * The client gate is a courtesy — it names the field before the member commits
 * to paying. This is the guarantee, because a submission is the record a
 * membership and an entry are built from, not a screen.
 */
describe('validateFieldValue', () => {
  describe('required-ness', () => {
    it('rejects a missing answer for a field required by the join row', () => {
      expect(validateFieldValue(field({ required: true }), undefined)).toMatch(/required/i);
      expect(validateFieldValue(field({ required: true }), '')).toMatch(/required/i);
      expect(validateFieldValue(field({ required: true }), [])).toMatch(/required/i);
    });

    it('rejects a missing answer for a field required by its own definition', () => {
      expect(
        validateFieldValue(field({ validation: { required: true } }), null)
      ).toMatch(/required/i);
    });

    it('accepts a blank optional answer — not filled in is not filled in wrongly', () => {
      expect(validateFieldValue(field({ datatype: 'email' }), '')).toBeNull();
      expect(validateFieldValue(field({ datatype: 'phone' }), undefined)).toBeNull();
      expect(validateFieldValue(field({ datatype: 'number' }), null)).toBeNull();
    });
  });

  describe('email', () => {
    const email = field({ datatype: 'email' });

    it.each(['member@club.ie', 'first.last+tag@sub.domain.co.uk'])('accepts %s', (value) => {
      expect(validateFieldValue(email, value)).toBeNull();
    });

    it.each(['not an email', 'member@', '@club.ie', 'member@club', 'member club.ie'])(
      'rejects %s',
      (value) => {
        expect(validateFieldValue(email, value)).toMatch(/valid email/i);
      }
    );
  });

  describe('phone', () => {
    const phone = field({ datatype: 'phone' });

    it.each(['+353 (0)1 234 5678', '01-234 5678', '0871234567'])('accepts %s', (value) => {
      expect(validateFieldValue(phone, value)).toBeNull();
    });

    it('rejects letters — the answer is simply not a phone number', () => {
      expect(validateFieldValue(phone, 'call the club')).toMatch(/valid phone/i);
      expect(validateFieldValue(phone, '087 CALL ME')).toMatch(/valid phone/i);
    });

    it('rejects too few digits to be a number anyone could ring', () => {
      expect(validateFieldValue(phone, '12345')).toMatch(/at least 6 digits/i);
    });
  });

  describe('url', () => {
    const url = field({ datatype: 'url' });

    it('accepts a real address', () => {
      expect(validateFieldValue(url, 'https://club.ie/entries')).toBeNull();
    });

    it('rejects prose', () => {
      expect(validateFieldValue(url, 'our website')).toMatch(/web address/i);
    });
  });

  describe('number', () => {
    const number = field({ datatype: 'number' });

    it('accepts a number, and the numeric string an HTML form produces', () => {
      expect(validateFieldValue(number, 12)).toBeNull();
      expect(validateFieldValue(number, '12')).toBeNull();
      expect(validateFieldValue(number, '12.5')).toBeNull();
    });

    it('rejects text', () => {
      expect(validateFieldValue(number, 'twelve')).toMatch(/number/i);
    });
  });

  describe('dates', () => {
    it.each(['date', 'time', 'datetime'])('accepts an ISO %s', (datatype) => {
      expect(validateFieldValue(field({ datatype }), '2026-07-01T09:30:00.000Z')).toBeNull();
    });

    it('rejects something that is not a date at all', () => {
      expect(validateFieldValue(field({ datatype: 'date' }), 'next Tuesday')).toMatch(/date/i);
    });
  });

  describe('choices', () => {
    const options = ['Under 12', 'Under 14'];

    it.each(['select', 'radio'])('accepts an offered choice for a %s field', (datatype) => {
      expect(validateFieldValue(field({ datatype, options }), 'Under 12')).toBeNull();
    });

    it.each(['select', 'radio'])('rejects a choice that was never offered (%s)', (datatype) => {
      expect(validateFieldValue(field({ datatype, options }), 'Under 21')).toMatch(
        /offered options/i
      );
    });

    it.each(['multiselect', 'checkbox'])('accepts offered choices for a %s field', (datatype) => {
      expect(validateFieldValue(field({ datatype, options }), ['Under 12', 'Under 14'])).toBeNull();
    });

    it.each(['multiselect', 'checkbox'])('rejects an unoffered choice among them (%s)', (datatype) => {
      expect(validateFieldValue(field({ datatype, options }), ['Under 12', 'Senior'])).toMatch(
        /offered options/i
      );
    });

    it('rejects a single value where a list is expected', () => {
      expect(validateFieldValue(field({ datatype: 'checkbox', options }), 'Under 12')).toMatch(
        /list of choices/i
      );
    });

    it('accepts anything when the field carries no options to check against', () => {
      expect(validateFieldValue(field({ datatype: 'select' }), 'Under 21')).toBeNull();
    });
  });

  describe('boolean and uploads', () => {
    it('accepts a tick-box answer', () => {
      expect(validateFieldValue(field({ datatype: 'boolean' }), true)).toBeNull();
      expect(validateFieldValue(field({ datatype: 'boolean' }), false)).toBeNull();
    });

    it('rejects a tick-box answer that is not one', () => {
      expect(validateFieldValue(field({ datatype: 'boolean' }), 'maybe')).toMatch(/yes or no/i);
    });

    it('expects uploads to arrive as a list', () => {
      expect(validateFieldValue(field({ datatype: 'file' }), [])).toBeNull();
      expect(validateFieldValue(field({ datatype: 'image' }), [{ fileId: 'f1' }])).toBeNull();
      expect(validateFieldValue(field({ datatype: 'file' }), 'resume.pdf')).toMatch(/list of files/i);
    });
  });

  describe('text', () => {
    it('accepts text and rejects a structure posing as text', () => {
      expect(validateFieldValue(field(), 'Dobbin')).toBeNull();
      expect(validateFieldValue(field({ datatype: 'textarea' }), 'Long answer')).toBeNull();
      expect(validateFieldValue(field(), { sneaky: true })).toMatch(/text/i);
    });

    it('does not reject a datatype it has never heard of', () => {
      expect(validateFieldValue(field({ datatype: 'colour_picker' }), 'blue')).toBeNull();
    });
  });
});

describe('validateSubmissionData', () => {
  const fields: ValidatableField[] = [
    { name: 'email', label: 'Email', datatype: 'email', required: true },
    { name: 'mobile', label: 'Mobile', datatype: 'phone' },
    { name: 'age_group', label: 'Age group', datatype: 'radio', options: ['Under 12'] },
  ];

  it('says nothing when every answer is good', () => {
    expect(
      validateSubmissionData(fields, {
        email: 'member@club.ie',
        mobile: '+353 1 234 5678',
        age_group: 'Under 12',
      })
    ).toEqual([]);
  });

  it('names every bad answer, with the label the member saw', () => {
    const errors = validateSubmissionData(fields, {
      email: 'nope',
      mobile: 'call me',
      age_group: 'Under 21',
    });

    expect(errors.map((error) => error.field)).toEqual(['email', 'mobile', 'age_group']);
    expect(errors[0].label).toBe('Email');
    expect(errors[0].message).toMatch(/valid email/i);
  });

  it('reports a required answer that was never sent', () => {
    const errors = validateSubmissionData(fields, { mobile: '+353 1 234 5678' });

    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('email');
  });

  /**
   * A form edited between page load and submit would otherwise fail with an
   * error the member cannot act on, and nothing downstream reads by anything
   * but field name.
   */
  it('ignores answers for fields the form does not contain', () => {
    expect(
      validateSubmissionData(fields, {
        email: 'member@club.ie',
        removed_field: 'whatever',
      })
    ).toEqual([]);
  });

  it('survives submission data that is missing entirely', () => {
    expect(validateSubmissionData([{ name: 'notes', datatype: 'text' }], undefined as never)).toEqual(
      []
    );
  });
});
