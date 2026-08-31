import { ORGS, ORG_TYPE } from '../dataset';
import { existingSeedData } from '../database';

/**
 * The check that stops a second seed before it starts.
 *
 * Run twice without `--reset`, the seed used to fail on its very first insert
 * with `duplicate key value violates unique constraint
 * "organization_types_name_key"` — and only after reconciling every Keycloak
 * user and creating four live Stripe connected accounts, four more of which
 * were stranded by every re-run. This is what makes that a one-query refusal.
 */
describe('existingSeedData', () => {
  const client = { query: jest.fn() } as unknown as {
    query: jest.Mock;
  };

  const answers = (orgType: number, orgs: string[]) => {
    client.query.mockReset();
    client.query
      .mockResolvedValueOnce({ rowCount: orgType, rows: [] })
      .mockResolvedValueOnce({ rowCount: orgs.length, rows: orgs.map((name) => ({ name })) });
  };

  it('says nothing about an empty database', async () => {
    answers(0, []);

    await expect(existingSeedData(client as never)).resolves.toBeNull();
  });

  it('asks about the organisation type the seed creates', async () => {
    answers(0, []);

    await existingSeedData(client as never);

    expect(client.query).toHaveBeenCalledWith(
      'SELECT 1 FROM organization_types WHERE name = $1',
      [ORG_TYPE.name]
    );
  });

  it('asks about the clubs by the names the seed writes', async () => {
    answers(0, []);

    await existingSeedData(client as never);

    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT name FROM organizations WHERE name = ANY($1)',
      [ORGS.map((o) => o.name)]
    );
  });

  it('names the organisation type when only it survived', async () => {
    answers(1, []);

    await expect(existingSeedData(client as never)).resolves.toBe(
      `the "${ORG_TYPE.name}" organisation type`
    );
  });

  /* The ordinary case: a complete previous seed. */
  it('reports a full fixture as all of it', async () => {
    answers(1, ORGS.map((o) => o.name));

    const found = await existingSeedData(client as never);

    expect(found).toContain(`the "${ORG_TYPE.name}" organisation type`);
    expect(found).toContain(`all ${ORGS.length} of its clubs`);
  });

  /* A half-finished reset, which still cannot be seeded into. */
  it('counts a partial fixture rather than rounding it to all', async () => {
    answers(0, [ORGS[0].name, ORGS[1].name]);

    await expect(existingSeedData(client as never)).resolves.toBe(`2 of its ${ORGS.length} clubs`);
  });

  it('ignores organisations the seed did not create', async () => {
    answers(0, []);

    await expect(existingSeedData(client as never)).resolves.toBeNull();
  });
});
