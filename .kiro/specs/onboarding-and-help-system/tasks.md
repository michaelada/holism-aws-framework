# Implementation Plan: Onboarding and Help System

## Overview

This implementation plan breaks down the onboarding and help system into incremental steps, building from core infrastructure through to complete functionality. The approach follows a layered strategy: backend API first, then frontend context and state management, followed by individual UI components, and finally content and integration.

## Tasks

- [ ] 1. Backend API for user preferences
  - [x] 1.1 Create database schema for onboarding preferences
    - Create table/collection for storing user onboarding preferences
    - Fields: userId, welcomeDismissed (boolean), modulesVisited (array), lastUpdated (timestamp)
    - Add indexes for efficient user lookups
    - _Requirements: 4.1, 9.5_
  
  - [x] 1.2 Implement GET endpoint for retrieving preferences
    - Create GET `/api/user-preferences/onboarding` endpoint
    - Validate authentication token
    - Return user's preferences or default empty state if none exist
    - Handle errors gracefully (401 for auth failures, 500 for server errors)
    - _Requirements: 4.2, 4.4, 9.2, 9.3, 9.4_
  
  - [x] 1.3 Write property test for preference retrieval
    - **Property 10: User Data Isolation**
    - **Validates: Requirements 9.4**
  
  - [x] 1.4 Implement PUT endpoint for storing preferences
    - Create PUT `/api/user-preferences/onboarding` endpoint
    - Validate authentication token
    - Validate request body (boolean for welcomeDismissed, array of valid module IDs)
    - Merge new preferences with existing (additive for modulesVisited)
    - Return success/failure response
    - _Requirements: 4.1, 4.3, 9.1, 9.3_
  
  - [x] 1.5 Write property test for preference persistence
    - **Property 2: Preference Persistence**
    - **Property 5: Preference Data Integrity**
    - **Validates: Requirements 1.3, 2.3, 4.1, 4.3, 4.4**
  
  - [x] 1.6 Write unit tests for API error handling
    - Test authentication failures return 401
    - Test invalid data returns 400
    - Test database errors return 500
    - _Requirements: 4.5, 9.3_

- [ ] 2. Core frontend infrastructure
  - [x] 2.1 Create OnboardingContext and types
    - Define TypeScript interfaces (OnboardingContextValue, OnboardingPreferences, ModuleId)
    - Create React context with default values
    - Export useOnboarding hook
    - _Requirements: 7.2, 7.3_
  
  - [x] 2.2 Implement OnboardingProvider component
    - Create provider component with state management
    - Implement preference loading on mount (call GET endpoint)
    - Implement dismissWelcomeDialog function (updates state and calls PUT endpoint)
    - Implement dismissModuleIntro function (updates state and calls PUT endpoint)
    - Implement checkModuleVisit function (checks if module intro should show)
    - Implement toggleHelpDrawer function
    - Handle loading and error states
    - _Requirements: 1.3, 1.5, 2.3, 2.4, 4.1, 4.2, 4.5_
  
  - [x] 2.3 Write property test for dismissed dialogs
    - **Property 3: Dismissed Dialogs Remain Dismissed**
    - **Validates: Requirements 1.5, 2.4, 6.4**
  
  - [x] 2.4 Write unit tests for OnboardingProvider
    - Test preference loading on mount
    - Test error handling when API fails
    - Test state updates when dialogs dismissed
    - Test checkModuleVisit logic
    - _Requirements: 4.5_

- [ ] 3. WelcomeDialog component
  - [x] 3.1 Create WelcomeDialog component
    - Create component using MUI Dialog
    - Accept open and onClose props
    - Render title from i18n: `onboarding.welcome.title`
    - Render content from i18n: `onboarding.welcome.content` using react-markdown
    - Add "Don't show again" checkbox
    - Add close button
    - Handle close with checkbox state
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 6.1, 6.5, 7.3_
  
  - [x] 3.2 Write unit tests for WelcomeDialog
    - Test dialog renders when open
    - Test checkbox toggles correctly
    - Test close calls onClose with checkbox state
    - Test markdown content renders correctly
    - _Requirements: 1.1, 1.3, 6.1_

