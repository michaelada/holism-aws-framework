# Excel Export Feature

## Overview

The Excel export feature allows users to export object instance data from table views to Excel format (.xlsx) for offline analysis, reporting, and data processing.

## Implementation

### Location
- **Frontend Page**: `packages/frontend/src/pages/ObjectInstancesPage.tsx`
- **Component**: `packages/components/src/components/MetadataTable/MetadataTable.tsx`

### Key Features

1. **Export Button**: Added "Export to Excel" button with download icon on object instance pages
2. **Search Integration**: Exports respect current search/filter criteria
3. **Complete Data**: Exports ALL fields from object definition, not just visible table columns
4. **Smart Formatting**: 
   - Arrays: Joined with comma-space separator
   - Objects: Serialized as JSON strings
   - Null/undefined: Empty cells
   - Primitives: Direct values
5. **User-Friendly Headers**: Uses field display names as column headers
6. **Timestamped Files**: Files named as `{ObjectDisplayName}_{YYYY-MM-DD}.xlsx`
7. **Loading State**: Button shows "Exporting..." during export operation

### Technical Details

- **Library**: Uses `xlsx` (SheetJS) for Excel file generation
- **Dynamic Import**: Library is dynamically imported to reduce bundle size
- **Record Limit**: Exports up to 10,000 records per operation
- **Client-Side**: All processing happens in the browser

### Dependencies

```json
{
  "xlsx": "^0.18.5"
}
```

Added to `packages/frontend/package.json`

## Documentation Updates

### Requirements Document
- Added **Requirement 28: Excel Export Functionality** with 14 acceptance criteria
- Location: `.kiro/specs/aws-web-app-framework/requirements.md`

### Design Document
- Added **Excel Export Functionality** section under React Component Library
- Added 4 new correctness properties (Properties 42-45)
- Location: `.kiro/specs/aws-web-app-framework/design.md`

## Testing

All existing tests pass (122 tests):
- Unit tests: ✓
- Property-based tests: ✓
- Integration tests: ✓

## Usage

1. Navigate to any object instance list page (e.g., `/objects/customer/instances`)
2. Optionally apply search filters to narrow down data
3. Click "Export to Excel" button
4. Excel file downloads automatically with all matching data

## Example

```typescript
// Export button in ObjectInstancesPage
<Button
  variant="outlined"
  startIcon={<DownloadIcon />}
  onClick={handleExportToExcel}
  disabled={exporting}
>
  {exporting ? 'Exporting...' : 'Export to Excel'}
</Button>
```

## Benefits

- **Offline Analysis**: Users can analyze data in Excel without API access
- **Reporting**: Easy creation of reports and presentations
- **Data Processing**: Enables advanced Excel features (pivot tables, formulas, charts)
- **Complete Data**: Exports all fields, including those hidden in table view
- **Filtered Exports**: Respects search criteria for targeted data exports
