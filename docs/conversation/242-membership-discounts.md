# Uncaught SyntaxError: The requested module '/or...

Exported: 02/03/2026, 19:13:36

---

**User:**

I can load the org admin ui, its showing the error in the console 
Uncaught SyntaxError: The requested module '/orgadmin/index.ts?t=1772472526786' does not provide an export named 'useCapabilities' (at CreateSingleMembershipTypePage.tsx:36:10)

---

**Assistant:**

I can see you're getting a module import error. Let me investigate the issue with the `useCapabilities` export.

Now I can see the issue. The package.json shows that the main export is `./index.ts`, but there's no `index.ts` file in the `src` directory. The `useCapabilities` is exported from `./context/index.ts`, but the package is trying to import from the root.

Let me check if there's an index.ts at the package root:

Found it! The `index.ts` file exists but doesn't export `useCapabilities`. It's available in `src/context/index.ts` but not re-exported from the root `index.ts`. 

This is a simple fix - I need to add the export to the root index.ts file. Let me fix this:

Fixed! The `useCapabilities` hook is now exported from the orgadmin-shell package. The error should be resolved once the dev server picks up the change. If you're running the dev server, it should hot-reload automatically.

---

**User:**

On the members module, in the org admin UI, I can see the Discounts sub-menu option even though the organisation tat I am logged into does not have this capability. The sub menu shiouold not be shown if the organisation doesn't have the capability, and the discount options should not be displayed for membership types or events if the organisation doesn't have the membership-discount or event-discount capabiity.

---

**Assistant:**

I understand the issue. You need capability-based visibility for discount features across the application. Let me investigate where the navigation menus are defined and how discount sections are displayed.

Good! I can see the menu item already has `capability: 'entry-discounts'` defined. Now let me check how the shell application handles capability-based menu visibility:

Perfect! Let me read the Layout component to see the capability filtering logic:

Great! The capability filtering is already implemented in the Layout component. The issue is that it's checking `organisation?.enabledCapabilities`, but we need to verify if the `useOrganisation` hook is properly providing this data. Let me check:

Now let me check what the organisation object structure looks like and verify the enabledCapabilities field:

Perfect! The `Organisation` interface has `enabledCapabilities: string[]`. The capability filtering logic in the Layout component looks correct. The issue might be that the organisation data isn't being loaded properly or the capabilities aren't being set correctly. Let me check how the organisation data is fetched in the shell app:

Now let me check the App.tsx to see how the organisation data is fetched:

Let me check the useAuth hook to see how organisation data is fetched:

I can see the issue! In development mode (when `VITE_DISABLE_AUTH === 'true'`), the mock organisation has `enabledCapabilities` set to include many capabilities, but then `setCapabilities` is called with only `['event-management', 'memberships']`. This creates a mismatch.

However, the real issue is that the Layout component is checking `organisation?.enabledCapabilities` but it should be checking the `capabilities` from the CapabilityProvider instead. Let me verify this and create a spec to fix the issue properly.

Based on my analysis, I can see there are multiple issues:

1. The Layout component checks `organisation?.enabledCapabilities` for submenu items
2. The mock data in useAuth has mismatched capabilities
3. The capability checking should be consistent across the app

Let me create a spec to fix this properly:

### Sub-Agent: Bugfix Workflow

**Explanation:** Delegating to the bugfix workflow subagent to create a spec for fixing the capability-based visibility issue where discount menu items and sections are shown even when the organisation doesn't have the required capabilities

**Prompt:**

Fix the capability-based visibility bug for discount features in the org admin UI.

**Bug Description:**
The Discounts submenu item is visible in the Members module navigation even when the organisation doesn't have the 'entry-discounts' capability. Additionally, discount sections are displayed in membership type and event creation/edit pages when the organisation doesn't have the required capabilities.

**Current Behavior:**
- Discounts submenu appears in Members module for all organisations
- Discount selector sections appear in CreateSingleMembershipTypePage and CreateEventPage regardless of capability
- The Layout component checks `organisation?.enabledCapabilities` for submenu filtering
- The capability checking is inconsistent across the application

**Expected Behavior:**
- Discounts submenu should only appear when organisation has 'entry-discounts' capability
- Discount sections in forms should only appear when organisation has the module-specific discount capability ('membership-discounts' for memberships, 'event-discounts' for events)
- Capability checking should be consistent across the application

**Affected Files:**
- packages/orgadmin-shell/src/components/Layout.tsx (submenu filtering)
- packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx (discount section visibility)
- packages/orgadmin-events/src/pages/CreateEventPage.tsx (discount section visibility)
- packages/orgadmin-shell/src/hooks/useAuth.ts (mock data mismatch)

**Feature Name:** capability-based-discount-visibility-fix

**Response:**

Created bugfix requirements document for capability-based discount visibility fix. The document defines the bug condition (organizations without 'entry-discounts' capability), specifies the expected behavior (hide discount UI elements), and identifies preservation requirements (maintain visibility for organizations with the capability). User approved to proceed to next phase.

Great! The bugfix requirements document has been created. Now let's proceed to the design phase:

### Sub-Agent: Bugfix Workflow

**Explanation:** Delegating to the bugfix workflow subagent to create the design document for the capability-based discount visibility fix

**Prompt:**

Continue with the design phase for the capability-based-discount-visibility-fix spec. Create the design document that specifies how to fix the capability checking for discount UI elements.

**Response:**

Created the design document for the capability-based-discount-visibility-fix spec. The design identifies that CreateEventPage and EditEventPage are missing the capability check for 'entry-discounts' before rendering the discount selector, while membership forms and navigation already implement this correctly. The fix requires importing useCapabilities hook and adding hasCapability('entry-discounts') to the conditional rendering logic.

Perfect! Now let's proceed to create the tasks:

### Sub-Agent: Bugfix Workflow

**Explanation:** Delegating to the bugfix workflow subagent to create the tasks document for implementing the capability-based discount visibility fix

**Prompt:**

Continue with the tasks phase for the capability-based-discount-visibility-fix spec. Create the implementation tasks based on the design document.

**Response:**

Created implementation tasks for capability-based-discount-visibility-fix spec. The task list follows the bugfix workflow with exploration test (Property 1: Fault Condition), preservation tests (Property 2: Preservation), implementation in both CreateEventPage and EditEventPage, and verification steps. Tasks reference the design specifications and include proper annotations for requirements validation.

Perfect! The bugfix spec has been created successfully. The spec includes:

1. **Bugfix Requirements** - Defines the bug condition (discount UI elements visible without capability), expected behavior (hide when capability missing), and preservation requirements (maintain existing correct behavior)

2. **Design Document** - Identifies the root cause (missing useCapabilities hook and capability checks in event pages), specifies the fix implementation, and outlines the testing strategy

3. **Implementation Tasks** - Provides a step-by-step plan following the bugfix workflow methodology with exploration tests, preservation tests, implementation, and verification

The spec is ready for implementation. Would you like me to execute the tasks to fix the bug?

---
