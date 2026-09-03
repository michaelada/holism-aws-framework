/**
 * Resolving a club's settings from the template chain.
 *
 * The one piece of logic in S0, and the reason it is worth this much test is
 * that everything downstream trusts its answer: the scheduler is fed resolved
 * settings, and the screen's `From` column is `sources` rendered.
 *
 * Four properties carry the design.
 *
 *  - **Last wins**, template → organisation type → organisation.
 *  - **`sources` names each key's origin**, because "where did 20 minutes come
 *    from?" is the only question anybody asks of an inheritance chain.
 *  - **A lock beats the club**, whatever the club's own row says.
 *  - **Raising a platform default reaches a club that never overrode it** —
 *    the whole reason overrides store differences rather than copies.
 */

import { EventTypeTemplateService } from '../event-type-template.service';
import { db } from '../../database/pool';
import { NotFoundError } from '../../middleware/errors';

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new EventTypeTemplateService();
const query = db.query as jest.Mock;

const TEMPLATE = '11111111-1111-4111-8111-111111111111';
const ORGANISATION = '22222222-2222-4222-8222-222222222222';

/** The single row the one query returns. */
const chain = (over: Record<string, unknown> = {}) => {
  query.mockReset();
  query.mockResolvedValueOnce({
    rows: [
      {
        id: TEMPLATE,
        key: 'equestrian.eventing',
        default_settings: {},
        type_settings: null,
        type_locked: null,
        org_settings: null,
        ...over,
      },
    ],
  });
};

describe('resolving settings down the chain', () => {
  it('takes the template’s defaults where nobody has overridden', async () => {
    chain({
      default_settings: { 'minutesPerCompetitor.dressage': 8, competitorGapMinutes: 20 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings).toEqual({
      'minutesPerCompetitor.dressage': 8,
      competitorGapMinutes: 20,
    });
    expect(resolved.sources).toEqual({
      'minutesPerCompetitor.dressage': 'template',
      competitorGapMinutes: 'template',
    });
    expect(resolved.locked).toEqual([]);
  });

  it('lets the organisation type beat the template', async () => {
    chain({
      default_settings: { competitorGapMinutes: 20, breakEveryNRounds: 25 },
      type_settings: { competitorGapMinutes: 30 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings.competitorGapMinutes).toBe(30);
    expect(resolved.sources.competitorGapMinutes).toBe('organisation-type');
    // Untouched keys keep following the template.
    expect(resolved.settings.breakEveryNRounds).toBe(25);
    expect(resolved.sources.breakEveryNRounds).toBe('template');
  });

  it('lets the club beat both', async () => {
    chain({
      default_settings: { competitorGapMinutes: 20 },
      type_settings: { competitorGapMinutes: 30 },
      org_settings: { competitorGapMinutes: 15 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings.competitorGapMinutes).toBe(15);
    expect(resolved.sources.competitorGapMinutes).toBe('organisation');
  });

  it('reports a different source per key in one resolution', async () => {
    // The `From` column, which is the whole reason `sources` exists: three
    // settings on one screen, each from a different level.
    chain({
      default_settings: { a: 1, b: 1, c: 1 },
      type_settings: { b: 2 },
      org_settings: { c: 3 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings).toEqual({ a: 1, b: 2, c: 3 });
    expect(resolved.sources).toEqual({
      a: 'template',
      b: 'organisation-type',
      c: 'organisation',
    });
  });

  it('raises a platform default for every club that never overrode it', async () => {
    /*
     * The property the whole storage decision exists for. Overrides hold
     * differences, so improving a template reaches a club that has its own row
     * — as long as that row does not name the key.
     */
    chain({
      default_settings: { competitorGapMinutes: 25 }, // was 20; the platform raised it
      org_settings: { 'minutesPerCompetitor.dressage': 6 }, // the club changed something else
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings.competitorGapMinutes).toBe(25);
    expect(resolved.sources.competitorGapMinutes).toBe('template');
  });
});

describe('a lock beats the club', () => {
  it('ignores the club’s value for a key the type locked', async () => {
    chain({
      default_settings: { competitorGapMinutes: 20 },
      type_settings: { competitorGapMinutes: 30 },
      type_locked: ['competitorGapMinutes'],
      org_settings: { competitorGapMinutes: 5 }, // written before the lock, or around it
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings.competitorGapMinutes).toBe(30);
    expect(resolved.sources.competitorGapMinutes).toBe('organisation-type');
    expect(resolved.locked).toEqual(['competitorGapMinutes']);
  });

  it('holds a key the type locked without setting, at the template’s value', async () => {
    // Locking without setting means "nobody below may change this", not "this
    // has no value" — the template's default stands and is fixed there.
    chain({
      default_settings: { competitorGapMinutes: 20 },
      type_locked: ['competitorGapMinutes'],
      org_settings: { competitorGapMinutes: 5 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings.competitorGapMinutes).toBe(20);
    expect(resolved.sources.competitorGapMinutes).toBe('template');
  });

  it('leaves the club’s other settings alone', async () => {
    chain({
      default_settings: { a: 1, b: 1 },
      type_locked: ['a'],
      org_settings: { a: 99, b: 2 },
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings).toEqual({ a: 1, b: 2 });
    expect(resolved.sources.b).toBe('organisation');
  });

  it('reports locked keys sorted, so two callers agree', async () => {
    chain({ type_locked: ['zeta', 'alpha'] });

    expect((await service.resolveSettings(TEMPLATE, ORGANISATION)).locked).toEqual([
      'alpha',
      'zeta',
    ]);
  });
});

describe('what it costs, and what it refuses', () => {
  it('resolves the whole chain in one query', async () => {
    // Not one per level, and emphatically not one per key. A club with forty
    // settings costs the same round trip as a club with one.
    chain({
      default_settings: { a: 1, b: 2, c: 3, d: 4 },
      type_settings: { a: 9 },
      org_settings: { b: 9 },
    });

    await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('answers not found when there is nothing to resolve', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(service.resolveSettings(TEMPLATE, ORGANISATION)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('survives a column holding something that is not a map', async () => {
    // Defensive, because jsonb accepts an array or a string and a later
    // migration or a hand-edited row could leave one. An unusable value is
    // treated as no override rather than taking the resolution down.
    chain({
      default_settings: { a: 1 },
      type_settings: ['not', 'a', 'map'],
      org_settings: 'neither is this',
      type_locked: 'nor this',
    });

    const resolved = await service.resolveSettings(TEMPLATE, ORGANISATION);

    expect(resolved.settings).toEqual({ a: 1 });
    expect(resolved.locked).toEqual([]);
  });

  it('carries the template key, for the audit entry that records a change', async () => {
    chain({ key: 'equestrian.showjumping' });

    expect((await service.resolveSettings(TEMPLATE, ORGANISATION)).templateKey).toBe(
      'equestrian.showjumping'
    );
  });
});