- [ ] 4. ModuleIntroductionDialog component
  - [x] 4.1 Create ModuleIntroductionDialog component
    - Create component using MUI Dialog
    - Accept open, moduleId, and onClose props
    - Render title from i18n: `onboarding.modules.{moduleId}.title`
    - Render content from i18n: `onboarding.modules.{moduleId}.content` using react-markdown
    - Add "Got it" close button
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 5.2, 6.1, 6.5, 7.3_
  
  - [x] 4.2 Write property test for first module visit
    - **Property 4: First Module Visit Triggers Introduction**
    - **Validates: Requirements 2.1**
  
  - [x] 4.3 Write unit tests for ModuleIntroductionDialog
    - Test dialog renders for each module
    - Test content loads correctly for each module
    - Test close button works
    - _Requirements: 2.1, 2.3, 2.5_

- [x] 5. Checkpoint - Core dialogs functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. HelpDrawer component
  - [x] 6.1 Create HelpDrawer component
    - Create component using MUI Drawer with anchor="right"
    - Accept open, onClose, pageId, and moduleId props
    - Set width to 400px
    - Add header with close button
    - Add scrollable content area
    - Implement content resolution logic (page-specific → module overview → en-GB fallback)
    - Render content from i18n using react-markdown
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.3, 6.2, 7.3, 8.2, 8.3, 8.5_
  
  - [x] 6.2 Write property test for help content resolution
    - **Property 8: Help Content Resolution**
    - **Validates: Requirements 8.2**
  
  - [x] 6.3 Write property test for markdown rendering
    - **Property 9: Markdown Rendering**
    - **Validates: Requirements 8.4, 11.4**
  
  - [x] 6.4 Write unit tests for HelpDrawer
    - Test drawer opens and closes
    - Test content resolution fallback logic
    - Test language fallback to en-GB
    - Test scrolling with long content
    - _Requirements: 3.4, 3.5, 8.3, 8.5_

- [ ] 7. HelpButton component and navbar integration
  - [x] 7.1 Create HelpButton component
    - Create component using MUI IconButton
    - Use HelpOutline icon from MUI icons
    - Accept onClick and active props
    - Add tooltip from i18n: `help.button.tooltip`
    - Style active state differently (different color/background)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 7.3_
  
  - [x] 7.2 Integrate HelpButton into navbar
    - Add HelpButton to navbar component in top-right area
    - Connect to OnboardingContext for state and toggle function
    - Ensure proper spacing and alignment with existing navbar items
    - _Requirements: 10.1, 7.4_
  
  - [x] 7.3 Write unit tests for HelpButton
    - Test button renders correctly
    - Test tooltip appears on hover
    - Test click calls onClick
    - Test active state styling
    - _Requirements: 10.2, 10.3, 10.5_

- [ ] 8. usePageHelp hook and page tracking
  - [x] 8.1 Create usePageHelp hook
    - Create hook that accepts pageId parameter
    - Update OnboardingContext with current pageId
    - Use useEffect to update on pageId change
    - _Requirements: 8.2_
  
  - [x] 8.2 Create route-to-page mapping utility
    - Define mapping of routes to pageId and moduleId
    - Create function to resolve current route to page info
    - Export for use in components
    - _Requirements: 8.2_

- [ ] 9. Dialog orchestration logic
  - [x] 9.1 Implement dialog priority logic in OnboardingProvider
    - Ensure welcome dialog shows before module intros
    - Ensure only one dialog displays at a time
    - Track which dialog should show based on state
    - _Requirements: 6.3_
  
  - [x] 9.2 Write property test for single dialog display
    - **Property 7: Single Dialog Display**
    - **Validates: Requirements 6.3**
  
  - [x] 9.3 Write unit tests for dialog orchestration
    - Test welcome dialog takes precedence
    - Test module intro shows after welcome dismissed
    - Test no dialogs show when all dismissed
    - _Requirements: 6.3_

