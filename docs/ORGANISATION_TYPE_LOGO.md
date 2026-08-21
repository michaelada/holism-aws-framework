# A shared logo for an organisation type

A federation has one mark. Before this, every branch uploaded its own copy of
it: the same file stored twenty times, twenty chances for somebody to be a
version behind, and no way to change it centrally at a rebrand.

A super admin can now set a logo on the **organisation type**. Every
organisation of that type inherits it, and the type decides whether a club may
replace it with its own.

## The rule

`effectiveLogo` in `organization-branding.service.ts`. One function, used by
every reader, because the alternative is each screen working it out again and
one of them getting it wrong — and "wrong" here means a club showing another
club's mark, or a rebrand not reaching half the branches.

The order **is** the feature:

1. **A locked type logo wins outright.** That is what "may not be overridden"
   means. It has to beat a logo the club already uploaded, or locking a type
   brings into line only the clubs that were already conforming.
2. Otherwise, the organisation's own logo — uploaded, or an external URL it
   points at.
3. Otherwise, the type's logo, inherited as a default.
4. Otherwise nothing, and the shell renders the organisation's initial.

**The flag only bites when the type actually has a logo.** With no shared mark
there is nothing to protect, and honouring `allowLogoOverride: false` literally
would leave every club in that type unable to have any logo at all — a dead
configuration a super admin can reach by ticking one box. The Platform Admin
screen says so out loud rather than letting it happen silently.

## Data

Two columns on `organization_types`
(`1709000000035_organisation-type-logo.js`):

| Column | Notes |
|---|---|
| `logo_s3_key` | The key, not a URL. The bucket blocks public access, so the only readable form is a signed URL and a signed URL expires. Readers sign on demand, exactly as an organisation's own logo already is |
| `allow_logo_override` | `NOT NULL DEFAULT true` — today's behaviour, so the migration changes nothing for anybody until a type logo is uploaded |

Keys live under `organisation-types/<id>/…`, deliberately **not** under
`organisations/…`: the object belongs to the type, outlives any one club, and
must not be reachable by the branding endpoint's key check, which confines an
organisation to its own prefix.

## Where it is enforced

**Not only by hiding the upload.** The branding screen removes the control when
a club may not override, but a screen is not a rule: the endpoint is reachable
from a console, and a club that had a logo before the type was locked will keep
posting it back with every colour change. `updateBrandingSettings` clears the
logo rather than refusing the whole request — colours and the bookings label
still save, and a stored value that is never shown is a trap for whoever reads
the row next.

Verified end to end: posting a logo key while locked returns `logoSource:
organisation-type`, keeps the posted colour, and leaves the stored key empty.

## What each screen shows

| Surface | Behaviour |
|---|---|
| Platform Admin → Organisation Types → *Shared logo* | Upload, remove, and the "Organisations may replace this with their own logo" checkbox. Unticking it warns that clubs' own logos stop being shown |
| Org Admin → Settings → Branding | The inherited logo with "Inherited from your organisation type" where overriding is allowed; the upload **removed** and "This logo is set by your organisation type and cannot be changed here" where it is not |
| Account app | Members see whatever the rule resolves to — the same signed URL the org-admin screen shows |

The org-admin upload is *removed* rather than disabled: a greyed-out button
invites a click and then explains nothing, while its absence beside a sentence
says what is actually true.

`Remove logo` is keyed off the logo's **source**, not off `logoS3Key`. A club
that points `logoUrl` at its own externally-hosted logo has no key, and testing
for one stranded it with no way to clear what it had set — a regression an
existing test caught.

## Read-only fields on the branding payload

`getBrandingSettings` returns two fields that are never stored:

- `logoSource` — `organisation` | `organisation-type` | `none`
- `canOverrideLogo` — false only where the type supplies a mark it will not let
  the club replace

Derived on every read, because persisting them would leave a row claiming a club
may override its logo long after its type stopped permitting it.

`updateBrandingSettings` derives them from the policy it already fetched rather
than re-reading the row, so a colour change costs one extra query rather than
two.

## Tests

| What | Where |
|---|---|
| The four-branch rule, the dead configuration, the null-policy default | `backend/src/services/__tests__/organization-branding.service.test.ts` |
| The branding screen in both states, and the external-logo case | `orgadmin-core/src/settings/components/__tests__/BrandingTab.test.tsx` |

The service tests were also made positional-independent: they had asserted on
`mock.calls[0]`, which broke the moment a policy lookup ran before the update —
a failure that says nothing about the behaviour under test.
