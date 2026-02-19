# Execute task: 7. Implement Forms module (Form Builder)

Exported: 19/02/2026, 08:49:56

---

**User:**

Execute Task: 7. Implement Forms module (Form Builder)

---

**Assistant:**

I'll implement task 7 (Forms module) by working through each subtask sequentially. Let me start by reading the complete tasks.md file to understand the full context.

Now let me check the existing orgadmin-core package structure to understand what's already there:

Good! The forms directory exists but is empty. Let me check the dashboard module to understand the pattern:

Perfect! Now let me check the module types to understand the interface:

Now let me start implementing the Forms module. I'll begin with subtask 7.1:

## Subtask 7.1: Create forms module registration

## Subtask 7.2: Implement FormsListPage

Let me first create the pages directory and then implement FormsListPage:

## Subtask 7.3: Implement FormBuilderPage

Let me check the existing MetadataForm and related components to understand how to reuse them:

Now let me check the types to understand the data structures:

Now I'll create the FormBuilderPage that reuses these existing patterns. The key insight is that application forms are conceptually the same as object definitions, so we can adapt the same UI patterns:

## Subtask 7.4: Implement FormPreviewPage

Now I need to update the orgadmin-core index.ts to export the forms module:

Now let me check if there are any TypeScript errors by running a build check:

I need to check the useApi hook to understand its interface:

I see the issue. The useApi hook doesn't return get, post, put methods directly. I need to use the execute method instead. Let me fix the pages:

Now fix FormBuilderPage:

Let me read the file to see the exact imports:

Now fix FormPreviewPage:

Now let's try building again:

Good progress! Just two unused variable warnings. Let me fix those:

Now let's try building again:

Excellent! The build succeeded. The warnings about dynamic imports are just informational and don't affect functionality. Now let me mark the main task as complete and update the parent task status:

Perfect! Now let me verify the implementation by checking if the forms module is properly exported and can be imported by the shell:

Great! Now let me create a quick summary document of what was implemented:

## Summary

I have successfully implemented **Task 7: Forms Module (Form Builder)** for the ItsPlainSailing Organisation Admin System. Here's what was completed:

### ✅ Subtask 7.1: Create forms module registration
- Created `packages/orgadmin-core/src/forms/index.ts`
- Defined module registration with:
  - Title: "Form Builder"
  - Description: "Create and manage application forms for events, memberships, and more"
  - Routes for list, create/edit, and preview pages
  - Menu item with form icon
  - Order: 2 (second in menu after Dashboard)

### ✅ Subtask 7.2: Implement FormsListPage
- Created `packages/orgadmin-core/src/forms/pages/FormsListPage.tsx`
- Features:
  - Table display of application forms with name, description, status, and created date
  - Search functionality to filter forms by name/description
  - Status filter (All, Draft, Published)
  - "Create Form" button
  - Edit and Preview actions for each form
  - Responsive Material-UI design

### ✅ Subtask 7.3: Implement FormBuilderPage
- Created `packages/orgadmin-core/src/forms/pages/FormBuilderPage.tsx`
- Features:
  - Form details editor (name, description)
  - Three-tab interface:
    1. **Fields Tab**: Add/remove fields, toggle required status, reorder fields
    2. **Field Groups Tab**: Create groups to organize fields into sections
    3. **Wizard Steps Tab**: Configure multi-step form experience
  - Support for all field types: text, email, number, select, checkbox, date, document_upload
  - Save as Draft or Publish functionality
  - Reuses existing UI patterns from MetadataForm concept
  - Edit mode for existing forms

### ✅ Subtask 7.4: Implement FormPreviewPage
- Created `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx`
- Features:
  - Preview how forms will appear to end users
  - Displays all fields with their types and requirements
  - Shows field grouping if configured
  - Shows wizard steps if configured
  - Special handling for document_upload fields
  - Back to Forms and Edit Form buttons

### Key Design Decisions:
1. **Reused existing patterns**: The form builder follows the same conceptual model as object definitions, making it familiar to developers
2. **Minimal implementation**: Focused on core functionality without over-engineering
3. **API integration ready**: All pages use the `useApi` hook and are ready to connect to backend endpoints
4. **TypeScript strict mode**: All code passes TypeScript compilation with no errors
5. **Material-UI components**: Consistent with the rest of the application

### Files Created:
- `packages/orgadmin-core/src/forms/index.ts`
- `packages/orgadmin-core/src/forms/pages/FormsListPage.tsx`
- `packages/orgadmin-core/src/forms/pages/FormBuilderPage.tsx`
- `packages/orgadmin-core/src/forms/pages/FormPreviewPage.tsx`

### Files Modified:
- `packages/orgadmin-core/src/index.ts` - Added forms module export
- `packages/orgadmin-core/src/dashboard/__tests__/DashboardPage.test.tsx` - Fixed unused import

The Forms module is now complete and ready to be integrated into the orgadmin-shell application. The module follows all requirements from the spec and is built with the same quality standards as the existing Dashboard module.

---
