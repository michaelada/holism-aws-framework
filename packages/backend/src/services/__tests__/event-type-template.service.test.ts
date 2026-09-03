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

/**
 * The write side (task S0-4).
 *
 * The pool is mocked, so what these prove is the **decisions**: which keys are
 * refused, what an empty save leaves behind, and that a lock is reported rather
 * than silently applied. That the gate itself holds is SQL, proved against a
 * real database in `__tests__/integration/event-template-visibility.test.ts`.
 */
describe('saving a club’s own rules', () => {
  const templateRow = {
    id: TEMPLATE,
    key: 'equestrian.eventing',
    display_name: 'Eventing',
    description: null,
    capability: null,
    scheduler_kind: 'sequential-phases',
    shape: {},
    default_settings: { competitorGapMinutes: 20 },
    status: 'published',
    created_at: new Date(),
    updated_at: new Date(),
  };

  /**
   * The three reads a save makes before it writes: the visibility list, the
   * resolved chain, then the chain again for the reply.
   */
  const saveContext = ({ locked = [] as string[] } = {}) => {
    query.mockReset();
    const chainRow = {
      id: TEMPLATE,
      key: 'equestrian.eventing',
      default_settings: { competitorGapMinutes: 20 },
      type_settings: null,
      type_locked: locked,
      org_settings: null,
    };
    query
      .mockResolvedValueOnce({ rows: [templateRow] }) // listTemplatesForOrganisation
      .mockResolvedValueOnce({ rows: [chainRow] }) // resolveSettings, for the locks
      .mockResolvedValueOnce({ rows: [] }) // the write
      .mockResolvedValueOnce({ rows: [chainRow] }); // resolveSettings, for the reply
  };

  it('writes the club’s differences and answers with the resolved chain', async () => {
    saveContext();

    const resolved = await service.saveOrganisationOverride(TEMPLATE, ORGANISATION, {
      competitorGapMinutes: 15,
    });

    const write = query.mock.calls[2];
    expect(write[0]).toContain('INSERT INTO event_type_setting_overrides');
    expect(write[1]).toEqual([TEMPLATE, ORGANISATION, JSON.stringify({ competitorGapMinutes: 15 })]);
    expect(resolved.templateKey).toBe('equestrian.eventing');
  });

  it('refuses a locked key with a 403 that names it', async () => {
    // Refused rather than discarded: a club shown its old value back cannot
    // tell a federation's rule from a bug.
    saveContext({ locked: ['competitorGapMinutes'] });

    await expect(
      service.saveOrganisationOverride(TEMPLATE, ORGANISATION, { competitorGapMinutes: 15 })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(query).toHaveBeenCalledTimes(2); // nothing was written
  });

  it('names every refused key, not merely the first', async () => {
    saveContext({ locked: ['a', 'b'] });

    await expect(
      service.saveOrganisationOverride(TEMPLATE, ORGANISATION, { a: 1, b: 2 })
    ).rejects.toThrow(/a, b/);
  });

  it('allows the keys that are not locked, alongside ones that are', async () => {
    saveContext({ locked: ['competitorGapMinutes'] });

    await service.saveOrganisationOverride(TEMPLATE, ORGANISATION, { arenaCount: 3 });

    expect(query.mock.calls[2][0]).toContain('INSERT INTO');
  });

  it('deletes the row when nothing is left — "reset to template"', async () => {
    saveContext();

    await service.saveOrganisationOverride(TEMPLATE, ORGANISATION, {});

    expect(query.mock.calls[2][0]).toContain('DELETE FROM event_type_setting_overrides');
  });

  it('is a 404, not a 403, for a template the club may not use', async () => {
    // Not "forbidden", which would confirm the template exists.
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.saveOrganisationOverride(TEMPLATE, ORGANISATION, { a: 1 })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('saving an organisation type’s rules', () => {
  const TYPE = '33333333-3333-4333-8333-333333333333';
  const templateRow = (defaults: Record<string, unknown>) => ({
    id: TEMPLATE,
    key: 'equestrian.eventing',
    display_name: 'Eventing',
    description: null,
    capability: null,
    scheduler_kind: 'sequential-phases',
    shape: {},
    default_settings: defaults,
    status: 'published',
    created_at: new Date(),
    updated_at: new Date(),
  });

  it('accepts a lock on a key the type does not itself set', async () => {
    // "The template's value, and no club may move it" — a real intention, and
    // the reason locking and setting are separate lists.
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [templateRow({ competitorGapMinutes: 20 })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: TEMPLATE,
            key: 'equestrian.eventing',
            default_settings: { competitorGapMinutes: 20 },
            type_settings: null,
            type_locked: ['competitorGapMinutes'],
          },
        ],
      });

    const resolved = await service.saveTypeOverride(TEMPLATE, TYPE, {
      settings: {},
      lockedKeys: ['competitorGapMinutes'],
    });

    expect(resolved.locked).toEqual(['competitorGapMinutes']);
    expect(resolved.settings).toEqual({ competitorGapMinutes: 20 });
    expect(resolved.sources).toEqual({ competitorGapMinutes: 'template' });
  });

  it('refuses to lock a setting the template does not define', async () => {
    // A typo would otherwise sit in the database forbidding a setting nobody
    // has, and surface as a club unable to change something for no reason.
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [templateRow({ competitorGapMinutes: 20 })] });

    await expect(
      service.saveTypeOverride(TEMPLATE, TYPE, { settings: {}, lockedKeys: ['competitorGap'] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows locking a key the type introduces in the same write', async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [templateRow({})] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: TEMPLATE,
            key: 'equestrian.eventing',
            default_settings: {},
            type_settings: { arenaCount: 2 },
            type_locked: ['arenaCount'],
          },
        ],
      });

    const resolved = await service.saveTypeOverride(TEMPLATE, TYPE, {
      settings: { arenaCount: 2 },
      lockedKeys: ['arenaCount'],
    });

    expect(resolved.sources).toEqual({ arenaCount: 'organisation-type' });
  });
});

