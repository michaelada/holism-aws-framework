# Number Field Precision Feature

## Overview
Added an optional `precision` property to number field definitions that controls how many decimal places are displayed when rendering number fields.

## Feature Details

### Precision Property
- **Type**: Number (integer)
- **Default**: 0 (displays as integer)
- **Range**: 0-10 decimal places
- **Location**: `datatypeProperties.precision` in Field Definition

### Behavior

**When precision = 0** (default):
- Numbers display as integers
- Example: `42`, `100`, `1234`

**When precision > 0**:
- Numbers display with fixed decimal places, padded with zeros
- Example with precision=2: `42.00`, `3.14`, `99.99`
- Example with precision=4: `3.1416`, `2.7183`, `1.0000`

### Display Locations

The precision formatting is applied in:
1. **Form inputs** (NumberRenderer) - Shows formatted value in input field
2. **Table views** (MetadataTable, VirtualizedMetadataTable) - Shows formatted value in table cells
3. **Read-only views** - Shows formatted value when displaying data

### Automatic Step Calculation
The input step is automatically calculated based on precision:
- precision=0 → step=1
- precision=1 → step=0.1
- precision=2 → step=0.01
- precision=3 → step=0.001
- etc.

## Implementation

### Files Modified

**1. Frontend - CreateEditFieldPage** (`packages/frontend/src/pages/CreateEditFieldPage.tsx`)
- Added precision input field that appears when datatype is "number"
- Precision value is saved to `datatypeProperties.precision`
- Input allows values from 0-10

**2. Components - NumberRenderer** (`packages/components/src/components/FieldRenderer/renderers/NumberRenderer.tsx`)
- Reads `precision` from `fieldDefinition.datatypeProperties.precision`
- Formats display value using `Number.toFixed(precision)`
- Calculates step as `Math.pow(10, -precision)` when precision > 0

**3. Components - MetadataTable** (`packages/components/src/components/MetadataTable/MetadataTable.tsx`)
- Added number formatting in `formatCellValue` function
- Applies `toFixed(precision)` to number values in table cells
- Ensures consistent display across all table views

**4. Components - VirtualizedMetadataTable** (`packages/components/src/components/MetadataTable/VirtualizedMetadataTable.tsx`)
- Added number formatting in `formatCellValue` function
- Applies `toFixed(precision)` to number values in virtualized table cells
- Maintains performance with large datasets

**5. Type Definitions** (no changes needed)
- `datatypeProperties` is already defined as `Record<string, any>`
- Supports arbitrary properties including `precision`

**6. Documentation**
- Updated `.kiro/specs/aws-web-app-framework/requirements.md`
  - Added acceptance criteria 8-11 to Requirement 12
- Updated `.kiro/specs/aws-web-app-framework/design.md`
  - Added datatypeProperties examples with precision
  - Added NumberRenderer documentation

## Usage Examples

### Creating a Number Field with Precision

**Example 1: Currency Field (2 decimal places)**
```typescript
{
  shortName: 'price',
  displayName: 'Price',
  description: 'Product price in USD',
  datatype: 'number',
  datatypeProperties: {
    precision: 2,
    min: 0
  }
}
// Displays: $42.50, $99.99, $1234.00
```

**Example 2: Percentage Field (1 decimal place)**
```typescript
{
  shortName: 'completion_rate',
  displayName: 'Completion Rate',
  description: 'Percentage complete',
  datatype: 'number',
  datatypeProperties: {
    precision: 1,
    min: 0,
    max: 100
  }
}
// Displays: 75.5%, 100.0%, 33.3%
```

**Example 3: Integer Field (0 decimal places)**
```typescript
{
  shortName: 'quantity',
  displayName: 'Quantity',
  description: 'Number of items',
  datatype: 'number',
  datatypeProperties: {
    precision: 0,
    min: 0
  }
}
// Displays: 42, 100, 1234
```

**Example 4: Scientific Measurement (4 decimal places)**
```typescript
{
  shortName: 'measurement',
  displayName: 'Measurement',
  description: 'Precise measurement value',
  datatype: 'number',
  datatypeProperties: {
    precision: 4
  }
}
// Displays: 3.1416, 2.7183, 1.4142
```

## User Interface

When creating or editing a number field definition:

1. Select "number" as the datatype
2. A "Precision" input field appears
3. Enter the desired number of decimal places (0-10)
4. Default is 0 if not specified

The precision input includes:
- Label: "Precision"
- Helper text: "Number of decimal places to display (0 for integers)"
- Min value: 0
- Max value: 10
- Step: 1

## Testing

All existing tests pass with this change:
- ✓ Backend tests: 122 passed
- ✓ Frontend tests: 24 passed
- ✓ Component tests: All passed

The feature is backward compatible:
- Existing number fields without precision property default to 0
- No database migration required (uses existing JSONB column)
- No breaking changes to API

## Technical Notes

### Display Formatting
The `toFixed()` method is used for display formatting:
```typescript
const displayValue = value !== null && value !== undefined && value !== ''
  ? Number(value).toFixed(precision)
  : '';
```

### Storage
- Numbers are stored as-is in the database (NUMERIC type)
- Precision only affects display, not storage
- Full precision is maintained in the database

### Input Step
The step attribute helps users increment/decrement values:
```typescript
step: precision > 0 ? Math.pow(10, -precision) : 1
```

This means:
- precision=0: step by 1 (1, 2, 3, ...)
- precision=2: step by 0.01 (1.00, 1.01, 1.02, ...)
- precision=4: step by 0.0001 (1.0000, 1.0001, 1.0002, ...)

## Future Enhancements

Potential improvements:
1. **Formatting options**: Add thousand separators, currency symbols
2. **Locale support**: Format numbers according to user locale
3. **Rounding modes**: Support different rounding strategies
4. **Display vs storage precision**: Different precision for display and storage
5. **Validation**: Ensure input matches precision requirements

## Requirements Traceability

**Requirement 12.8**: WHERE a Field_Definition specifies number datatype, THE Field_Definition SHALL support an optional precision property that defaults to 0

**Requirement 12.9**: THE precision property SHALL specify the number of decimal places to display when rendering number fields

**Requirement 12.10**: WHEN precision is 0, THE Framework SHALL display numbers as integers

**Requirement 12.11**: WHEN precision is greater than 0, THE Framework SHALL display numbers with the specified number of decimal places

All requirements are satisfied by this implementation.
