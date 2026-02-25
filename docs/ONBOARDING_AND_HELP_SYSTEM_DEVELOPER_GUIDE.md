# Onboarding and Help System - Developer Guide

## Overview

This guide provides comprehensive documentation for developers working with the onboarding and help system. The system provides first-time user guidance through welcome dialogs, module-specific introductions, and contextual help content accessible via a slide-out drawer.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Adding New Module Introductions](#adding-new-module-introductions)
3. [Adding Help Content for New Pages](#adding-help-content-for-new-pages)
4. [Updating Translations](#updating-translations)
5. [API Endpoints](#api-endpoints)
6. [Component Reference](#component-reference)
7. [Testing Guidelines](#testing-guidelines)

---

## Architecture Overview

### Component Structure

```
orgadmin-shell/
├── context/
│   ├── OnboardingContext.tsx      # Context definition
│   └── OnboardingProvider.tsx     # State management & orchestration
├── components/
│   ├── WelcomeDialog.tsx          # First login dialog
│   ├── ModuleIntroductionDialog.tsx # Module intro dialogs
│   ├── HelpDrawer.tsx             # Contextual help drawer
│   └── HelpButton.tsx             # Navbar help button
├── hooks/
│   └── usePageHelp.ts             # Hook for page-specific help
├── locales/
│   ├── en-GB/
│   │   ├── onboarding.json        # Onboarding content
│   │   └── help.json              # Help content
│   └── [other languages]/
└── utils/
    └── pageMapping.ts             # Route to page ID mapping
```

### Data Flow

1. **OnboardingProvider** loads user preferences from backend on mount
2. **WelcomeDialog** shows on first login if not dismissed
3. **ModuleIntroductionDialog** shows on first visit to each module
4. **HelpDrawer** displays contextual help based on current page
5. All preferences are persisted to backend via API

---

## Adding New Module Introductions

### Step 1: Define Module ID

Add your module ID to the `ModuleId` type in `packages/orgadmin-shell/src/types/index.ts`:

```typescript
export type ModuleId = 
  | 'dashboard' 
  | 'users' 
  | 'forms' 
  | 'events' 
  | 'memberships' 
  | 'calendar' 
  | 'payments'
  | 'your-new-module'; // Add your module here
```

### Step 2: Add Translation Content

For each supported language, add module introduction content to the `onboarding.json` file:

**File:** `packages/orgadmin-shell/src/locales/en-GB/onboarding.json`

```json
{
  "onboarding": {
    "modules": {
      "your-new-module": {
        "title": "Your Module Title",
        "content": "# Module Overview\n\nYour module description in **markdown** format.\n\n## Key Features\n\n- Feature 1\n- Feature 2\n- Feature 3"
      }
    }
  }
}
```

**Repeat for all languages:**
- `en-GB/onboarding.json`
- `fr-FR/onboarding.json`
- `es-ES/onboarding.json`
- `it-IT/onboarding.json`
- `de-DE/onboarding.json`
- `pt-PT/onboarding.json`

### Step 3: Integrate with Module Entry Point

In your module's main page component, call `checkModuleVisit`:

```typescript
import { useOnboarding } from '@orgadmin/shell';
import { useEffect } from 'react';

export const YourModulePage = () => {
  const { checkModuleVisit } = useOnboarding();

  useEffect(() => {
    checkModuleVisit('your-new-module');
  }, [checkModuleVisit]);

  return (
    // Your component JSX
  );
};
```

### Step 4: Test the Integration

1. Clear your user preferences (or use a new test user)
2. Navigate to your new module
3. Verify the introduction dialog appears
4. Dismiss the dialog
5. Navigate away and back - dialog should not appear again

---

## Adding Help Content for New Pages

### Step 1: Define Page ID

Add a mapping for your page in `packages/orgadmin-shell/src/utils/pageMapping.ts`:

```typescript
export const pageMappings: PageMapping[] = [
  // Existing mappings...
  { 
    route: '/your-module/your-page', 
    pageId: 'your-page', 
    moduleId: 'your-module' 
  },
];
```

### Step 2: Add Help Content

Add help content to the `help.json` file for each language:

**File:** `packages/orgadmin-shell/src/locales/en-GB/help.json`

```json
{
  "help": {
    "your-module": {
      "overview": "# Module Help\n\nGeneral help for your module...",
      "your-page": "# Page-Specific Help\n\nDetailed help for this specific page...\n\n## How to Use\n\n1. Step one\n2. Step two"
    }
  }
}
```

**Content Resolution Hierarchy:**
1. Page-specific: `help.{moduleId}.{pageId}`
2. Module overview: `help.{moduleId}.overview`
3. Language fallback: Same keys in `en-GB`

### Step 3: Register Page Help

In your page component, use the `usePageHelp` hook:

```typescript
import { usePageHelp } from '@orgadmin/shell';

export const YourPage = () => {
  usePageHelp('your-page');

  return (
    // Your component JSX
  );
};
```

### Step 4: Test Help Content

1. Navigate to your page
2. Click the help button (?) in the navbar
3. Verify correct help content displays
4. Test in different languages
5. Verify fallback to module overview if page-specific help is missing

---

## Updating Translations

### Translation File Structure

Translation files are organized by language and namespace:

```
packages/orgadmin-shell/src/locales/
├── en-GB/
│   ├── onboarding.json    # Welcome & module intro content
│   └── help.json          # Help drawer content
├── fr-FR/
│   ├── onboarding.json
│   └── help.json
└── [other languages]/
```

### Onboarding Translations

**File:** `onboarding.json`

```json
{
  "onboarding": {
    "welcome": {
      "title": "Welcome Dialog Title",
      "content": "Markdown content for welcome dialog",
      "dontShowAgain": "Don't show this again",
      "close": "Close"
    },
    "modules": {
      "module-id": {
        "title": "Module Introduction Title",
        "content": "Markdown content for module intro",
        "gotIt": "Got it"
      }
    }
  }
}
```

### Help Translations

**File:** `help.json`

```json
{
  "help": {
    "button": {
      "tooltip": "Get help"
    },
    "module-id": {
      "overview": "General module help in markdown",
      "page-id": "Page-specific help in markdown"
    }
  }
}
```

### Markdown Formatting Guidelines

All content fields support markdown formatting:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

[Link text](https://example.com)

> Blockquote for important notes
```

### Translation Workflow

1. **Update English (en-GB) first** - This is the source language
2. **Copy structure to other languages** - Maintain the same JSON structure
3. **Translate content** - Translate all text values, keep keys in English
4. **Test in each language** - Switch language in the app and verify
5. **Verify markdown rendering** - Ensure formatting displays correctly

### Adding a New Language

1. Create new language directory: `packages/orgadmin-shell/src/locales/xx-XX/`
2. Copy `onboarding.json` and `help.json` from `en-GB`
3. Translate all content values
4. Update i18n configuration to include new language
5. Test thoroughly

---

## API Endpoints

### GET /api/user-preferences/onboarding

Retrieves onboarding preferences for the authenticated user.

**Authentication:** Required (Bearer token)

**Request:**
```http
GET /api/user-preferences/onboarding
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "welcomeDismissed": false,
  "modulesVisited": ["dashboard", "users"]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Authentication required"
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "Failed to retrieve preferences"
}
```

**Default Behavior:**
- If no preferences exist for the user, returns empty state:
  ```json
  {
    "welcomeDismissed": false,
    "modulesVisited": []
  }
  ```

### PUT /api/user-preferences/onboarding

Updates onboarding preferences for the authenticated user.

**Authentication:** Required (Bearer token)

**Request:**
```http
PUT /api/user-preferences/onboarding
Authorization: Bearer <token>
Content-Type: application/json

{
  "welcomeDismissed": true,
  "modulesVisited": ["dashboard", "users", "forms"]
}
```

**Request Body:**
- `welcomeDismissed` (optional): Boolean indicating if welcome dialog was dismissed
- `modulesVisited` (optional): Array of module IDs that have been visited

**Valid Module IDs:**
- `dashboard`
- `users`
- `forms`
- `events`
- `memberships`
- `calendar`
- `payments`

**Response (200 OK):**
```json
{
  "success": true
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid preference data",
  "details": "modulesVisited must be an array of valid module IDs"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Authentication required"
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "Failed to update preferences"
}
```

**Merge Behavior:**
- Preferences are merged with existing data (additive)
- `modulesVisited` array is deduplicated
- Invalid module IDs are filtered out

### Backend Implementation

**Service:** `packages/backend/src/services/user-preferences.service.ts`

**Routes:** `packages/backend/src/routes/user-preferences.routes.ts`

**Database Schema:**
```typescript
interface OnboardingPreferences {
  userId: string;
  welcomeDismissed: boolean;
  modulesVisited: string[];
  lastUpdated: Date;
}
```

---

## Component Reference

### OnboardingProvider

**Location:** `packages/orgadmin-shell/src/context/OnboardingProvider.tsx`

**Purpose:** Central state management for the onboarding system

**Usage:**
```typescript
import { OnboardingProvider } from '@orgadmin/shell';

<OnboardingProvider>
  <App />
</OnboardingProvider>
```

**Context Value:**
```typescript
interface OnboardingContextValue {
  // State
  welcomeDialogOpen: boolean;
  moduleIntroDialogOpen: boolean;
  currentModule: ModuleId | null;
  helpDrawerOpen: boolean;
  preferences: OnboardingPreferences;
  loading: boolean;
  
  // Actions
  dismissWelcomeDialog: (dontShowAgain: boolean) => Promise<void>;
  dismissModuleIntro: (moduleId: ModuleId) => Promise<void>;
  toggleHelpDrawer: () => void;
  checkModuleVisit: (moduleId: ModuleId) => void;
}
```

### useOnboarding Hook

**Location:** `packages/orgadmin-shell/src/context/OnboardingContext.tsx`

**Purpose:** Access onboarding context in components

**Usage:**
```typescript
import { useOnboarding } from '@orgadmin/shell';

const MyComponent = () => {
  const { 
    checkModuleVisit, 
    toggleHelpDrawer, 
    helpDrawerOpen 
  } = useOnboarding();
  
  useEffect(() => {
    checkModuleVisit('my-module');
  }, [checkModuleVisit]);
  
  return <button onClick={toggleHelpDrawer}>Help</button>;
};
```

### WelcomeDialog

**Location:** `packages/orgadmin-shell/src/components/WelcomeDialog.tsx`

**Purpose:** Display welcome message on first login

**Props:**
```typescript
interface WelcomeDialogProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
}
```

**Features:**
- Displays markdown content from i18n
- "Don't show again" checkbox
- Keyboard accessible (Escape to close)

### ModuleIntroductionDialog

**Location:** `packages/orgadmin-shell/src/components/ModuleIntroductionDialog.tsx`

**Purpose:** Display module introduction on first visit

**Props:**
```typescript
interface ModuleIntroductionDialogProps {
  open: boolean;
  moduleId: ModuleId;
  onClose: () => void;
}
```

**Features:**
- Displays module-specific markdown content
- Automatically dismissed on close
- Keyboard accessible

### HelpDrawer

**Location:** `packages/orgadmin-shell/src/components/HelpDrawer.tsx`

**Purpose:** Display contextual help content

**Props:**
```typescript
interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  pageId: string;
  moduleId: ModuleId;
}
```

**Features:**
- Slides in from right side (400px width)
- Content resolution with fallbacks
- Scrollable for long content
- Markdown rendering

### HelpButton

**Location:** `packages/orgadmin-shell/src/components/HelpButton.tsx`

**Purpose:** Toggle help drawer from navbar

**Props:**
```typescript
interface HelpButtonProps {
  onClick: () => void;
  active: boolean;
}
```

**Features:**
- Tooltip on hover
- Active state styling
- Keyboard accessible

### usePageHelp Hook

**Location:** `packages/orgadmin-shell/src/hooks/usePageHelp.ts`

**Purpose:** Register current page for help content

**Usage:**
```typescript
import { usePageHelp } from '@orgadmin/shell';

const MyPage = () => {
  usePageHelp('my-page-id');
  
  return <div>Page content</div>;
};
```

---

## Testing Guidelines

### Unit Tests

**Test Files:**
- `packages/orgadmin-shell/src/__tests__/context/OnboardingProvider.test.tsx`
- `packages/orgadmin-shell/src/components/__tests__/WelcomeDialog.test.tsx`
- `packages/orgadmin-shell/src/components/__tests__/ModuleIntroductionDialog.test.tsx`
- `packages/orgadmin-shell/src/components/__tests__/HelpDrawer.test.tsx`
- `packages/orgadmin-shell/src/components/__tests__/HelpButton.test.tsx`

**Example Unit Test:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeDialog } from '../WelcomeDialog';

describe('WelcomeDialog', () => {
  it('should call onClose with checkbox state', () => {
    const onClose = jest.fn();
    render(<WelcomeDialog open={true} onClose={onClose} />);
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
```

### Property-Based Tests

**Test Files:**
- `packages/orgadmin-shell/src/__tests__/context/OnboardingProvider.property.test.tsx`
- `packages/orgadmin-shell/src/components/__tests__/HelpDrawer.property.test.tsx`

**Example Property Test:**
```typescript
import fc from 'fast-check';
import { render } from '@testing-library/react';

describe('Property: Content Language Consistency', () => {
  it('should display content in selected language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'),
        (language) => {
          // Test that content matches selected language
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**Test Files:**
- `packages/orgadmin-shell/src/__tests__/integration/first-login-flow.integration.test.tsx`
- `packages/orgadmin-shell/src/__tests__/integration/module-visit-flow.integration.test.tsx`
- `packages/orgadmin-shell/src/__tests__/integration/help-drawer-flow.integration.test.tsx`

**Example Integration Test:**
```typescript
describe('First Login Flow', () => {
  it('should show welcome dialog and persist dismissal', async () => {
    // Mock API
    mockAPI.get('/api/user-preferences/onboarding').reply(200, {
      welcomeDismissed: false,
      modulesVisited: []
    });
    
    // Render app
    render(<App />);
    
    // Verify welcome dialog appears
    expect(screen.getByText('Welcome to OrgAdmin')).toBeInTheDocument();
    
    // Dismiss with "don't show again"
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Close'));
    
    // Verify API called
    expect(mockAPI.history.put).toHaveLength(1);
  });
});
```

### Backend API Tests

**Test Files:**
- `packages/backend/src/__tests__/routes/user-preferences.routes.test.ts`
- `packages/backend/src/__tests__/services/user-preferences.service.test.ts`

**Running Tests:**
```bash
# Run all tests
npm test

# Run specific test file
npm test -- OnboardingProvider.test.tsx

# Run property tests only
npm test -- --testPathPattern=property.test

# Run with coverage
npm test -- --coverage
```

---

## Common Tasks

### Task: Add a New Module with Introduction

1. Add module ID to `ModuleId` type
2. Add translations to all 6 language files
3. Call `checkModuleVisit` in module entry point
4. Test with new user account

### Task: Add Help Content for Existing Page

1. Identify page ID from route
2. Add help content to `help.json` for all languages
3. Call `usePageHelp` in page component
4. Test help drawer displays correct content

### Task: Update Welcome Dialog Content

1. Edit `onboarding.welcome.content` in all language files
2. Use markdown formatting as needed
3. Test in all languages
4. Verify markdown renders correctly

### Task: Debug Missing Help Content

1. Check `pageMapping.ts` for route mapping
2. Verify `help.json` has content for module and page
3. Check browser console for i18n warnings
4. Verify `usePageHelp` is called in component
5. Test language fallback to en-GB

### Task: Clear User Preferences (Development)

**Option 1: Via API**
```bash
curl -X PUT http://localhost:3000/api/user-preferences/onboarding \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"welcomeDismissed": false, "modulesVisited": []}'
```

**Option 2: Via Database**
```sql
DELETE FROM user_preferences WHERE user_id = 'YOUR_USER_ID';
```

**Option 3: Use Test User**
Create a new test user account for clean state testing.

---

## Troubleshooting

### Welcome Dialog Not Appearing

**Possible Causes:**
1. User preferences already set to `welcomeDismissed: true`
2. OnboardingProvider not wrapping app
3. API endpoint not returning correct data

**Solutions:**
1. Clear user preferences
2. Check app component hierarchy
3. Check network tab for API response

### Module Introduction Not Showing

**Possible Causes:**
1. Module ID not in `modulesVisited` array
2. `checkModuleVisit` not called
3. Translation content missing

**Solutions:**
1. Clear `modulesVisited` in preferences
2. Add `checkModuleVisit` call to module component
3. Add content to `onboarding.json`

### Help Content Not Displaying

**Possible Causes:**
1. Page ID not mapped in `pageMapping.ts`
2. Translation key missing in `help.json`
3. `usePageHelp` not called

**Solutions:**
1. Add route mapping
2. Add help content for module/page
3. Add `usePageHelp` hook to component

### Markdown Not Rendering

**Possible Causes:**
1. Invalid markdown syntax
2. LazyMarkdown component not loading
3. Content not wrapped in markdown field

**Solutions:**
1. Validate markdown syntax
2. Check browser console for errors
3. Ensure content is in correct i18n key

---

## Best Practices

### Content Writing

1. **Keep it concise** - Users want quick guidance, not essays
2. **Use markdown formatting** - Make content scannable with headings and lists
3. **Be action-oriented** - Tell users what they can do
4. **Maintain consistency** - Use similar structure across modules
5. **Test in all languages** - Ensure translations are accurate and natural

### Code Integration

1. **Call hooks at component top level** - Don't call conditionally
2. **Use TypeScript types** - Leverage type safety for module IDs
3. **Handle loading states** - Check `loading` before showing dialogs
4. **Test error scenarios** - Handle API failures gracefully
5. **Follow existing patterns** - Look at existing modules for examples

### Performance

1. **Lazy load markdown** - Use LazyMarkdown component
2. **Memoize components** - Prevent unnecessary re-renders
3. **Cache preferences** - Don't repeatedly fetch from API
4. **Optimize translations** - Keep content files reasonably sized

---

## Additional Resources

- **Spec Documents:** `.kiro/specs/onboarding-and-help-system/`
- **Design Document:** `.kiro/specs/onboarding-and-help-system/design.md`
- **Requirements:** `.kiro/specs/onboarding-and-help-system/requirements.md`
- **Property-Based Testing Guide:** `docs/PROPERTY_BASED_TESTING_GUIDE.md`
- **System Architecture:** `docs/SYSTEM_ARCHITECTURE.md`

---

## Support

For questions or issues:
1. Check this documentation first
2. Review existing test files for examples
3. Check the design document for detailed specifications
4. Consult with the team lead or architect
