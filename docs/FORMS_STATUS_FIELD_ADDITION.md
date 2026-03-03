# Forms Status Field Addition

## Issue

The forms listing table in the org admin interface displayed a "Status" column that always showed "Draft". There was no way to edit the form to change the status from "Draft" to "Published".

## Root Cause

The `FormBuilderPage` component was hardcoding the status to 'draft' when saving forms:

```typescript
const formData = {
  name: formName,
  description: formDescription,
  status: 'draft' as const,  // ← Always hardcoded to 'draft'
  fieldGroups: fieldGroups,
  wizardConfig: wizardConfig,
};
```

There was no UI element to allow users to select the status, even though:
- The database schema supports both 'draft' and 'published' statuses
- The backend API accepts status updates via the PUT endpoint
- The frontend displays the status in the forms list

## Solution

Added a status selector to the Form Builder page that allows users to choose between "Draft" and "Published" when creating or editing forms.

### Changes Made

#### 1. Added Status State Variable
**File**: `packages/orgadmin-core/src/forms/pages/FormBuilderPage.tsx`

Added a new state variable to track the form status:

```typescript
const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
```

#### 2. Updated Form Loading
When editing an existing form, the status is now loaded from the backend:

```typescript
if (form) {
  setFormName(form.name);
  setFormDescription(form.description);
  setFormStatus(form.status || 'draft');  // ← Load status from backend
  // ... rest of the loading logic
}
```

#### 3. Updated Form Saving
The status is now taken from the state variable instead of being hardcoded:

```typescript
const formData = {
  name: formName,
  description: formDescription,
  status: formStatus,  // ← Use state variable
  fieldGroups: fieldGroups,
  wizardConfig: wizardConfig,
};
```

#### 4. Added Status Selector UI
Added a Material-UI Select component to the form details section:

```typescript
<FormControl fullWidth>
  <InputLabel>{t('forms.builder.status')}</InputLabel>
  <Select
    value={formStatus}
    label={t('forms.builder.status')}
    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')}
  >
    <MenuItem value="draft">{t('common.status.draft')}</MenuItem>
    <MenuItem value="published">{t('common.status.published')}</MenuItem>
  </Select>
</FormControl>
```

The selector is placed after the description field in the "Form Details" card.

#### 5. Added Translation Key
**File**: `packages/orgadmin-shell/src/locales/en-GB/translation.json`

Added the translation key for the status label:

```json
{
  "forms": {
    "builder": {
      "formDetails": "Form Details",
      "formName": "Form Name",
      "description": "Description",
      "status": "Status",  // ← Added
      "cancel": "Cancel",
      // ...
    }
  }
}
```

## User Experience

### Before
- Users could only create forms with "Draft" status
- No way to publish a form or change its status
- Status column in the forms list always showed "Draft"

### After
- Users can select "Draft" or "Published" when creating a new form
- Users can change the status when editing an existing form
- The status selector is clearly visible in the Form Details section
- Status changes are saved to the database and reflected in the forms list

## Testing

To test the changes:

1. **Create a new form**:
   - Navigate to Forms → Create Form
   - Fill in the form name and description
   - Select "Published" from the Status dropdown
   - Save the form
   - Verify the status shows as "Published" in the forms list

2. **Edit an existing form**:
   - Navigate to Forms list
   - Click edit on a form
   - Change the status from "Draft" to "Published" (or vice versa)
   - Save the form
   - Verify the status is updated in the forms list

3. **Filter by status**:
   - Use the status filter in the forms list
   - Verify you can filter by "Draft" or "Published"
   - Verify the correct forms are shown

## Database Schema

The `application_forms` table already had the status field:

```sql
CREATE TABLE application_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' or 'published'
  field_groups JSONB,
  wizard_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

The backend API already supported status updates:

- **GET** `/api/orgadmin/organisations/{organisationId}/application-forms` - Returns forms with status
- **GET** `/api/orgadmin/application-forms/{id}` - Returns form with status
- **POST** `/api/orgadmin/application-forms` - Creates form with status (defaults to 'draft')
- **PUT** `/api/orgadmin/application-forms/{id}` - Updates form including status

## Files Modified

- `packages/orgadmin-core/src/forms/pages/FormBuilderPage.tsx` - Added status state, UI, and logic
- `packages/orgadmin-shell/src/locales/en-GB/translation.json` - Added translation key

## Future Enhancements

Potential improvements:
- Add confirmation dialog when publishing a form
- Add validation to ensure forms have fields before publishing
- Add a "Publish" button in the forms list for quick publishing
- Add status change history/audit log
- Add permissions to control who can publish forms
- Add a "Draft" badge or indicator in the form builder when editing a draft
