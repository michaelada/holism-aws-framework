# Routing Fix: URL Doubling Issue (/orgadmin/orgadmin)

## Problem

When clicking navigation buttons (e.g., "+ Create Form" in the Form Builder), the URL was doubling the `/orgadmin` prefix, resulting in URLs like `/orgadmin/orgadmin/forms/new` instead of `/orgadmin/forms/new`, which caused 404 errors.

## Root Cause

The application uses `BrowserRouter` with `basename="/orgadmin"`, which means all routes are automatically prefixed with `/orgadmin`. However, navigation handlers throughout the application were using absolute paths that included `/orgadmin` (e.g., `navigate('/orgadmin/forms/new')`), causing the basename to be added twice.

## Solution

Fixed all navigation calls across the application to use paths relative to the basename:

### Before (Broken):
```typescript
navigate('/orgadmin/forms/new');  // ❌ Results in /orgadmin/orgadmin/forms/new
```

### After (Fixed):
```typescript
navigate('/forms/new');  // ✅ Results in /orgadmin/forms/new
```

## Files Modified

### Core Modules (packages/orgadmin-core/src/):
1. `forms/pages/FormsListPage.tsx` - Fixed create, edit, and preview navigation
2. `forms/pages/FormBuilderPage.tsx` - Fixed save and cancel navigation
3. `forms/pages/FormPreviewPage.tsx` - Fixed back navigation (2 instances)
4. `users/pages/OrgAdminUsersListPage.tsx` - Fixed tab navigation
5. `users/pages/AccountUsersListPage.tsx` - Fixed tab navigation
6. `payments/pages/PaymentDetailsPage.tsx` - Fixed back navigation
7. `payments/pages/LodgementsPage.tsx` - Fixed back navigation
8. `reporting/pages/RevenueReportPage.tsx` - Fixed back navigation
9. `reporting/pages/EventsReportPage.tsx` - Fixed back navigation
10. `reporting/pages/MembersReportPage.tsx` - Fixed back navigation

### Capability Modules:

#### Events (packages/orgadmin-events/src/pages/):
11. `EventsListPage.tsx` - Fixed create event navigation
12. `CreateEventPage.tsx` - Fixed save and cancel navigation
13. `EventDetailsPage.tsx` - Fixed delete and back navigation

#### Memberships (packages/orgadmin-memberships/src/pages/):
14. `MembershipTypesListPage.tsx` - Fixed create single/group navigation
15. `CreateSingleMembershipTypePage.tsx` - Fixed save and cancel navigation
16. `CreateGroupMembershipTypePage.tsx` - Fixed save and cancel navigation
17. `MembershipTypeDetailsPage.tsx` - Fixed delete and back navigation
18. `MemberDetailsPage.tsx` - Fixed back navigation

#### Merchandise (packages/orgadmin-merchandise/src/pages/):
19. `MerchandiseTypesListPage.tsx` - Fixed create type navigation
20. `CreateMerchandiseTypePage.tsx` - Fixed save and cancel navigation
21. `MerchandiseTypeDetailsPage.tsx` - Fixed delete navigation

#### Calendar (packages/orgadmin-calendar/src/pages/):
22. `CalendarsListPage.tsx` - Fixed create calendar navigation
23. `CreateCalendarPage.tsx` - Fixed save and cancel navigation
24. `CalendarDetailsPage.tsx` - Fixed view bookings navigation

#### Registrations (packages/orgadmin-registrations/src/pages/):
25. `RegistrationTypesListPage.tsx` - Fixed create type navigation
26. `CreateRegistrationTypePage.tsx` - Fixed save and cancel navigation
27. `RegistrationTypeDetailsPage.tsx` - Fixed delete and back navigation
28. `RegistrationDetailsPage.tsx` - Fixed back navigation

## How It Works

With `BrowserRouter basename="/orgadmin"`:

**Old (Broken):**
- Code calls: `navigate('/orgadmin/forms/new')`
- React Router adds basename: `/orgadmin` + `/orgadmin/forms/new`
- Result: ❌ `/orgadmin/orgadmin/forms/new` (404 error)

**New (Fixed):**
- Code calls: `navigate('/forms/new')`
- React Router adds basename: `/orgadmin` + `/forms/new`
- Result: ✅ `/orgadmin/forms/new` (correct URL)

## Testing

After the fix, all navigation should work correctly:
1. Navigate to any module (Forms, Events, Memberships, etc.)
2. Click any navigation button (Create, Edit, Back, etc.)
3. URLs should be correct without doubling `/orgadmin`
4. No 404 errors should occur

## Related Changes

This fix complements the earlier route definition changes where module routes were updated from absolute paths (e.g., `/forms/new`) to relative paths (e.g., `forms/new`). Together, these changes ensure consistent routing behavior throughout the application.

## Related Documentation

- React Router v6 Basename: https://reactrouter.com/en/main/router-components/browser-router#basename
- React Router v6 Navigate: https://reactrouter.com/en/main/hooks/use-navigate

---

**Date:** February 13, 2026  
**Fixed by:** Kiro AI Assistant  
**Status:** ✅ RESOLVED - All navigation calls fixed across all modules
