# Discount Help System Fix

## Issue
When users clicked the Help button (?) on the Event Discounts pages, the help drawer was showing Dashboard help content instead of the comprehensive discount-specific help content.

## Root Cause
The help system requires BOTH `currentModule` and `currentPageId` to be set in the OnboardingContext for contextual help to work. 

Looking at the OnboardingProvider implementation:
```tsx
{/* Only render HelpDrawer when we have module and page context */}
{helpDrawerOpen && currentModule && currentPageId && (
  <HelpDrawer
    open={helpDrawerOpen}
    onClose={toggleHelpDrawer}
    moduleId={currentModule}
    pageId={currentPageId}
  />
)}
{/* Render HelpDrawer with dashboard defaults when no specific context */}
{helpDrawerOpen && (!currentModule || !currentPageId) && (
  <HelpDrawer
    open={helpDrawerOpen}
    onClose={toggleHelpDrawer}
    moduleId="dashboard"
    pageId="overview"
  />
)}
```

The discount pages were only calling `usePageHelp('discounts')` which sets `currentPageId`, but they were NOT setting `currentModule`. When `currentModule` is null, the help system falls back to showing dashboard help.

## Solution
Added `setCurrentModule('events')` call to both discount pages to properly set the module context.

### Files Modified

1. **packages/orgadmin-events/src/pages/DiscountsListPage.tsx**
   - Added import: `useOnboarding` from `@aws-web-framework/orgadmin-shell`
   - Added hook: `const { setCurrentModule } = useOnboarding();`
   - Added useEffect to set module:
     ```tsx
     useEffect(() => {
       setCurrentModule('events');
     }, [setCurrentModule]);
     ```

2. **packages/orgadmin-events/src/pages/CreateDiscountPage.tsx**
   - Added import: `useOnboarding` from `@aws-web-framework/orgadmin-shell`
   - Added hook: `const { setCurrentModule } = useOnboarding();`
   - Added useEffect to set module:
     ```tsx
     useEffect(() => {
       setCurrentModule('events');
     }, [setCurrentModule]);
     ```

## Pattern for Future Pages
When implementing contextual help for any page, you need to:

1. Call `usePageHelp(pageId)` to register the page ID
2. Call `setCurrentModule(moduleId)` in a useEffect to set the module context

Example:
```tsx
import { usePageHelp, useOnboarding } from '@aws-web-framework/orgadmin-shell';

const MyPage: React.FC = () => {
  usePageHelp('mypage');
  const { setCurrentModule } = useOnboarding();
  
  useEffect(() => {
    setCurrentModule('events'); // or 'users', 'forms', etc.
  }, [setCurrentModule]);
  
  // ... rest of component
};
```

## Verification
After these changes, when users navigate to:
- `/events/discounts` (list page)
- `/events/discounts/new` (create page)
- `/events/discounts/:id/edit` (edit page)

And click the Help button (?), they will now see the comprehensive discount help content including:
- Overview of discount types
- Application scope explanations
- 8 common discount scenarios with examples
- Tips for effective discounts
- Troubleshooting guide

## Related Files
- Help content: `packages/orgadmin-shell/src/locales/en-GB/help.json` (events.discounts key)
- Page mappings: `packages/orgadmin-shell/src/utils/pageMapping.ts`
- Help system: `packages/orgadmin-shell/src/components/HelpDrawer.tsx`
- Context provider: `packages/orgadmin-shell/src/context/OnboardingProvider.tsx`
