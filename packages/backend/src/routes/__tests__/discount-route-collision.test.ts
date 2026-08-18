/**
 * Which discount route a URL actually reaches.
 *
 * `GET /api/orgadmin/organisations/:organisationId/discounts/:id` returned 403
 * on the deployed site for a discount the caller plainly owned. Nothing was
 * wrong with the permissions: the request never reached `/discounts/:id` at
 * all.
 *
 * The router is mounted twice — bare at `/api/orgadmin` and scoped at
 * `/api/orgadmin/organisations/:organisationId` — and the bare mount is
 * registered first, deliberately, so that a router's own fully-specified paths
 * win. One of those paths was
 *
 *     /organisations/:organisationId/discounts/:moduleType
 *
 * which matches the scoped detail URL perfectly, binding the discount **id** to
 * `moduleType`. `getCapabilityForModule` had no entry for a uuid, returned
 * `undefined`, and `requireCapability(undefined)` refused a capability it could
 * not name: "Access denied. Required capability: ".
 *
 * Two `:param` segments in the same position, one of which is unconstrained,
 * cannot both be right. Constraining `:moduleType` to the five module names is
 * what decides it — and it has to be asserted against a real router, because
 * the ambiguity lives in the mounting, not in either route alone.
 */
import express from 'express';
import request from 'supertest';

import { ModuleType } from '../../types/discount.types';

const MODULES: ModuleType[] = [
  'events',
  'memberships',
  'calendar',
  'merchandise',
  'registrations',
];

const ORGANISATION = 'd92186c3-b34b-4117-8df7-9da5eea568d1';
const DISCOUNT = '0dd4261d-36b1-4851-a0f1-d2ba2b32d525';

/**
 * The two colliding routes and both mounts, with the handlers replaced by
 * markers. Reproducing the mounting is the point — `discount.routes` itself
 * drags in the database, and what is under test is routing, not behaviour.
 */
function buildApp(constrainModuleType: boolean) {
  const app = express();
  const router = express.Router({ mergeParams: true });
  const pattern = constrainModuleType ? `(${MODULES.join('|')})` : '';

  router.get(
    `/organisations/:organisationId/discounts/:moduleType${pattern}`,
    (req, res) => {
      res.json({ route: 'byModuleType', bound: req.params.moduleType });
    }
  );

  router.get('/discounts/:id', (req, res) => {
    res.json({ route: 'byId', bound: req.params.id });
  });

  // Bare first, scoped second — the order index.ts uses and relies on.
  app.use('/api/orgadmin', router);
  app.use('/api/orgadmin/organisations/:organisationId', router);

  return app;
}

const detailUrl = `/api/orgadmin/organisations/${ORGANISATION}/discounts/${DISCOUNT}`;

describe('discount detail and module-listing routes overlap', () => {
  it('sends a discount id to the by-id route', async () => {
    const response = await request(buildApp(true)).get(detailUrl);

    expect(response.body).toEqual({ route: 'byId', bound: DISCOUNT });
  });

  it.each(MODULES)('still sends "%s" to the module-listing route', async (moduleType) => {
    const response = await request(buildApp(true)).get(
      `/api/orgadmin/organisations/${ORGANISATION}/discounts/${moduleType}`
    );

    expect(response.body).toEqual({ route: 'byModuleType', bound: moduleType });
  });

  it('would bind the id to moduleType without the constraint', async () => {
    /*
     * The regression itself, kept executable. If `:moduleType` ever loses its
     * pattern this is what happens again, and the failure it produces is a 403
     * that names no capability — which reads as a permissions bug and is not
     * one.
     */
    const response = await request(buildApp(false)).get(detailUrl);

    expect(response.body).toEqual({ route: 'byModuleType', bound: DISCOUNT });
  });

  it('leaves the unscoped detail form reachable', async () => {
    // The bare mount is still accepted; removing it is a deprecation, not a fix.
    const response = await request(buildApp(true)).get(`/api/orgadmin/discounts/${DISCOUNT}`);

    expect(response.body).toEqual({ route: 'byId', bound: DISCOUNT });
  });
});
