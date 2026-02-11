# Field Groups and Wizard Configuration UI Feature

## Problem
When creating or editing an object definition, there was no UI to:
1. Define field groups (for organizing fields in the form view)
2. Configure wizard steps (for multi-step form creation)

These features existed in the backend and data model but were not accessible through the frontend UI.

## Solution
Enhanced the `CreateEditObjectPage` component to include tabbed interface with three sections:

### 1. Fields Tab (Existing)
- Add/remove fields
- Set field order
- Mark fields as mandatory
- Toggle "In Table" visibility

### 2. Field Groups Tab (New)
- Create multiple field groups
- Each group has:
  - Name (required)
  - Description (required)
  - List of fields to include (multi-select)
  - Order (managed via up/down arrows)
- Groups help organize fields visually in the form view

### 3. Wizard Configuration Tab (New)
- Create multi-step wizard for instance creation
- Each step has:
  - Step name (required)
  - Description (required)
  - List of fields to include (multi-select)
  - Order (managed via up/down arrows)
- Steps are displayed sequentially when creating instances via wizard

## Implementation Details

### UI Components Added
- **Tabs**: Material-UI Tabs component for switching between sections
- **TabPanel**: Custom component to show/hide tab content
- **Multi-select dropdowns**: For selecting fields in groups/steps
- **Chip display**: Visual representation of selected fields
- **Up/Down arrows**: For reordering groups and steps

### State Management
Extended `formData` state to include:
```typescript
{
  fieldGroups: Array<{
    name: string;
    description: string;
    fields: string[];
    order: number;
  }>;
  wizardConfig?: {
    steps: Array<{
      name: string;
      description: string;
      fields: string[];
    }>;
  };
}
```

### Handler Functions Added
**Field Groups:**
- `handleAddFieldGroup()` - Add new group
- `handleRemoveFieldGroup(index)` - Remove group
- `handleUpdateFieldGroup(index, updates)` - Update group properties
- `handleMoveFieldGroupUp(index)` - Move group up in order
- `handleMoveFieldGroupDown(index)` - Move group down in order

**Wizard Steps:**
- `handleAddWizardStep()` - Add new step
- `handleRemoveWizardStep(index)` - Remove step
- `handleUpdateWizardStep(index, updates)` - Update step properties
- `handleMoveWizardStepUp(index)` - Move step up in order
- `handleMoveWizardStepDown(index)` - Move step down in order

### Data Submission
Updated `handleSubmit()` to:
- Only include `fieldGroups` if at least one group is defined
- Only include `wizardConfig` if at least one step is defined
- Send `undefined` for empty configurations (cleaner API)

## Usage

### Creating Field Groups
1. Navigate to Object Definitions
2. Create or edit an object
3. Add fields in the "Fields" tab
4. Switch to "Field Groups" tab
5. Click "Add Group"
6. Fill in group name and description
7. Select fields to include in the group
8. Repeat for additional groups
9. Use arrows to reorder groups
10. Save the object

### Creating Wizard Steps
1. Navigate to Object Definitions
2. Create or edit an object
3. Add fields in the "Fields" tab
4. Switch to "Wizard Configuration" tab
5. Click "Add Step"
6. Fill in step name and description
7. Select fields to include in the step
8. Repeat for additional steps
9. Use arrows to reorder steps
10. Save the object

## Benefits
- **Better Organization**: Field groups help organize complex forms
- **Improved UX**: Wizard steps break down complex data entry into manageable chunks
- **Visual Feedback**: Chips and clear labels show which fields are in each group/step
- **Flexible Configuration**: Easy to add, remove, and reorder groups and steps
- **Validation**: Required fields ensure complete configuration

## Files Modified
- `packages/frontend/src/pages/CreateEditObjectPage.tsx` - Added tabs, field groups UI, and wizard configuration UI

## Testing
To test the feature:
1. Create field definitions (if not already created)
2. Create a new object definition
3. Add several fields to the object
4. Switch to "Field Groups" tab and create groups
5. Switch to "Wizard Configuration" tab and create steps
6. Save the object
7. Edit the object to verify groups and steps are loaded correctly
8. Create an instance to see field groups in action
9. Use the wizard tab when creating an instance to see wizard steps

## Notes
- Field groups and wizard steps are optional
- Fields must be added to the object before they can be assigned to groups or steps
- The order of groups/steps can be changed using up/down arrows
- Each field can appear in multiple groups or steps
- Wizard steps are displayed in order when creating instances