- [ ] 10. Translation content for English (en-GB)
  - [x] 10.1 Create onboarding.json for en-GB
    - Create file: `packages/orgadmin-shell/src/i18n/locales/en-GB/onboarding.json`
    - Add welcome dialog content (title, content, checkbox text)
    - Add module introduction content for all 7 modules
    - Use markdown formatting in content strings
    - _Requirements: 5.1, 5.2, 11.1, 11.3, 11.4_
  
  - [x] 10.2 Create help.json for en-GB
    - Create file: `packages/orgadmin-shell/src/i18n/locales/en-GB/help.json`
    - Add help button tooltip
    - Add help content for all modules (overview and page-specific)
    - Use markdown formatting in content strings
    - _Requirements: 5.3, 8.1, 11.1, 11.3, 11.4_

- [ ] 11. Translation content for French (fr-FR)
  - [x] 11.1 Create onboarding.json for fr-FR
    - Translate all welcome dialog content to French
    - Translate all module introduction content to French
    - _Requirements: 5.1, 5.2_
  
  - [x] 11.2 Create help.json for fr-FR
    - Translate all help content to French
    - _Requirements: 5.3_

- [ ] 12. Translation content for Spanish (es-ES)
  - [x] 12.1 Create onboarding.json for es-ES
    - Translate all welcome dialog content to Spanish
    - Translate all module introduction content to Spanish
    - _Requirements: 5.1, 5.2_
  
  - [x] 12.2 Create help.json for es-ES
    - Translate all help content to Spanish
    - _Requirements: 5.3_

- [ ] 13. Translation content for Italian (it-IT)
  - [x] 13.1 Create onboarding.json for it-IT
    - Translate all welcome dialog content to Italian
    - Translate all module introduction content to Italian
    - _Requirements: 5.1, 5.2_
  
  - [x] 13.2 Create help.json for it-IT
    - Translate all help content to Italian
    - _Requirements: 5.3_

- [ ] 14. Translation content for German (de-DE)
  - [x] 14.1 Create onboarding.json for de-DE
    - Translate all welcome dialog content to German
    - Translate all module introduction content to German
    - _Requirements: 5.1, 5.2_
  
  - [x] 14.2 Create help.json for de-DE
    - Translate all help content to German
    - _Requirements: 5.3_

- [ ] 15. Translation content for Portuguese (pt-PT)
  - [x] 15.1 Create onboarding.json for pt-PT
    - Translate all welcome dialog content to Portuguese
    - Translate all module introduction content to Portuguese
    - _Requirements: 5.1, 5.2_
  
  - [x] 15.2 Create help.json for pt-PT
    - Translate all help content to Portuguese
    - _Requirements: 5.3_

- [x] 16. Checkpoint - All content created
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Module integration
  - [x] 17.1 Integrate OnboardingProvider into app root
    - Wrap application with OnboardingProvider
    - Ensure it's inside i18n provider and auth provider
    - _Requirements: 7.1, 7.2_
  
  - [x] 17.2 Add checkModuleVisit calls to module entry points
    - Add useOnboarding hook to each module's main page
    - Call checkModuleVisit with appropriate moduleId on mount
    - Modules: dashboard, users, forms, events, memberships, calendar, payments
    - _Requirements: 2.1, 2.5, 7.1, 7.5_
  
  - [x] 17.3 Add usePageHelp calls to key pages
    - Add usePageHelp hook to important pages in each module
    - Pass appropriate pageId (e.g., 'list', 'create', 'edit', 'detail')
    - Prioritize high-traffic pages first
    - _Requirements: 8.2_