describe('correcting a template’s key', () => {
  const row = (status: string, key = 'equestrian.eventing') => ({
    id: TEMPLATE,
    key,
    display_name: 'Eventing',
    description: null,
    capability: null,
    scheduler_kind: 'sequential-phases',
    shape: {},
    default_settings: {},
    status,
    created_at: new Date(),
    updated_at: new Date(),
  });

  it('lets a draft’s key be corrected', async () => {
    // There is no delete endpoint, so a typo in a draft would otherwise be
    // permanent.
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [row('draft', 'equestrain.eventing')] }) // getTemplate
      .mockResolvedValueOnce({ rows: [] }) // the key update
      .mockResolvedValueOnce({ rows: [{ id: TEMPLATE }] }) // the main update
      .mockResolvedValueOnce({ rows: [row('draft')] }); // getTemplate, for the reply

    await service.updateTemplate(TEMPLATE, { key: 'equestrian.eventing' });

    expect(query.mock.calls[1][0]).toContain('SET key');
    expect(query.mock.calls[1][1]).toEqual([TEMPLATE, 'equestrian.eventing']);
  });

  it('refuses to change a published template’s key', async () => {
    // A saved event names it. Renaming would orphan the schedule and the
    // results silently.
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [row('published')] });

    await expect(
      service.updateTemplate(TEMPLATE, { key: 'something.else' })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not object when a published template is saved with its own key unchanged', async () => {
    // The screen sends the whole form back, key included. Treating that as an
    // attempted rename would make a published template unsaveable.
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [row('published')] })
      .mockResolvedValueOnce({ rows: [{ id: TEMPLATE }] })
      .mockResolvedValueOnce({ rows: [row('published')] });

    await expect(
      service.updateTemplate(TEMPLATE, { key: 'equestrian.eventing', displayName: 'Eventing' })
    ).resolves.toBeDefined();
  });
});
