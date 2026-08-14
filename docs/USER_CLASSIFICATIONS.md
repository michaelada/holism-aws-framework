# User classifications in the Platform Admin user list

The **Type** column of the user list shows what a person *is* on the platform — at most three
chips — instead of the raw list of realm roles it used to show.

| Chip | Meaning |
|---|---|
| **Super Admin** | Operates the platform console |
| **Org-admin** | Administers one or more organisations |
| **Account** | A member of one or more organisations |

These are not mutually exclusive. The same person can administer one club and be a member of
another, and a platform operator can be both; every category that applies is shown, always in the
order above.

## Why the raw roles were the wrong thing to show

The column previously listed every Keycloak realm role a person held. That is detail, not
information: the names mean nothing without knowing the realm, the list grows without bound, and
two people with quite different reach on the platform can look identical. The question the list
actually has to answer — *who is this person here?* — took reading a row of chips and knowing what
each one implied.

The roles themselves have not gone anywhere; they are still on the `User` object and still what
authorisation is enforced against. They are simply no longer what the table leads with.

## How a classification is derived

Worked out by the backend in `user.service.ts`, because the front end has none of the inputs.

**Super Admin** — the `admin` realm role, which is what `requireAdminRole()` enforces.
`super-admin` also counts, since it appears in the development auth bypass.

**Org-admin and Account** — from two sources, unioned:

1. `organization_users.user_type`, which is `org-admin` or `account-user`. This is the record of
   who belongs where, so it is the authority.
2. The Keycloak group path. An organisation's group tree is `<org-type>/<org>/{admins,members}`,
   so a path ending `/admins` implies org-admin and one ending `/members` implies account.

Both are read because either can be complete on its own: someone invited through Keycloak may have
the group but no `organization_users` row yet, and a person whose groups have drifted is still
classified correctly from the table.

A user with none of the three — in Keycloak, in no organisation, holding no admin role — shows
`-`.

## Where it lives

| Piece | Location |
|---|---|
| `UserClassification` type, `resolveMembership`, `classifyUser` | `packages/backend/src/services/user.service.ts` |
| `classifications` field on the API's `User` | same file, `User` interface |
| Chip labels and colours | `packages/admin/src/types/admin.types.ts`, `components/UserList.tsx` |

The classification is computed wherever a `User` is built — both for people with a `users` row and
for the Keycloak-only majority who have none. See `docs/RETIRE_TENANTS.md` for why that second path
matters.
