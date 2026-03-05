# Form Submission contextId Debugging

## Issue
When creating a member, the POST request to `/api/orgadmin/form-submissions` returns an error:
```
{"error":"invalid input syntax for type uuid: \"manual-creation\""}
```

After fixing to use `state.membershipType.id`, the error changed to:
```
{"error":"null value in column \"context_id\" violates not-null constraint"}
```

## Root Cause Analysis

The `form_submissions` table has a `context_id` column defined as:
```javascript
context_id: {
  type: 'uuid',
  notNull: true,
}
```

This column:
- Must be a valid UUID format
- Cannot be null
- Does NOT have a foreign key constraint (it's a generic field that can reference different entities depending on `submission_type`)

For `membership_application` submissions, the `context_id` should be the membership type ID.

## Current Fix

The code at line 585 in `CreateMemberPage.tsx` now uses:
```typescript
contextId: state.membershipType.id
```

This should be correct, as `state.membershipType.id` is a UUID string from the membership type record.

## Debugging Steps Added

Added console logging to help identify the issue:

1. **When loading membership type** (around line 340):
   ```typescript
   console.log('Loaded membership type:', membershipType);
   console.log('Membership type ID:', membershipType.id);
   console.log('Membership type ID type:', typeof membershipType.id);
   ```

2. **Before creating form submission** (around line 575):
   ```typescript
   console.log('Creating form submission with payload:', submissionPayload);
   console.log('contextId type:', typeof submissionPayload.contextId);
   console.log('contextId value:', submissionPayload.contextId);
   ```

## Next Steps for User

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Try to create a member** and fill out the form
3. **Click "Create Member"**
4. **Check the console logs** for the output from the logging statements above
5. **Report back** with:
   - What the membership type ID value is
   - What the contextId value is when creating the form submission
   - The exact error message from the network tab

## Possible Issues to Check

1. **Membership Type ID Format**: Verify that the membership type ID is actually a valid UUID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

2. **API Response Structure**: Check if the API response for `/api/orgadmin/membership-types/{id}` returns the ID in the expected format

3. **State Management**: Verify that `state.membershipType` is properly set before form submission

4. **Network Request**: Check the actual payload being sent in the Network tab to see if the contextId is being serialized correctly

## Files Modified

- `packages/orgadmin-memberships/src/pages/CreateMemberPage.tsx` (lines 340, 575-590)
  - Added console logging for debugging
  - Using `state.membershipType.id` as contextId

## Database Schema Reference

From `packages/backend/migrations/1707000000011_create-application-forms-tables.js`:
```javascript
context_id: {
  type: 'uuid',
  notNull: true,
}
```

The column accepts any UUID and doesn't enforce referential integrity, allowing it to reference different entity types based on the `submission_type`.
