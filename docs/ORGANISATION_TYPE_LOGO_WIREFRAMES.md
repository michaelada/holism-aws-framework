# Wireframes — a shared logo for an organisation type

See [ORGANISATION_TYPE_LOGO.md](ORGANISATION_TYPE_LOGO.md) for the rule.

## 1. Platform Admin — Organisation Types → Shared logo

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Shared logo                                                             │
│  Inherited by every organisation of this type. A federation has one      │
│  mark; without this each branch uploads its own copy of it.              │
│                                                                          │
│  Optional. Every organisation of this type shows this logo unless it     │
│  sets one of its own.                                                    │
│                                                                          │
│  ┌────────────┐                                                          │
│  │            │                                                          │
│  │    mark    │   [ Choose a different logo ]  [ Remove logo ]           │
│  │            │                                                          │
│  └────────────┘                                                          │
│                                                                          │
│  [x] Organisations may replace this with their own logo                  │
└──────────────────────────────────────────────────────────────────────────┘
```

Unticked, the consequence is spelled out — it is the part an operator is least
likely to have thought through:

```
│  [ ] Organisations may replace this with their own logo                  │
│                                                                          │
│  ⚠ Every organisation of this type will show the shared logo, and the    │
│    upload control is removed from their branding settings. Any logo a    │
│    club has already uploaded stops being shown.                          │
```

And the dead configuration is named rather than silently worked around:

```
│  ┌────────────┐                                                          │
│  │  No logo   │   [ Choose a logo ]                                      │
│  └────────────┘                                                          │
│  [ ] Organisations may replace this with their own logo                  │
│                                                                          │
│  ⓘ There is no shared logo to inherit, so organisations keep control of  │
│    their own until you upload one.                                       │
```

On the **create** screen the type has no id yet, so the file is held and
uploaded straight after saving:

```
│  ⓘ The logo is uploaded when you save this organisation type.            │
```

## 2. Org Admin — Settings → Branding, overriding allowed

The inherited mark is shown, and the club may replace it. The hint says where
it came from instead of the usual size advice.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Logo                                                                    │
│                                                                          │
│  ┌────────────┐                                                          │
│  │    mark    │   [ ⬆ Upload Logo ]                                      │
│  │ (inherited)│                                                          │
│  └────────────┘   Inherited from your organisation type. Upload your     │
│                   own to replace it.                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

No **Remove logo** here: the mark is not this club's to remove. It appears only
once the club has a logo of its own — uploaded, or an external URL it set.

## 3. Org Admin — Settings → Branding, overriding forbidden

The upload is **gone**, not greyed out.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Logo                                                                    │
│                                                                          │
│  ┌────────────┐                                                          │
│  │    mark    │   This logo is set by your organisation type and cannot  │
│  │ (inherited)│   be changed here.                                       │
│  └────────────┘                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

A greyed-out button invites a click and then explains nothing; its absence
beside a sentence says what is actually true. The colours and the bookings
label below are untouched — the lock is about the logo, so the rest of the
screen keeps working.

## 4. Unchanged — a club whose type has no shared logo

The overwhelmingly common case, and the one that must not regress.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Logo                                                                    │
│                                                                          │
│  ┌────────────┐                                                          │
│  │    logo    │   [ ⬆ Upload Logo ]  [ 🗑 Remove Logo ]                  │
│  └────────────┘   Recommended size: 200x200px, PNG or JPG                │
└──────────────────────────────────────────────────────────────────────────┘
```
