# Run all tasks: .kiro/specs/document-management-capability-consolidation/tasks.md (Continued) (Continued) (Continued) (Continued)

Exported: 03/03/2026, 20:16:38

---

**User:**

## SUMMARY OF CONVERSATION

## TASK 1: Document Management Capability Consolidation - Migration Issue

**STATUS**: done

**USER QUERIES**: 1-7 (migration errors and troubleshooting)

**DETAILS**: 
The user reported that the Super Admin UI still displayed three separate document management capabilities instead of the consolidated single "Document Management" capability. Investigation revealed that migration #23 (`1707000000023_create-onboarding-preferences-table`) had created the `user_onboarding_preferences` table but the migration tracking system didn't have a record for it, blocking migration #24 from running.

Fixed by:
- Manually inserting migration #23 tracking record into `pgmigrations` table
- Migration #24 (consolidate-document-management-capabilities) had already run successfully
- Database now correctly shows only one "Document Management" capability
- Organizations updated with consolidated capability
- Backend restarted locally (port 3000) to serve updated capabilities

**FILEPATHS**: 
- `packages/backend/migrations/1707000000024_consolidate-document-management-capabilities.js`
- `packages/backend/migrations/1707000000023_create-onboarding-preferences-table.js`
- `packages/admin/src/components/CapabilitySelector.tsx`

---

## TASK 2: Event Types and Venues Capability-Based Visibility Fix

**STATUS**: done

**USER QUERIES**: 8 ("The Event Types sub menu and the Venues sub menu in the Events section of the Org Admin ui are supposed to be only shown if the organisation has the event types capability or the venues capability")

**DETAILS**: 
Added capability checks to Event Types and Venues submenu items and routes in the Events module. The orgadmin-shell already had capability filtering logic in place (Layout.tsx and App.tsx), so only needed to add the capability properties to the module configuration.

Changes made:
- Added `capability: 'event-types'` to Event Types submenu item and route
- Added `capability: 'venues'` to Venues submenu item and route
- Created validation test at `packages/orgadmin-events/src/__tests__/module-config.test.ts` (13 tests, all passing)
- Created documentation at `docs/EVENT_TYPES_VENUES_CAPABILITY_FIX.md`

The fix follows the same pattern as the existing Discounts submenu which already had `capability: 'entry-discounts'`.

**FILEPATHS**: 
- `packages/orgadmin-events/src/index.ts` (modified)
- `packages/orgadmin-events/src/__tests__/module-config.test.ts` (created)
- `docs/EVENT_TYPES_VENUES_CAPABILITY_FIX.md` (created)

---

## TASK 3: Manual Member Addition Feature - Spec Creation

**STATUS**: in-progress

**USER QUERIES**: 9 ("In relation to the Members Database, can you add a 'Add Member' button...")

**DETAILS**: 
User requested a comprehensive feature to add manual member creation functionality to the Members Database. The feature includes:
- Add Member button (visible only when membership types exist)
- Automatic membership type selection (if only one type) or selector dialog (if multiple)
- Dynamic member creation form on separate page with fields from membership type's form definition
- Name field (mandatory) plus all fields from form definition
- Validation enforcement based on form definition

Created spec using requirements-first workflow:
- Requirements document completed with 10 comprehensive requirements covering button visibility, membership type selection, form rendering, member creation, field type support, navigation, permissions, validation, notifications, and integration
- Design document completed with full architecture, component designs, API endpoints, data models, validation logic, navigation flow, integration details, 20 correctness properties, and testing strategy

**NEXT STEPS**:
- Create tasks.md document breaking down implementation into specific tasks
- Implement frontend components (MembersDatabasePage enhancements, MembershipTypeSelector, CreateMemberPage)
- Implement backend endpoint (POST /api/orgadmin/members)
- Add routing for /orgadmin/memberships/members/create
- Implement validation logic (client and server-side)
- Create property-based tests for all 20 correctness properties
- Create integration tests for end-to-end flows

**FILEPATHS**: 
- `.kiro/specs/manual-member-addition/requirements.md` (created)
- `.kiro/specs/manual-member-addition/design.md` (created)
- `.kiro/specs/manual-member-addition/tasks.md` (needs creation)

---

## USER CORRECTIONS AND INSTRUCTIONS:
- Database is running in Docker container `aws-framework-postgres`
- Database connection: `framework_user@localhost:5432/aws_framework`
- Backend running locally on port 3000 (started during troubleshooting)
- Use direct INSERT without ON CONFLICT clause for pgmigrations table (no unique constraint on name column)
- Test files should avoid importing full modules to prevent date-fns dependency issues
- Use file content validation tests (reading index.ts directly) instead of module imports

---

## Files to read
- `.kiro/specs/manual-member-addition/requirements.md`
- `.kiro/specs/manual-member-addition/design.md`
- `packages/orgadmin-memberships/src/pages/MembersDatabasePage.tsx`
- `packages/orgadmin-memberships/src/index.ts`
- `packages/backend/src/routes/membership.routes.ts`
- `packages/backend/src/services/membership.service.ts`

