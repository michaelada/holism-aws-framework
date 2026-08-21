# Wireframes — platform posts

See [PLATFORM_POSTS.md](PLATFORM_POSTS.md) for the rules behind these.

## 1. A login page, wide (≥600px)

Both Keycloak themes and the account gateway share this shape. Sign-in on the
left, announcements on the right, in the arranged order.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│            [ logo ]                    ┌──────────────────────────────────┐  │
│        ItsPlainSailing                 │ ┌──────────────────────────────┐ │  │
│                                        │ │                              │ │  │
│   ┌────────────────────────────┐       │ │          image 16:9          │ │  │
│   │  Organisation Admin Login  │       │ │                              │ │  │
│   │                            │       │ └──────────────────────────────┘ │  │
│   │  Email                     │       │  Lodgements are here             │  │
│   │  [______________________]  │       │  Payments now reconcile to the   │  │
│   │                            │       │  lodgement that landed in your   │  │
│   │  Password                  │       │  bank account.                   │  │
│   │  [______________________]  │       │  [ WHAT CHANGED ]                │  │
│   │                            │       └──────────────────────────────────┘  │
│   │      [   Sign In   ]       │       ┌──────────────────────────────────┐  │
│   │                            │       │  Planned maintenance             │  │
│   │  New user?  Create Account │       │  We will be unavailable on       │  │
│   └────────────────────────────┘       │  Sunday.                         │  │
│                                        │  [ STATUS PAGE ]                 │  │
│                                        └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
        1fr                   gap 48px             1fr
     (~552px each at the 1200px cap; the cards are capped at
      440px and centred in their half, so the even split is
      the page's, not the card's)
```

The card order is fixed and is the whole design: **image, title, message,
links**. A reader on a login page is not there to read announcements, so a post
has one chance to be understood while being skimmed past.

## 2. Narrow (<600px)

Stacked, sign-in first. Somebody on a phone came here to sign in.

```
┌────────────────────────────┐
│         [ logo ]           │
│      ItsPlainSailing       │
│  ┌──────────────────────┐  │
│  │  Member Login        │  │
│  │  Email               │  │
│  │  [________________]  │  │
│  │  Password            │  │
│  │  [________________]  │  │
│  │    [  Sign In  ]     │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │  [    image     ]    │  │
│  │  Lodgements are here │  │
│  │  Payments now …      │  │
│  │  [ WHAT CHANGED ]    │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │  Planned maintenance │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

## 3. No posts — every surface, unchanged

The layout collapses entirely rather than leaving an empty column. This is the
state of every deployment until somebody writes the first post.

```
┌──────────────────────────────────────────────────────────────┐
│                         [ logo ]                             │
│                     ItsPlainSailing                          │
│                ┌────────────────────────┐                    │
│                │    Member Login        │                    │
│                │    Email               │                    │
│                │    [______________]    │                    │
│                │    Password            │                    │
│                │    [______________]    │                    │
│                │      [ Sign In ]       │                    │
│                └────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
        centred, exactly as before this feature existed
```

## 4. Platform Admin — the list

Order is the content, so this is an arranged list rather than a sortable table.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Posts                                                      [ + New post ]   │
│  Announcements shown on the account and org admin login pages, in the        │
│  order they appear.                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ▲  ┌────────┐  Lodgements are here                            👁  ✎  🗑     │
│  ▼  │ image  │  [Active] [Org admin login] [1 link]                          │
│     └────────┘                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ▲              Find events near you                           👁  ✎  🗑     │
│  ▼              [Active] [Account login] [2 links]                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  ▲              Planned maintenance                            👁  ✎  🗑     │
│  ▼              [Active] [Account login] [Org admin login] [1 link]          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ▲              Terms update (draft)                           👁  ✎  🗑     │
│  ▼              [Inactive] [Not shown]                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

`▲` is disabled on the first row and `▼` on the last — present but disabled, so
a row does not change shape as it moves through the list. Each move saves the
whole arrangement immediately.

The chips answer "is anyone seeing this?", which `Active` alone does not.

## 5. Platform Admin — writing a post

```
┌──────────────────────────────────────────────────────────────┐
│  ← Posts                                                     │
│  New post                                                    │
├──────────────────────────────────────────────────────────────┤
│  Title *                                                     │
│  [__________________________________________________]        │
│                                                              │
│  Message                                                     │
│  ┌────────────────────────────────────────────────────┐      │
│  │ B  I  U │ H2 H3 │ • ≡ │ 🔗 │ ✕                     │      │
│  ├────────────────────────────────────────────────────┤      │
│  │ We will be unavailable on Sunday.                  │      │
│  └────────────────────────────────────────────────────┘      │
├──────────────────────────────────────────────────────────────┤
│  Image                                                       │
│  Optional. Served publicly, so use nothing that should not   │
│  be seen by someone who has not signed in.                   │
│  ┌──────────────┐                                            │
│  │   preview    │   [ Choose a different image ] [ Remove ]  │
│  └──────────────┘                                            │
├──────────────────────────────────────────────────────────────┤
│  Links          Shown as a row of buttons under the message.  │
│  [ Display text ] [ https://…                    ]  🗑        │
│  [ Display text ] [ https://…                    ]  🗑        │
│  + Add a link                                                │
├──────────────────────────────────────────────────────────────┤
│  Status  [ Active ▾ ]                                        │
│  Only active posts appear on a login page.                   │
│  ──────────────────────────────────────────                  │
│  Where it appears                                            │
│  [x] Show on all account login pages                         │
│  [ ] Show on all org admin login pages                       │
│                                                              │
│                               [ Cancel ]  [ Create post ]    │
└──────────────────────────────────────────────────────────────┘
```

An active post ticked for neither page is allowed, and says so rather than being
refused:

```
│  ⓘ This post is active but is not shown on either login      │
│    page, so nobody will see it yet.                          │
```

The toolbar is deliberately short. The body renders into two themes the author
cannot see while writing, and the server's sanitiser allows roughly this set and
no more — so offering colours and font sizes would be offering formatting that
is silently dropped.
