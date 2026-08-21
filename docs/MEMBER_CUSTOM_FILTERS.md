# Saved filters over the members database

A club with two thousand members asks the same handful of questions every month:
who has lapsed, who is due to renew before the show, who is tagged as a
committee member. A **custom filter** is that question, named and kept.

---

## 0. What was there before

Reported as: *"Twice now I have tried to create a new filter on the Members
Database, but each time, after I created the filter there was nothing in the
Custom Filter dropdown list."*

It was not intermittent and it was not the club's doing. The feature was three
separate stubs that together looked finished:

| Piece | State |
|---|---|
| `CreateCustomFilterDialog` | Collected a full, valid filter and handed it to `onSave` |
| `MembersDatabasePage.onSave` | **Ignored the payload.** Closed the dialog and reloaded the list |
| `POST /api/orgadmin/member-filters` | **Did not exist** |
| `GET /api/orgadmin/member-filters` | `// For now, return empty array` — `return res.json([])` |
| Selecting a filter | `if (selectedCustomFilter) { // Custom filter logic would go here }` |

`member_filters` had existed since its migration with **zero rows**, and could
not have had any: nothing in the system could write one. The dropdown was
therefore empty every time, and would have been for every club.

The lesson worth keeping is how *complete* it looked from the outside — a real
dialog, a real table, a real menu, and a route that answered `200`. An empty
list is a plausible answer, which is what let three stubs sit undetected.

---

## 1. Whose filter is it

The table carries both `organisation_id` and `user_id`, and the reading is
**organisation-wide**: a filter saved by one administrator is visible to every
administrator of that club. `user_id` records who made it, not who may see it.

That is the useful behaviour — a committee shares its questions, and a secretary
going on holiday does not take the club's saved filters with them. If
per-administrator privacy is ever wanted it belongs as an explicit `shared`
flag, not as a silent scoping rule.

---

## 2. The API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/orgadmin/member-filters` | This organisation's filters, by name |
| `POST` | `/api/orgadmin/member-filters` | Saves one; `201` with the filter as stored |
| `DELETE` | `/api/orgadmin/member-filters/:id` | `204`, or `404` for a filter in another club |

All three are organisation-scoped by the standard middleware.
`byCurrentOrganisation()` also resolves `req.organisationUserId`, which the
`user_id` column requires — absent, the insert fails at the database, so the
route checks first and answers `400` rather than `500`.

Creates and deletes are audited (`entityType: 'member-filter'`).

### Values that reach a `date` column

The dialog sends whatever its picker produced: a `Date`, an ISO timestamp, or —
for a field left alone — an empty string. An empty string cast to `date` is an
error, not "no bound", so `dateOrNull` normalises all three and keeps only the
day. A renewal bound is a day; keeping a time would make "renewed before the
1st" depend on what o'clock the filter was saved at.

Reading back has the mirror-image trap. `date` columns arrive as `Date` objects
at **local** midnight, and `toISOString()` converts to UTC first — so a bound
saved as the 1st reads back as the 31st of the month before, anywhere east of
Greenwich. `asDateString` takes the local parts instead.

---

## 3. Applying a filter

In the browser, over the members already loaded. Four clauses, each a narrowing:

| Clause | Behaviour |
|---|---|
| `memberStatus` | Member's status is one of the chosen |
| `memberLabels` | Member has **any** of the chosen labels — "Committee or Junior" is the useful question |
| `dateLastRenewed` | Within the before/after bounds |
| `validUntil` | Within the before/after bounds |

**An empty clause narrows nothing.** A filter that names no status matches every
status rather than none, which is what somebody means by leaving the field
alone. The alternative — an empty list matching nothing — would make a
half-filled filter return zero members and look broken.

Bounds are compared as days, inclusive on `after` and exclusive on `before`,
matching how the two words read. A member with no date at all fails a *bounded*
comparison rather than passing it: "renewed before June" should not include
somebody who has never renewed.

After saving, the new filter is selected automatically — somebody who has just
described a filter wants to see it applied.

---

## 4. When a save fails

`useApi.execute` resolves to `null` on failure rather than throwing. Left
unchecked, a refused save would close the dialog and reload a list that had not
changed — which is indistinguishable from success, and is exactly what the
original bug looked like. The page checks, and says so.

---

## 5. Deleting

A bin icon sits beside the dropdown and appears **only once a filter is
chosen** — a permanently-present delete button next to a dropdown reading "None"
has nothing to act on, and invites the question of what it would remove.

It confirms first, naming the filter and saying plainly that it goes for
*every* administrator, since that is what organisation-wide sharing means and it
is not obvious from a screen showing one person's view.

Two details that matter more than they look:

- **A 204 and a failure both resolve to `null`.** `execute` cannot distinguish
  them from the response, so the handler passes `onError` and reads that
  instead. Without it a refused delete would remove the filter from the screen
  and leave it on the server — the screen and the database quietly disagreeing.
- **The selection is cleared on success.** Left set, the roster would stay
  narrowed by a filter that no longer exists, with the dropdown showing nothing
  to explain why.

The deletion is audited, and the record carries the filter's values — what it
matched is the interesting part of a filter that is gone.

---

## 6. Not built

- **No editing.** Save a new one and delete the old.
- **Filtering is client-side**, over the members already loaded. That is right
  while the page loads the whole roster; if it ever paginates server-side, the
  filter has to move to the query with it.
