# Account App Keycloak Client Setup

The account-user application (`packages/account-shell`) authenticates against the Keycloak client
**`account-app`**. Without it, every sign-in attempt fails with Keycloak's **"Client not found"**
page before any credentials are entered.

This is the account-app equivalent of [ORGADMIN_KEYCLOAK_SETUP.md](./ORGADMIN_KEYCLOAK_SETUP.md).

> **Why this is a manual step.** Every Keycloak client in this project is created by hand — there is
> no realm import and no provisioning script. `aws-framework-frontend`, `aws-framework-admin` and
> `orgadmin-client` were each created this way. That means a fresh machine or a CI environment needs
> someone to repeat these steps for all four clients; worth knowing before assuming a checkout is
> enough to run the stack.

## What the client must be

| Setting | Value | Why |
|---|---|---|
| Client ID | `account-app` | The default in [`App.tsx`](../packages/account-shell/src/App.tsx), overridable with `VITE_KEYCLOAK_CLIENT_ID` |
| Realm | `aws-framework` | Note: some older docs say `aws-web-framework`; the running realm is `aws-framework` |
| Client authentication | **Off** (public) | A browser SPA cannot keep a secret |
| Standard flow | **On** | The login redirect |
| Direct access grants | On | Convenient for testing; not used by the app |
| Implicit flow | **Off** | Deprecated |
| PKCE method | **S256** | `useAuth` initialises with `pkceMethod: 'S256'`; a public client without PKCE is the flow this protects against |
| Valid redirect URIs | `http://localhost:5176/account` **and** `http://localhost:5176/account/*` | See below |
| Web origins | `http://localhost:5176` | CORS for the token endpoint |
| Valid post-logout redirect URIs | `http://localhost:5176/account` **and** `http://localhost:5176/account/*` | See below |
| **Audience mapper** | adds `aws-framework-backend` to the access token | **Without it every API call fails.** See below |
| Login theme | `account-user` | The branded member login page in [`infrastructure/keycloak/themes/account-user`](../infrastructure/keycloak/themes/account-user), already mounted into the container by `docker-compose.yml`. Styled to match the account app's own MUI theme so the member does not cross a visual boundary between the gateway and the login page — see that theme's README |

### Both redirect URI forms are required, not belt-and-braces

The app is served under a base path — `base: '/account'` in
[`vite.config.ts`](../packages/account-shell/vite.config.ts) — so every URL it uses starts
`/account`. Two different values are sent to Keycloak:

- `login()` and `register()` send `…/account/:orgCode`, matched by `…/account/*`;
- `logout()` sends exactly `…/account`, with **no trailing slash**.

Keycloak's `/*` wildcard matches the prefix *and a separator*, so `…/account/*` alone does not match
a bare `…/account`. Registering only the wildcard leaves login working and **logout failing** with
"Invalid redirect uri" — a failure that only shows up once someone signs out, which is exactly when
it is least expected.

### The audience mapper is not optional

The backend verifies every bearer token with `jwt.verify(..., { issuer, audience: config.clientId })`
where `config.clientId` is `KEYCLOAK_CLIENT_ID` — **`aws-framework-backend`**
([`auth.middleware.ts`](../packages/backend/src/middleware/auth.middleware.ts)).

A token minted for `account-app` does not carry that audience by default; its `aud` is just
`account`. So without an audience mapper the flow fails in a way that looks like nothing to do with
Keycloak at all: sign-in succeeds, the token endpoint returns a valid token, public endpoints work —
and then every authenticated call returns

```json
{"error":{"code":"UNAUTHORIZED","message":"Invalid token"}}
```

`orgadmin-client` has had this mapper all along, which is why the org-admin app works; it is the
easiest thing to miss when creating a new client by hand, because nothing about the client's own
settings hints at it.

Verify it without needing a password:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/admin/realms/aws-framework/clients/$CLIENT_UUID/evaluate-scopes/generate-example-access-token?userId=$USER_ID&scope=openid" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('aud'))"
# expect: ['aws-framework-backend', 'account']
```

## Creating it through the admin console

1. Go to <http://localhost:8080> → **Administration Console**, sign in as `admin` / `admin`
   (from `docker-compose.yml`).
2. Switch the realm selector to **`aws-framework`**.
3. **Clients** → **Create client**:
   - Client type `OpenID Connect`, Client ID `account-app` → **Next**
   - Client authentication **Off**, Standard flow **On**, Implicit **Off** → **Next**
   - Valid redirect URIs: add both `http://localhost:5176/account` and
     `http://localhost:5176/account/*`
   - Web origins: `http://localhost:5176`
   - Valid post-logout redirect URIs: the same two values → **Save**
4. On the client's **Advanced** tab, set **Proof Key for Code Exchange Code Challenge Method** to
   `S256`.
