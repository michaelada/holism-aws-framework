# @itsplainsailing/orgadmin-announcements

A club's own announcements, shown to its members on the account application's home page.

- **Capability:** `org-announcements`
- **Menu:** Announcements → `/orgadmin/announcements`
- **Docs:** [../../docs/ORG_ANNOUNCEMENTS.md](../../docs/ORG_ANNOUNCEMENTS.md),
  [wireframes](../../docs/ORG_ANNOUNCEMENTS_WIREFRAMES.md),
  [module summary](../../.claude/modules/orgadmin-announcements.md)

```bash
npm run dev:orgadmin-announcements
npm run test:orgadmin-announcements
```

The member's card (`AnnouncementCard`) lives in `packages/components`, because this module's editor
previews with the very same component the account application renders.
