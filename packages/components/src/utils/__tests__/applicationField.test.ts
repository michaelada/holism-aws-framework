import { describe, it, expect } from 'vitest';
import { FieldDatatype } from '../../types';
import {
  applicationFieldToFieldDefinition,
  emptyValueForField,
  mapApplicationDatatype,
  mapApplicationOptions,
  validateApplicationField,
} from '../applicationField';

describe('mapApplicationDatatype', () => {
  it.each([
    ['text', FieldDatatype.TEXT],
    ['textarea', FieldDatatype.TEXT_AREA],
    ['number', FieldDatatype.NUMBER],
    ['email', FieldDatatype.EMAIL],
    ['url', FieldDatatype.URL],
    ['date', FieldDatatype.DATE],
    ['time', FieldDatatype.TIME],
    ['datetime', FieldDatatype.DATETIME],
    ['boolean', FieldDatatype.BOOLEAN],
    ['select', FieldDatatype.SINGLE_SELECT],
    ['radio', FieldDatatype.SINGLE_SELECT],
    ['multiselect', FieldDatatype.MULTI_SELECT],
    ['checkbox', FieldDatatype.MULTI_SELECT],
    ['file', FieldDatatype.DOCUMENT_UPLOAD],
    ['image', FieldDatatype.DOCUMENT_UPLOAD],
  ])('maps the builder datatype %s to %s', (stored, expected) => {
    expect(mapApplicationDatatype(stored)).toBe(expected);
  });

  it('keeps a phone field as its own datatype so it can be checked', () => {
    expect(mapApplicationDatatype('phone')).toBe(FieldDatatype.PHONE);
  });

  it('is idempotent — an already-mapped datatype survives a second pass', () => {
    for (const datatype of [
      FieldDatatype.SINGLE_SELECT,
      FieldDatatype.MULTI_SELECT,
      FieldDatatype.TEXT_AREA,
      FieldDatatype.DOCUMENT_UPLOAD,
    ]) {
      expect(mapApplicationDatatype(mapApplicationDatatype(datatype))).toBe(datatype);
    }
  });

  it('falls back to text for an unknown or missing datatype', () => {
    expect(mapApplicationDatatype('sourdough')).toBe(FieldDatatype.TEXT);
    expect(mapApplicationDatatype(undefined)).toBe(FieldDatatype.TEXT);
    expect(mapApplicationDatatype(null)).toBe(FieldDatatype.TEXT);
  });
});

describe('mapApplicationOptions', () => {
  it('turns the stored string array into value/label pairs', () => {
    expect(mapApplicationOptions(['Under 12', 'Under 14'])).toEqual([
      { value: 'Under 12', label: 'Under 12' },
      { value: 'Under 14', label: 'Under 14' },
    ]);
  });

  it('passes value/label objects through', () => {
    expect(mapApplicationOptions([{ value: 'u12', label: 'Under 12' }])).toEqual([
      { value: 'u12', label: 'Under 12' },
    ]);
  });

  it('fills in a missing half from the other', () => {
    expect(mapApplicationOptions([{ label: 'Under 12' }, { value: 'u14' }])).toEqual([
      { value: 'Under 12', label: 'Under 12' },
      { value: 'u14', label: 'u14' },
    ]);
  });

  it('yields nothing rather than throwing for a shape it does not understand', () => {
    expect(mapApplicationOptions(null)).toEqual([]);
    expect(mapApplicationOptions(undefined)).toEqual([]);
    expect(mapApplicationOptions('Under 12')).toEqual([]);
    expect(mapApplicationOptions([null, undefined, 42 as unknown])).toEqual([]);
  });
});

describe('applicationFieldToFieldDefinition', () => {
  it('renames name/label to the shortName/displayName the renderers read', () => {
    const definition = applicationFieldToFieldDefinition({
      name: 'age_group',
      label: 'Age group',
      description: 'Pick one',
      datatype: 'radio',
    });

    expect(definition.shortName).toBe('age_group');
    expect(definition.displayName).toBe('Age group');
    expect(definition.description).toBe('Pick one');
  });

  it('gives a radio field the expanded presentation and its choices', () => {
    const definition = applicationFieldToFieldDefinition({
      name: 'age_group',
      label: 'Age group',
      datatype: 'radio',
      options: ['Under 12', 'Under 14'],
    });

    expect(definition.datatype).toBe(FieldDatatype.SINGLE_SELECT);
    expect(definition.datatypeProperties.displayMode).toBe('radio');
    expect(definition.datatypeProperties.options).toEqual([
      { value: 'Under 12', label: 'Under 12' },
      { value: 'Under 14', label: 'Under 14' },
    ]);
  });

  it('gives a checkbox field the expanded presentation, not a dropdown', () => {
    const definition = applicationFieldToFieldDefinition({
      name: 'dietary',
      label: 'Dietary needs',
      datatype: 'checkbox',
      options: ['Vegetarian', 'Gluten free'],
    });

    expect(definition.datatype).toBe(FieldDatatype.MULTI_SELECT);
    expect(definition.datatypeProperties.displayMode).toBe('checkbox');
  });

  it('gives select and multiselect fields a dropdown', () => {
    for (const datatype of ['select', 'multiselect']) {
      const definition = applicationFieldToFieldDefinition({
        name: 'f',
        label: 'F',
        datatype,
        options: ['a'],
      });
      expect(definition.datatypeProperties.displayMode).toBe('dropdown');
    }
  });

  it('marks an image field so the upload renderer accepts images only', () => {
    const definition = applicationFieldToFieldDefinition({
      name: 'photo',
      label: 'Photo',
      datatype: 'image',
    });

    expect(definition.datatype).toBe(FieldDatatype.DOCUMENT_UPLOAD);
    expect(definition.datatypeProperties.fileType).toBe('image');
    expect(definition.datatypeProperties.acceptImages).toBe(true);
  });

  it('leaves a field with no options carrying no options', () => {
    const definition = applicationFieldToFieldDefinition({
      name: 'notes',
      label: 'Notes',
      datatype: 'textarea',
    });

    expect(definition.datatype).toBe(FieldDatatype.TEXT_AREA);
    expect(definition.datatypeProperties.options).toBeUndefined();
  });

  it('carries validation rules across and defaults them to none', () => {
    const rules = [{ type: 'max_length', value: 10 } as never];

    expect(
      applicationFieldToFieldDefinition({
        name: 'f',
        label: 'F',
        datatype: 'text',
        validation: { rules },
      }).validationRules
    ).toEqual(rules);

    expect(
      applicationFieldToFieldDefinition({ name: 'f', label: 'F', datatype: 'text' })
        .validationRules
    ).toEqual([]);
  });

  it('survives a field with nothing on it', () => {
    const definition = applicationFieldToFieldDefinition({});

    expect(definition.shortName).toBe('');
    expect(definition.displayName).toBe('');
    expect(definition.datatype).toBe(FieldDatatype.TEXT);
  });
});

