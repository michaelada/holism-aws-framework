# File Upload Field Description Display - Design

## Solution Overview
Fix the DocumentUploadRenderer component to correctly reference `fieldDefinition.description` instead of the non-existent `fieldDefinition.helpText` property. This is a simple property name correction that will enable description text to display for File Upload and Image Upload fields.

## Technical Design

### Component Changes

#### DocumentUploadRenderer.tsx
**File:** `packages/components/src/components/FieldRenderer/renderers/DocumentUploadRenderer.tsx`

**Current Code (Lines 107-111):**
```typescript
{fieldDefinition.helpText && (
  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
    {fieldDefinition.helpText}
  </Typography>
)}
```

**Updated Code:**
```typescript
{fieldDefinition.description && (
  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
    {fieldDefinition.description}
  </Typography>
)}
```

**Change Summary:**
- Replace `fieldDefinition.helpText` with `fieldDefinition.description` (2 occurrences)
- No other changes needed

### Type Safety
The FieldDefinition interface already defines `description: string` as a required property:
```typescript
export interface FieldDefinition {
  shortName: string;
  displayName: string;
  description: string;  // ✓ Already defined
  datatype: FieldDatatype;
  datatypeProperties: Record<string, any>;
  validationRules?: ValidationRule[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

No type changes are required.

### Visual Design
The description will appear:
1. Below the field label (displayName)
2. Above the "Choose Files" button
3. Using caption typography variant
4. In textSecondary color
5. With gutterBottom spacing

This matches the existing styling pattern already in the code.

## Implementation Plan

### Phase 1: Code Fix
1. Update DocumentUploadRenderer.tsx to use `fieldDefinition.description`
2. Verify TypeScript compilation succeeds
3. Test with existing forms that have File Upload fields

### Phase 2: Verification
1. Test in form preview (CreateFieldPage live preview)
2. Test in form builder (FormPreviewPage)
3. Test in actual form submission views
4. Verify description displays correctly
5. Verify no description shows when description is empty/undefined

### Phase 3: Documentation
1. Update any relevant documentation about field renderers
2. Add note about description support for file upload fields

## Testing Strategy

### Manual Testing
1. **Test Case 1: Field with Description**
   - Create a File Upload field with description "Upload a PDF document (max 5MB)"
   - Verify description appears below label and above upload button
   - Verify styling matches other field types

2. **Test Case 2: Field without Description**
   - Create a File Upload field with empty description
   - Verify no description text is displayed
   - Verify no extra spacing or layout issues

3. **Test Case 3: Image Upload Field**
   - Create an Image Upload field with description
   - Verify description displays correctly
   - Verify same behavior as File Upload

4. **Test Case 4: Form Preview**
   - Open CreateFieldPage with live preview
   - Add description text while creating field
   - Verify description appears in live preview immediately

### Regression Testing
- Verify other field types (text, select, date, etc.) still display descriptions correctly
- Verify file upload functionality still works (upload, remove, display files)
- Verify error messages still display correctly

## Correctness Properties

### Property 1: Description Display Consistency
**Statement:** For any field definition with a non-empty description, the description text must be displayed in the rendered field.

**Validation:**
- Given a FieldDefinition with `description` property set
- When the field is rendered using DocumentUploadRenderer
- Then the description text appears in the UI

### Property 2: Graceful Handling of Missing Description
**Statement:** When a field definition has no description or an empty description, no description element should be rendered.

**Validation:**
- Given a FieldDefinition with empty or undefined `description`
- When the field is rendered using DocumentUploadRenderer
- Then no description Typography component is rendered
- And no extra spacing or layout issues occur

### Property 3: Type Safety
**Statement:** The component must only access properties that exist on the FieldDefinition type.

**Validation:**
- TypeScript compilation succeeds without errors
- No runtime errors accessing undefined properties
- IDE autocomplete shows correct property names

## Risk Assessment

### Low Risk
- **Change Scope:** Single property name change in one component
- **Type Safety:** Property already exists in type definition
- **Backward Compatibility:** No breaking changes to API or data structures
- **Testing:** Easy to verify visually and functionally

### Potential Issues
1. **Existing Forms:** Some forms may have been created without descriptions, expecting no description to show
   - **Mitigation:** Conditional rendering already handles this case

2. **Styling Inconsistency:** Description might not match other field types
   - **Mitigation:** Using existing styling code that was already in place

## Dependencies
- None - this is a self-contained fix

## Rollout Plan
1. Make the code change
2. Test locally with sample forms
3. Deploy to development environment
4. Verify in staging with real form data
5. Deploy to production

## Success Criteria
- ✓ Description text displays for File Upload fields with descriptions
- ✓ No description shows for fields without descriptions
- ✓ Styling matches other field types
- ✓ No TypeScript errors
- ✓ No regression in file upload functionality
- ✓ Works in all contexts (preview, builder, submission)
