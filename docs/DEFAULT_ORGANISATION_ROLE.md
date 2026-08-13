# Automatic "Full Administrator" role on organisation creation

Creating an organisation now provisions a **Full Administrator** role with `admin` on every
capability.

---

## 1. The gap this closes

`OrganizationAdminRoleService.createDefaultRoles()` already existed and looked as though it did this
— but a repo-wide search shows it was **never called from production code**, only from its own tests.
Creating an organisation therefore produced **no roles at all**, and there was no way to grant anyone
administrative access without hand-creating a role first.

## 2. What is created

| | |
|---|---|
| `name` | `full-administrator` — the stable identifier |
| `display_name` | `Full Administrator` |
| `capability_permissions` | `admin` on **every active capability** |
| `is_system_role` | `true` |

## 3. Every capability, not just the enabled ones

This is the decision worth understanding.

Access requires **both** that the organisation has a capability enabled **and** that the user's role
permits it. So granting `admin` on a capability the organisation does not have grants nothing today.

What it buys is that the role stays genuinely *full*. When a super admin later enables another
capability for the organisation, its Full Administrator can use it immediately. Snapshotting the
enabled set at creation would leave the role quietly unable to reach new features — exactly the
surprise its name promises against, and one that surfaces months later as "why can't the
administrator see the shop?".

## 4. Idempotent, and non-destructive

Migration `1709000000013` adds a unique key on `(organization_id, name)`; the insert is
`ON CONFLICT … DO NOTHING`. Without that key the insert could not be made idempotent, and any retry —
a failed transaction, a double-submitted form, a replayed request — would leave the organisation with
two identically named roles, with no way for an administrator to tell which was in force. Checked
before adding it: no existing rows violate the constraint.

`DO NOTHING` rather than `DO UPDATE` is deliberate: a club that has tightened its Full
Administrator's permissions should not have them silently reset by an unrelated retry.

## 5. A failure here is not swallowed

The payment-method initialisation immediately above it in `createOrganization` deliberately swallows
errors — an organisation without payment methods is still usable. This does not, because an
organisation with **no administrator role cannot have anyone granted access to it**. An unusable
organisation that reports itself as created successfully is worse than a visible failure: it looks
fine until somebody tries to invite an administrator and cannot.

## 6. Imported lazily

`organization-admin-role.service` already imports `organization.service`, so a static import the
other way is a cycle — one of the two ends up `undefined` at module-initialisation time depending on
load order. The call uses `await import(...)`, the same pattern used elsewhere in this codebase for
the same reason.

## 7. Not done

- **Existing organisations are not backfilled.** Only newly created ones get the role. There is one
  organisation in the development database and none in the test database, so this was not worth a
  data migration — but if you want existing organisations to have it, say so and it is a short,
  idempotent script.
- **Nobody is assigned to the role.** It is created, not granted; inviting an administrator and
  assigning them remains a separate action.
- **`createDefaultRoles()` is still unused.** It creates `admin` and `viewer` roles and is left in
  place rather than deleted, since it is tested and harmless — but it is not the path organisation
  creation takes. Worth deleting or reconciling if it is not wanted.