/**
 * The datatype is a promise about the answer, and this is where it is kept.
 * It used to be kept only if the form builder also attached a validation rule,
 * which it never did — so an email field took `not an email` and a phone field
 * took a sentence.
 */
describe('validateApplicationField', () => {
  const field = (over: Record<string, unknown> = {}) => ({
    name: 'answer',
    label: 'Answer',
    datatype: 'text',
    ...over,
  });

  it('reports a required answer that is missing, by name', () => {
    expect(validateApplicationField(field({ label: 'Horse name' }), '', true)).toMatch(
      /Horse name.*required/i
    );
    expect(validateApplicationField(field(), undefined, true)).toMatch(/required/i);
    expect(validateApplicationField(field({ datatype: 'checkbox' }), [], true)).toMatch(/required/i);
  });

  it('accepts a blank optional answer of any type', () => {
    for (const datatype of ['email', 'phone', 'url', 'number', 'date', 'select']) {
      expect(validateApplicationField(field({ datatype }), '')).toBeNull();
      expect(validateApplicationField(field({ datatype }), undefined)).toBeNull();
    }
  });

  it('enforces the email format without a rule being configured', () => {
    const email = field({ datatype: 'email' });

    expect(validateApplicationField(email, 'member@club.ie')).toBeNull();
    expect(validateApplicationField(email, 'not an email')).toMatch(/valid email/i);
    expect(validateApplicationField(email, 'member@club')).toMatch(/valid email/i);
  });

  it('rejects letters in a phone number and accepts the punctuation people use', () => {
    const phone = field({ datatype: 'phone' });

    expect(validateApplicationField(phone, '+353 (0)1 234 5678')).toBeNull();
    expect(validateApplicationField(phone, '01-234 5678')).toBeNull();
    expect(validateApplicationField(phone, 'call the club')).toMatch(/valid phone/i);
    expect(validateApplicationField(phone, '12345')).toMatch(/at least 6 digits/i);
  });

  it('enforces a web address', () => {
    const url = field({ datatype: 'url' });

    expect(validateApplicationField(url, 'https://club.ie')).toBeNull();
    expect(validateApplicationField(url, 'our website')).toMatch(/web address/i);
  });

  it('enforces a number', () => {
    const number = field({ datatype: 'number' });

    expect(validateApplicationField(number, 12)).toBeNull();
    expect(validateApplicationField(number, 'twelve')).toMatch(/number/i);
  });

  it('enforces a real date', () => {
    const date = field({ datatype: 'date' });

    expect(validateApplicationField(date, '2026-07-01T00:00:00.000Z')).toBeNull();
    expect(validateApplicationField(date, 'next Tuesday')).toMatch(/date/i);
  });

  it('rejects a choice that was never offered', () => {
    const options = ['Under 12', 'Under 14'];

    expect(validateApplicationField(field({ datatype: 'radio', options }), 'Under 12')).toBeNull();
    expect(validateApplicationField(field({ datatype: 'select', options }), 'Under 21')).toMatch(
      /offered options/i
    );
    expect(
      validateApplicationField(field({ datatype: 'checkbox', options }), ['Under 12', 'Senior'])
    ).toMatch(/offered options/i);
  });

  it('accepts an answer to a field whose options are not configured', () => {
    expect(validateApplicationField(field({ datatype: 'select' }), 'anything')).toBeNull();
  });
});

describe('emptyValueForField', () => {
  it('starts array-valued fields as an array, not an empty string', () => {
    expect(emptyValueForField({ datatype: 'multiselect' })).toEqual([]);
    expect(emptyValueForField({ datatype: 'checkbox' })).toEqual([]);
    expect(emptyValueForField({ datatype: 'file' })).toEqual([]);
    expect(emptyValueForField({ datatype: 'image' })).toEqual([]);
  });

  it('starts a tick-box unticked', () => {
    expect(emptyValueForField({ datatype: 'boolean' })).toBe(false);
  });

  it('starts everything else as an empty string', () => {
    expect(emptyValueForField({ datatype: 'text' })).toBe('');
    expect(emptyValueForField({ datatype: 'radio' })).toBe('');
    expect(emptyValueForField({})).toBe('');
  });
});
