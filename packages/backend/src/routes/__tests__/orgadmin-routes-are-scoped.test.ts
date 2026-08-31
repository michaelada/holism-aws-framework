import fs from 'fs';
import path from 'path';

/**
 * Every org-admin route must say which organisation it concerns.
 *
 * This is a structural test, not a behavioural one, and it exists because the
 * failure it guards against is *omission*. 127 org-admin routes once carried
 * `authenticateToken()` and nothing else — no capability check, no role check,
 * no organisation check — and nothing anywhere failed to say so. Verified
 * against a live database as an ordinary member with no administrator rights:
 * `GET /events/:id` returned another club's event and `PUT /events/:id` wrote to
 * it.
 *
 * Authentication answers *who* somebody is. It never answered *where they may
 * act*, and a route that forgets the second question looks exactly like one
 * that asks it.
 *
 * A new route added without a scope guard fails here, by name, with the reason.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md §0.
 */

const ROUTES_DIR = path.join(__dirname, '..');

/** The routers mounted under `/api/orgadmin`. */
const ORGADMIN_ROUTERS = [
  'event',
  'event-type',
  'venue',
  'discount',
  'membership',
  'merchandise',
  'calendar',
  'registration',
  'ticketing',
  'application-form',
  'payment',
  'reporting',
  'orgadmin-organisation',
  'user-management',
  'user-group',
  'file-upload',
];

/**
 * What counts as saying which organisation a route is about.
 *
 * Deliberately broad: the point is that *something* establishes and verifies the
 * organisation, not that a particular helper was used. Several of these predate
 * the scope middleware and are correct in their own way.
 */
const SCOPE_MARKERS = [
  'byResource(',              // resolved from the resource being acted on
  'byBodyOrCurrent(',         // a create: the organisation it names, or the current one
  'byParam(',                 // an organisation id already in the path
  'byCurrentOrganisation(',   // "the organisation I am working in"
  'scopeToOrganisation(',
  'scopedToThe',              // the named shorthands in user-management
  'requireOrgAdminCapability',
  'requireCapability',
  'requireOrgAdminRole',
  'withOrganisation(',        // the wrapper in orgadmin-organisation.routes
];

interface Route {
  file: string;
  method: string;
  path: string;
  head: string;
}

function routesIn(file: string): Route[] {
  const source = fs.readFileSync(path.join(ROUTES_DIR, `${file}.routes.ts`), 'utf8');
  const found: Route[] = [];

  const pattern = /router\.(get|post|put|patch|delete)\(\s*\n?\s*'([^']+)'\s*,(.*?)(?=\n\);\n|\n\}\);|\nrouter\.)/gs;
  for (const match of source.matchAll(pattern)) {
    const [, method, routePath, body] = match;
    found.push({
      file,
      method: method.toUpperCase(),
      path: routePath,
      // Only what sits between the path and the handler: a marker inside the
      // handler body is a coincidence, not a guard.
      head: body.split('async')[0] ?? body,
    });
  }

  return found;
}

/*
 * A path that *names* an organisation does not count.
 *
 * It used to. `route.path.includes(':organisationId')` sat in this expression
 * and exempted 21 routes across discounts, memberships, merchandise, calendars,
 * registrations, ticketing, payments and reporting — every one of them reading
 * `req.params.organisationId` after `authenticateToken()` and nothing else.
 * Naming a club in the URL is the *claim* being made, and the id comes from the
 * caller; the guard is what checks the caller may make it. The exemption
 * excused precisely the routes that most needed checking.
 *
 * Several of them did carry a capability middleware, which is why the omission
 * read as deliberate — but those helpers ask whether *the organisation* has the
 * capability enabled, never whether *the caller* administers it. None of them
 * so much as reads `req.user`. See docs/CROSS_ORGANISATION_ACCESS_FIX.md.
 */
const isScoped = (route: Route, routerLevelGuard: boolean): boolean =>
  routerLevelGuard || SCOPE_MARKERS.some((marker) => route.head.includes(marker));

describe('every org-admin route establishes its organisation', () => {
  const unscoped: string[] = [];
  let total = 0;

  for (const file of ORGADMIN_ROUTERS) {
    const source = fs.readFileSync(path.join(ROUTES_DIR, `${file}.routes.ts`), 'utf8');
    // A guard applied to the whole router counts for every route in it.
    const routerLevelGuard = /^router\.use\([^)]*(requireOrgAdmin|scopeToOrganisation|by[A-Z])/m.test(
      source
    );

    for (const route of routesIn(file)) {
      total += 1;
      if (!isScoped(route, routerLevelGuard)) {
        unscoped.push(`${route.method} /api/orgadmin${route.path}   [${route.file}.routes.ts]`);
      }
    }
  }

  it('finds the routers it is meant to be checking', () => {
    // A rename that silently emptied this list would turn the whole file into a
    // test that always passes.
    expect(total).toBeGreaterThan(150);
  });

  it('leaves none of them scoped by authentication alone', () => {
    expect(unscoped).toEqual([]);
  });
});
