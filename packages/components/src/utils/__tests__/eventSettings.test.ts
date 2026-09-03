/**
 * Shaping a template's settings into rows.
 *
 * Worth testing away from a screen because both the platform admin and the
 * org-admin draw from this, and a disagreement between them would show as two
 * panels that are supposed to be the same panel.
 */

import { describe, it, expect } from 'vitest';
import { describeSettings, humaniseSettingKey, keysInGroups } from '../eventSettings';

describe('humaniseSettingKey', () => {
  it.each([
    ['minutesPerCompetitor', 'Minutes per competitor'],
    ['dressage', 'Dressage'],
    ['break_length', 'Break length'],
    ['objections-window', 'Objections window'],
  ])('turns %s into sentence case', (key, expected) => {
    expect(humaniseSettingKey(key)).toBe(expected);
  });

  it('leaves an acronym alone rather than spelling it out', () => {
    expect(humaniseSettingKey('maxHTTPRetries')).toBe('Max HTTP retries');
  });

  it('gives back a key it cannot improve on', () => {
    expect(humaniseSettingKey('')).toBe('');
  });
});

describe('describeSettings', () => {
  it('groups by the part before the dot', () => {
    const groups = describeSettings({
      settings: { 'minutesPerCompetitor.dressage': 8, 'minutesPerCompetitor.xc': 6 },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Minutes per competitor');
    expect(groups[0].rows.map((row) => row.label)).toEqual(['Dressage', 'Xc']);
  });

  it('puts ungrouped settings first', () => {
    // The plain ones. Burying them under two named groups would make the
    // simple case the hard one to find.
    const groups = describeSettings({
      settings: { 'minutesPerCompetitor.dressage': 8, objectionsWindow: 30 },
    });

    expect(groups[0].key).toBeNull();
    expect(groups[0].rows[0].label).toBe('Objections window');
    expect(groups[1].label).toBe('Minutes per competitor');
  });

  it('sorts by label, because jsonb does not keep the order keys were written in', () => {
    const groups = describeSettings({ settings: { zebra: 1, apple: 2, mango: 3 } });

    expect(groups[0].rows.map((row) => row.label)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('prefers a label the template supplies over the humanised key', () => {
    const groups = describeSettings({
      settings: { 'minutesPerCompetitor.xc': 6 },
      labels: { 'minutesPerCompetitor.xc': 'Cross country' },
    });

    expect(groups[0].rows[0].label).toBe('Cross country');
  });

  it('names a group from the template too', () => {
    const groups = describeSettings({
      settings: { 'mpc.dressage': 8 },
      labels: { mpc: 'Minutes per competitor' },
    });

    expect(groups[0].label).toBe('Minutes per competitor');
  });

  it.each([
    [8, 'number'],
    [true, 'boolean'],
    ['anything', 'text'],
    [null, 'text'],
  ])('infers the input for %p', (value, expected) => {
    const groups = describeSettings({ settings: { setting: value } });
    expect(groups[0].rows[0].type).toBe(expected);
  });

  it('carries the source and the lock through to the row', () => {
    const groups = describeSettings({
      settings: { gap: 20, arenas: 2 },
      sources: { gap: 'organisation-type', arenas: 'template' },
      locked: ['gap'],
    });

    const rows = Object.fromEntries(groups[0].rows.map((row) => [row.key, row]));
    expect(rows.gap.source).toBe('organisation-type');
    expect(rows.gap.locked).toBe(true);
    expect(rows.arenas.locked).toBe(false);
  });

  it('survives no sources and no locks at all', () => {
    const groups = describeSettings({ settings: { gap: 20 } });

    expect(groups[0].rows[0].source).toBeUndefined();
    expect(groups[0].rows[0].locked).toBe(false);
  });

  it('survives a settings map that is not there', () => {
    expect(describeSettings({ settings: undefined as any })).toEqual([]);
  });

  it('does not group on a leading dot, which would make an empty heading', () => {
    const groups = describeSettings({ settings: { '.odd': 1 } });

    expect(groups[0].key).toBeNull();
  });

  it('lists every key across groups, for "reset all"', () => {
    const groups = describeSettings({
      settings: { 'a.one': 1, 'a.two': 2, plain: 3 },
    });

    expect(keysInGroups(groups).sort()).toEqual(['a.one', 'a.two', 'plain']);
  });
});