- [ ] 18. Property-based testing setup
  - [x] 18.1 Install and configure fast-check library
    - Add fast-check as dev dependency
    - Configure test runner for property tests
    - Create example property test to verify setup
    - _Requirements: Testing Strategy_
  
  - [x] 18.2 Write property test for content language consistency
    - **Property 1: Content Language Consistency**
    - **Validates: Requirements 1.2, 2.2, 3.2, 5.4**
  
  - [x] 18.3 Write property test for universal dialog dismissibility
    - **Property 6: Universal Dialog Dismissibility**
    - **Validates: Requirements 6.1**

- [ ] 19. Integration testing
  - [x] 19.1 Write integration test for first login flow
    - Test welcome dialog appears for new user
    - Test dismissing with "don't show again"
    - Test preference is saved
    - Test dialog doesn't appear on next login
    - _Requirements: 1.1, 1.3, 1.5_
  
  - [x] 19.2 Write integration test for module visit flow
    - Test module intro appears on first visit
    - Test dismissing module intro
    - Test intro doesn't appear on subsequent visits
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [x] 19.3 Write integration test for help drawer flow
    - Test help button opens drawer
    - Test correct content displays
    - Test closing drawer
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [x] 19.4 Write integration test for language switching
    - Test changing language updates all content
    - Test fallback to en-GB for missing translations
    - _Requirements: 5.4, 8.5_

- [ ] 20. Accessibility improvements
  - [x] 20.1 Add keyboard navigation support
    - Ensure all dialogs close with Escape key
    - Add keyboard shortcut for help drawer (Shift+?)
    - Implement proper focus management
    - _Requirements: 6.1, Accessibility_
  
  - [x] 20.2 Add ARIA labels and semantic HTML
    - Add aria-label to help button
    - Add aria-describedby to dialogs
    - Ensure markdown renders semantic HTML
    - Test with screen reader
    - _Requirements: Accessibility_
  
  - [x] 20.3 Write accessibility tests
    - Test keyboard navigation works
    - Test ARIA labels present
    - Test focus management
    - _Requirements: Accessibility_

- [ ] 21. Performance optimization
  - [x] 21.1 Implement lazy loading for markdown renderer
    - Lazy load react-markdown library
    - Show loading state while loading
    - _Requirements: Performance_
  
  - [x] 21.2 Add React.memo to dialog components
    - Wrap WelcomeDialog with React.memo
    - Wrap ModuleIntroductionDialog with React.memo
    - Wrap HelpDrawer with React.memo
    - Prevent unnecessary re-renders
    - _Requirements: Performance_
  
  - [x] 21.3 Implement preference caching
    - Cache loaded preferences in context
    - Avoid repeated API calls
    - Invalidate cache on updates
    - _Requirements: Performance_

- [ ] 22. Final checkpoint and polish
  - [x] 22.1 Review all translations for consistency
    - Check all 6 languages have complete translations
    - Verify markdown formatting is consistent
    - Fix any missing or incorrect translations
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 22.2 Test complete user flows
    - Test first-time user experience
    - Test returning user experience
    - Test help system across all modules
    - Test language switching
    - _Requirements: All_
  
  - [x] 22.3 Final testing and bug fixes
    - Run all unit tests
    - Run all property tests
    - Run all integration tests
    - Fix any failing tests or discovered bugs
    - _Requirements: All_

- [ ] 23. Documentation
  - [x] 23.1 Create developer documentation
    - Document how to add new module introductions
    - Document how to add help content for new pages
    - Document how to update translations
    - Document API endpoints
    - _Requirements: 11.2_
  
  - [x] 23.2 Create user documentation
    - Document how to use the help system
    - Document how to dismiss onboarding dialogs
    - Add to user guide or help center
    - _Requirements: 11.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Translation tasks can be parallelized or done by different team members
- Integration testing ensures all components work together correctly
- Accessibility and performance tasks ensure production-ready quality
