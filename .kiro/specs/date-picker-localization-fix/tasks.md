# Implementation Plan: Date Picker LocalizationProvider Fix

## Overview

This implementation plan addresses the LocalizationProvider context error in form preview by:
1. Standardizing MUI X Date Pickers versions across all packages
2. Configuring Vite to force single module instance resolution
3. Verifying LocalizationProvider placement in all relevant pages
4. Adding comprehensive tests to prevent regression

The tasks are ordered to minimize risk and allow for incremental validation.

## Tasks

- [x] 1. Standardize MUI X Date Pickers package versions
  - Update all package.json files to use `@mui/x-date-pickers: ^6.19.4`
  - Update packages: components, orgadmin-core, orgadmin-memberships, orgadmin-registrations, orgadmin-calendar, orgadmin-ticketing, orgadmin-merchandise
  - Run `npm install` in root and verify no peer dependency conflicts
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2_

- [ ] 2. Update Vite configuration with dedupe and optimizeDeps
  - [x] 2.1 Add dedupe configuration to orgadmin-shell/vite.config.ts
    - Add `resolve.dedupe` array with React, MUI, and date-fns packages
    - Include `@mui/x-date-pickers` in dedupe list
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [x] 2.2 Add optimizeDeps.include configuration
    - Add `@mui/x-date-pickers` and its subpath imports to include list
    - Keep existing exclude list unchanged
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 2.3 Update server configuration
    - Add `fs.strict: false` to allow serving files from parent directories
    - Keep existing proxy configuration
    - _Requirements: 3.1_

- [x] 3. Update shared Vite configuration
  - Modify `packages/vite.config.shared.ts` external dependencies
  - Add regex pattern for all `@mui/x-date-pickers` subpaths
  - _Requirements: 3.1, 3.2_

- [ ] 4. Verify LocalizationProvider placement in all pages
  - [x] 4.1 Verify FormPreviewPage has LocalizationProvider
    - Check that LocalizationProvider wraps all form content
    - Verify AdapterDateFns and enGB locale are imported
    - _Requirements: 1.1, 1.3_
  
  - [x] 4.2 Verify CreateFieldPage has LocalizationProvider
    - Check that LocalizationProvider wraps FieldRenderer preview
    - Verify AdapterDateFns and enGB locale are imported
    - _Requirements: 1.1, 1.3_
  
  - [x] 4.3 Check EditFieldPage for date picker usage
    - If EditFieldPage has FieldRenderer preview, add LocalizationProvider
    - If no preview, no changes needed
    - _Requirements: 1.1, 1.3_

- [ ] 5. Add code documentation
  - [x] 5.1 Document Vite dedupe configuration
    - Add comments explaining why dedupe is needed
    - Reference the module resolution issue
    - _Requirements: 6.1, 6.2_
  
  - [x] 5.2 Document DateRenderer provider requirement
    - Add JSDoc comment explaining LocalizationProvider requirement
    - Include example usage
    - _Requirements: 6.1_
  
  - [x] 5.3 Document FormPreviewPage provider placement
    - Add comment explaining why LocalizationProvider is at page level
    - Reference Vite module resolution issue
    - _Requirements: 6.1_

- [x] 6. Checkpoint - Test development mode
  - Start dev server and verify it starts without errors
  - Navigate to form preview with date fields
  - Check console for LocalizationProvider errors
  - Verify date pickers render and are interactive
  - Test with multiple date fields in same form
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Write unit tests for LocalizationProvider presence
  - [x] 7.1 Write test for FormPreviewPage LocalizationProvider
    - Test that LocalizationProvider component is rendered
    - Test that AdapterDateFns is configured
    - _Requirements: 6.4_
  
  - [x] 7.2 Write test for CreateFieldPage LocalizationProvider
    - Test that LocalizationProvider wraps preview
    - Test that date field preview renders without errors
    - _Requirements: 6.4_
  
  - [x] 7.3 Write test for date field rendering
    - Test that date field renders without console errors
    - Test that time field renders without console errors
    - Test that datetime field renders without console errors
    - _Requirements: 1.1, 1.3, 6.4_
  
  - [x] 7.4 Write test for multiple date fields
    - Test form with 3+ date fields renders all correctly
    - Verify no context conflicts between fields
    - _Requirements: 1.4, 6.4_

- [ ] 8. Write property-based tests
  - [x] 8.1 Write property test for date field interaction
    - **Property 1: Date field interaction preserves values**
    - **Validates: Requirements 1.2**
    - Generate random dates and field types
    - Verify values are preserved across re-renders
    - Configure for 100 iterations
    - Tag: "Feature: date-picker-localization-fix, Property 1"
  
  - [x] 8.2 Write property test for multiple date fields
    - **Property 2: Multiple date fields render independently**
    - **Validates: Requirements 1.4**
    - Generate forms with 2-10 random date fields
    - Verify all fields render without errors
    - Verify fields are independent
    - Configure for 100 iterations
    - Tag: "Feature: date-picker-localization-fix, Property 2"

- [ ] 9. Build and test production mode
  - [x] 9.1 Create production build
    - Run `npm run build` in orgadmin-shell
    - Verify build completes without errors
    - Check for module duplication warnings
    - _Requirements: 2.1, 2.3_
  
  - [x] 9.2 Analyze bundle size
    - Check that vendor-mui-pickers chunk exists
    - Verify bundle size increase is < 50KB gzipped
    - Verify date pickers are in separate chunk
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 9.3 Test production build
    - Serve production build locally
    - Navigate to form preview with date fields
    - Verify all functionality works
    - Check console for errors
    - _Requirements: 2.2, 2.3_

- [ ] 10. Update documentation
  - [x] 10.1 Update architecture documentation
    - Document Vite dedupe configuration and rationale
    - Explain module resolution issue and solution
    - Add diagrams from design document
    - _Requirements: 6.3, 5.3_
  
  - [x] 10.2 Create developer guide section
    - How to use date pickers in new pages
    - LocalizationProvider requirements
    - Troubleshooting guide for context errors
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [x] 10.3 Create migration guide (if needed)
    - Document MUI X v5 to v6 changes if applicable
    - List breaking changes to watch for
    - Provide testing checklist
    - _Requirements: 5.3_

- [x] 11. Final checkpoint - Comprehensive testing
  - Run all unit tests and verify they pass
  - Run all property-based tests and verify they pass
  - Manual testing of all date picker pages
  - Verify no console errors in dev or production
  - Verify HMR works correctly
  - Check bundle size hasn't significantly increased
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Version standardization (Task 1) may require testing all date picker usages if MUI X v6 has breaking changes
- If Vite configuration causes issues, rollback plan is documented in design
- Property-based tests use fast-check library with 100 iterations minimum
- Bundle size target is < 50KB gzipped increase for date picker chunk
- All date picker pages must have LocalizationProvider wrapper

## Rollback Plan

If issues occur after implementation:
1. Revert vite.config.ts changes (Tasks 2-3)
2. Keep version standardization (Task 1) as it's beneficial
3. Consider alternative date picker library (documented in design)
4. Document that issue persists and provide workarounds