USER QUERIES(most recent first):
1. <implicit-rules>## Implicit Rules
You are working on the requirements document. 
Make sure the requirements include clear user stories and acceptance criteria. 
If following the requirements-first workflow (no design.md exists yet), proceed to create design.md.
If following the design-first workflow (design.md already exists), proceed to create tasks.md.</implicit-rules>
2. In relation to the Members Database, can you add a “Add Member” button above the table that the Org Administrator can use to manually add members to the database. However this button should only show when there is at least one membership type created. If there are no membership types then it should not be possible to add a new member. When the user clicks the Add Member button they should be prompted to select the Membership Type of the member being added, if there is more than one set up in the system, otherwise if there is only one membership type then it is assumed that this is the one being used. Then, based on the selected membership type the user should see a form where they can fill out all the members details, please have this new member form on its own page (not a popup dialog). The fields in this form that the user should see should be a Name field which is mandatory, and then the form should contain each of the fields from the selected form definition in the specific membership Type being used. The form should enforce the mandatory fields.
3. yes please
4. The command npm test -- events-module-capability-filtering.test.tsxseems to be failing, can you fix the tests.
5. The Event Types sub menu and the Venues sub menu in the Events section of the Org Admin ui are supposed to be only shown if the organisation hasd the event types capability or the venues capability, can you fix this.
6. <implicit-rules>## Implicit Rules
Focus on creating a new spec file or identifying an existing spec to update. 
If starting a new spec, first present the entry point choice to the user (Start with Requirements or Start with Design). 
Do not create any spec files until the user has made their choice.
If working with an existing spec, review the current spec files and suggest improvements if needed. 
Do not make direct code changes yet. First establish or review the spec file that will guide our implementation.</implicit-rules>

---

**Assistant:**

I'll read the necessary files to understand the current state and then create the tasks.md document for the manual member addition spec.

Let me read the rest of the design document to see the complete correctness properties and testing strategy:

Now I have all the context I need. I'll create the tasks.md document for the manual member addition spec, breaking down the implementation into specific, actionable tasks based on the requirements and design documents.

### Sub-Agent: Feature Requirements First Workflow

**Explanation:** Delegating to the feature-requirements-first-workflow subagent to create the tasks.md document for the manual member addition spec, as both requirements.md and design.md are complete

**Prompt:**

Create the tasks.md document for the manual-member-addition spec.

The spec is located at: .kiro/specs/manual-member-addition/

Context:
- This is a feature spec following the requirements-first workflow
- Both requirements.md and design.md documents are complete
- The feature adds manual member creation functionality to the Members Database in the Memberships module
- Organization Administrators can manually add members through a dedicated interface with dynamic form fields based on the selected membership type's form definition

Key implementation areas:
1. Frontend components (MembersDatabasePage enhancements, MembershipTypeSelector, CreateMemberPage)
2. Backend endpoint (POST /api/orgadmin/members)
3. Routing for /orgadmin/memberships/members/create
4. Validation logic (client and server-side)
5. Property-based tests for all 20 correctness properties
6. Integration tests for end-to-end flows

The design document includes:
- Complete component architecture with state management
- API endpoint specifications
- Data models and database schema
- Validation logic (client and server-side)
- Navigation flow with state preservation
- 20 correctness properties to validate
- Comprehensive testing strategy with property-based tests

Please create a detailed tasks.md document that breaks down the implementation into specific, actionable tasks with sub-tasks where appropriate.

**Response:**

Created tasks.md for the manual-member-addition spec with 15 top-level tasks and 62 sub-tasks. The implementation plan covers:

- Backend API endpoint for member creation with unique membership number generation
- Frontend components (MembersDatabasePage enhancements, MembershipTypeSelector, CreateMemberPage)
- Dynamic form field rendering supporting all field types
- Client and server-side validation
- Navigation and routing with state preservation
- Authorization and permissions enforcement
- Integration with existing member features
- 20 property-based tests covering all correctness properties (marked as optional with *)
- Unit and integration tests for comprehensive coverage

The tasks follow an incremental approach with 4 checkpoints for validation. All tasks reference specific requirements for traceability. The implementation reuses existing components (FieldRenderer) and follows established TypeScript/React patterns in the codebase.

You can now begin executing tasks by opening the tasks.md file and clicking "Start task" next to any task item.

Perfect! The tasks.md document has been created for the manual member addition spec. The implementation plan includes 15 top-level tasks with 62 sub-tasks that cover:

- Backend API endpoint with membership number generation and validation
- Frontend components for the complete member creation workflow
- Dynamic form rendering supporting all field types
- Comprehensive validation (client and server-side)
- Navigation with state preservation
- Authorization and permissions
- Integration with existing member features
- 20 property-based tests for all correctness properties
- Unit and integration tests

The plan follows an incremental approach with 4 checkpoints for validation, and all tasks reference specific requirements for traceability.

---
