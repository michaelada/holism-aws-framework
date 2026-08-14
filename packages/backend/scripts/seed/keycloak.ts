import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { SEED_TAG, SEED_PASSWORD } from './dataset';

/**
 * Keycloak side of the seed.
 *
 * Everything created here carries a `seededBy: [SEED_TAG]` attribute. That is
 * what makes the reset safe: it deletes the users it can prove it created,
 * rather than every user in the realm. A realm-wide wipe would take the
 * operator's own account with it, and on a shared dev realm it would take
 * everyone else's too.
 */

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  /** admin-cli username/password, or a service-account client. */
  adminUser?: string;
  adminPassword?: string;
  clientId: string;
  clientSecret?: string;
}

export function keycloakConfigFromEnv(): KeycloakConfig {
  return {
    baseUrl: process.env.KEYCLOAK_ADMIN_BASE_URL || process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_ADMIN_REALM || process.env.KEYCLOAK_REALM || 'aws-framework',
    adminUser: process.env.KEYCLOAK_ADMIN_USER || 'admin',
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli',
    clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
  };
}

/**
 * Authenticates and hands back a client that keeps its own token fresh.
 *
 * Two things had to match the backend rather than the admin-client library's
 * defaults. The token is fetched by hand from
 * `{baseUrl}/realms/{realm}/protocol/openid-connect/token` — the library's
 * `auth()` does not work against this realm's confidential `admin-cli` — and it
 * is fetched from the **application** realm, not `master`, because that is
 * where the service account lives.
 *
 * The refresh matters more than it looks. A dev Keycloak issues 60-second
 * tokens, and this script makes upwards of forty calls; without it the seed
 * dies halfway through with a 401 and leaves the realm half-built.
 */
export interface KeycloakSession {
  client: KeycloakAdminClient;
  refresh(): Promise<void>;
}

async function fetchToken(config: KeycloakConfig): Promise<{ token: string; expiresIn: number }> {
  const url = `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect/token`;
  const body = config.clientSecret
    ? new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      })
    : new URLSearchParams({
        grant_type: 'password',
        client_id: config.clientId,
        username: config.adminUser!,
        password: config.adminPassword!,
      });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  return { token: data.access_token, expiresIn: data.expires_in ?? 60 };
}

export async function connectKeycloak(config: KeycloakConfig): Promise<KeycloakSession> {
  const client = new KeycloakAdminClient({ baseUrl: config.baseUrl, realmName: config.realm });

  let expiresAt = 0;
  const refresh = async (): Promise<void> => {
    // Refresh a little early: a token that expires mid-request is the same
    // failure as one that expired before it.
    if (Date.now() < expiresAt - 10_000) return;
    const { token, expiresIn } = await fetchToken(config);
    client.setAccessToken(token);
    expiresAt = Date.now() + expiresIn * 1000;
  };

  await refresh();
  return { client, refresh };
}

const seedAttributes = () => ({ seededBy: [SEED_TAG] });

/**
 * Creates a user, or adopts one that already exists with the same username.
 *
 * Adoption matters because a reset can be interrupted: a half-cleared realm
 * would otherwise make every subsequent run fail on a 409, and the operator
 * would have to clean Keycloak by hand.
 */
export async function upsertUser(
  session: KeycloakSession,
  user: { email: string; firstName: string; lastName: string }
): Promise<string> {
  await session.refresh();
  const { client } = session;
  const existing = await client.users.find({ username: user.email, exact: true });

  if (existing.length > 0 && existing[0].id) {
    const id = existing[0].id;
    await client.users.update(
      { id },
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: true,
        emailVerified: true,
        attributes: seedAttributes(),
      }
    );
    await client.users.resetPassword({
      id,
      credential: { type: 'password', value: SEED_PASSWORD, temporary: false },
    });
    return id;
  }

  const created = await client.users.create({
    username: user.email,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    enabled: true,
    // Verified, so a seeded login never lands on a "confirm your email" wall
    // with no mail server running.
    emailVerified: true,
    attributes: seedAttributes(),
    credentials: [
      {
        type: 'password',
        value: SEED_PASSWORD,
        // Not temporary: a forced password change on first login would make
        // every one of these accounts unusable for a quick test.
        temporary: false,
      },
    ],
  });

  if (!created.id) throw new Error(`Keycloak did not return an id for ${user.email}`);
  return created.id;
}