5. On the client's **Settings** tab, set **Login theme** to `account-user`.
6. On the client's **Client scopes** tab → `account-app-dedicated` → **Add mapper** → **By
   configuration** → **Audience**:
   - Name: `backend-audience`
   - Included Client Audience: `aws-framework-backend`
   - Add to access token: **On**

## Creating it from the command line

Equivalent, and the faster path when rebuilding an environment:

```bash
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "http://localhost:8080/admin/realms/aws-framework/clients" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "clientId": "account-app",
    "name": "Account User Application",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "implicitFlowEnabled": false,
    "frontchannelLogout": true,
    "redirectUris": ["http://localhost:5176/account", "http://localhost:5176/account/*"],
    "webOrigins": ["http://localhost:5176"],
    "attributes": {
      "login_theme": "account-user",
      "post.logout.redirect.uris": "http://localhost:5176/account##http://localhost:5176/account/*",
      "pkce.code.challenge.method": "S256"
    }
  }'
```

Then add the audience mapper, without which every authenticated request is rejected:

```bash
CLIENT_UUID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/admin/realms/aws-framework/clients?clientId=account-app" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")

curl -s -X POST \
  "http://localhost:8080/admin/realms/aws-framework/clients/$CLIENT_UUID/protocol-mappers/models" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "name": "backend-audience",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-audience-mapper",
    "consentRequired": false,
    "config": {
      "included.client.audience": "aws-framework-backend",
      "id.token.claim": "false",
      "access.token.claim": "true",
      "introspection.token.claim": "true",
      "userinfo.token.claim": "false"
    }
  }'
```

`post.logout.redirect.uris` takes **`##`** as its separator, not a comma — a comma is stored
verbatim and matches nothing.

## Verifying

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/realms/aws-framework/protocol/openid-connect/auth?client_id=account-app&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Flocalhost%3A5176%2Faccount"
```

`302` means the client resolved. If the body contains **"Client not found"**, it does not exist in
this realm — check the realm selector, since creating it in `master` by accident looks identical
from the app's side.

## Running the app

```bash
npm run dev:account     # http://localhost:5176/account
```

**The `/account` base path is part of the URL.** `http://localhost:5176/` alone serves nothing;
`http://localhost:5176/account` is the organisation directory (A1) and
`http://localhost:5176/account/<url-code>` is a club's gateway (A2).

## Deploying elsewhere

Redirect URIs, web origins and post-logout URIs are all absolute. A deployed environment needs its
own values added to the same client — or its own client — and `VITE_KEYCLOAK_URL`,
`VITE_KEYCLOAK_REALM` and `VITE_KEYCLOAK_CLIENT_ID` set to match
([`.env.example`](../packages/account-shell/.env.example)).

## The second client: `account-password-check`

Members change their password and email address inside the app rather than on Keycloak's own pages
([ACCOUNT_SELF_SERVICE_CREDENTIALS.md](ACCOUNT_SELF_SERVICE_CREDENTIALS.md)). Both changes require
the member's **current** password, and Keycloak's Admin API can set a password but cannot verify
one — the only way to check is to attempt a login, which needs a client with direct access grants.

**`npm run seed` creates it**, so a development machine needs nothing done by hand. Unlike the four
clients above, it is also *reconciled* on every run: a client whose direct grants were switched off,
or whose secret drifted, fails at the worst possible moment — a member typing their correct password
and being told it is wrong.

| Setting | Value | Why |
|---|---|---|
| Client authentication | **On** (confidential) | The whole point. A public client needs no secret, so direct grants there would let anyone post username-and-password pairs at the token endpoint |
| Direct access grants | **On** | The password check |
| Standard flow | **Off** | It must not be able to sign anyone in |
| Implicit flow | **Off** | " |
| Service accounts | **Off** | It needs no rights of its own; the Admin API work is done by the admin client |
| Redirect URIs | *none* | Nothing ever redirects to it |

Do **not** enable direct access grants on `account-app` instead. It is public by necessity — a
browser cannot keep a secret — and the grant would then be open to anyone.

### The backend needs the secret

```bash
KEYCLOAK_PASSWORD_CHECK_CLIENT_ID=account-password-check
KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET=<the client's secret>
```

**Unset, every password check fails.** Keycloak answers a confidential client presenting no secret
with the same `401` it uses for a wrong password, so the symptom is every member being told the
password they just typed correctly is wrong. The service refuses to run without it and logs the
missing variable by name rather than letting that happen.

The seed's development default is `account-password-check-dev-secret`, and it refuses to run against
a non-local Keycloak. **A deployed environment must set its own secret** on both the client and the
backend.

### Checking it

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "$KEYCLOAK_URL/realms/aws-framework/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=account-password-check \
  -d client_secret="$KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET" \
  -d username=<a member's email> -d password=<their password> -d scope=openid
```

`200` with the correct password, `401` with a wrong one — and `401` if the secret is missing, which
is exactly why the backend checks for it rather than trusting the status code.