/** Creates the org-type → org → {admins, members} group hierarchy the app expects. */
export async function ensureOrgGroups(
  session: KeycloakSession,
  orgTypeName: string,
  orgName: string
): Promise<{ orgGroupId: string; adminsGroupId: string; membersGroupId: string }> {
  await session.refresh();
  const { client } = session;
  const topLevel = await client.groups.find({ search: orgTypeName });
  let typeGroup = topLevel.find((g) => g.name === orgTypeName);

  if (!typeGroup) {
    const { id } = await client.groups.create({ name: orgTypeName, attributes: seedAttributes() });
    typeGroup = await client.groups.findOne({ id: id! });
  }

  const typeChildren = await client.groups.listSubGroups({ parentId: typeGroup!.id! });
  let orgGroup = typeChildren.find((g) => g.name === orgName);

  if (!orgGroup) {
    const { id } = await client.groups.createChildGroup(
      { id: typeGroup!.id! },
      { name: orgName, attributes: seedAttributes() }
    );
    orgGroup = await client.groups.findOne({ id: id! });
  }

  const orgChildren = await client.groups.listSubGroups({ parentId: orgGroup!.id! });
  const ensureChild = async (name: string): Promise<string> => {
    const found = orgChildren.find((g) => g.name === name);
    if (found?.id) return found.id;
    const { id } = await client.groups.createChildGroup(
      { id: orgGroup!.id! },
      { name, attributes: seedAttributes() }
    );
    return id!;
  };

  return {
    orgGroupId: orgGroup!.id!,
    adminsGroupId: await ensureChild('admins'),
    membersGroupId: await ensureChild('members'),
  };
}

export async function addUserToGroup(
  session: KeycloakSession,
  userId: string,
  groupId: string
): Promise<void> {
  await session.refresh();
  await session.client.users.addToGroup({ id: userId, groupId });
}

/**
 * Grants a realm role, creating it if the realm does not have it.
 *
 * `super-admin` is what `requireRole('super-admin')` checks on every platform
 * admin route, so without this the seeded super admin can sign in and then be
 * refused by every screen.
 */
export async function ensureRealmRole(
  session: KeycloakSession,
  userId: string,
  roleName: string
): Promise<void> {
  await session.refresh();
  const { client } = session;
  let role = await client.roles.findOneByName({ name: roleName }).catch(() => null);

  if (!role) {
    await client.roles.create({ name: roleName, description: `Created by ${SEED_TAG}` });
    role = await client.roles.findOneByName({ name: roleName });
  }

  if (!role?.id) throw new Error(`Could not resolve realm role ${roleName}`);

  await client.users.addRealmRoleMappings({
    id: userId,
    roles: [{ id: role.id, name: role.name! }],
  });
}

/**
 * Deletes every user this seed created, and the group trees it built.
 *
 * Users are found two ways and the union is deleted: by the `seededBy`
 * attribute, and by the explicit list of emails the caller passes (read from
 * the database before it was cleared). Either alone leaves orphans — the
 * attribute misses a user created before tagging existed, and the email list
 * misses one whose database row was already gone.
 */
export async function purgeSeededKeycloak(
  session: KeycloakSession,
  knownEmails: string[]
): Promise<{ usersDeleted: number; groupsDeleted: number }> {
  await session.refresh();
  const { client } = session;
  const ids = new Set<string>();

  // Attribute search is a Keycloak 15+ feature; fall back quietly if the realm
  // does not support it rather than failing the whole reset.
  try {
    const tagged = await client.users.find({ q: `seededBy:${SEED_TAG}`, max: 1000 } as never);
    tagged.forEach((u) => u.id && ids.add(u.id));
  } catch {
    /* fall through to the email list */
  }

  for (const email of knownEmails) {
    await session.refresh();
    const found = await client.users.find({ username: email, exact: true });
    found.forEach((u) => u.id && ids.add(u.id));
  }

  let usersDeleted = 0;
  for (const id of ids) {
    await session.refresh();
    await client.users.del({ id });
    usersDeleted += 1;
  }

  /*
   * Group attributes are not in the list response.
   *
   * Keycloak's `GET /groups` returns a *brief* representation — id, name, path,
   * sub-groups — and omits `attributes` entirely. Checking `seededBy` on the
   * listed object therefore matched nothing and the purge silently removed no
   * groups at all, leaving the org-type tree behind on every reset. Each group
   * has to be fetched individually to see its attributes.
   */
  let groupsDeleted = 0;
  const groups = await client.groups.find({ max: 500 });
  for (const listed of groups) {
    if (!listed.id) continue;
    await session.refresh();
    const full = await client.groups.findOne({ id: listed.id });
    if (full?.attributes?.seededBy?.includes(SEED_TAG)) {
      // Deleting the top-level group takes its children with it.
      await client.groups.del({ id: listed.id });
      groupsDeleted += 1;
    }
  }

  return { usersDeleted, groupsDeleted };
}
