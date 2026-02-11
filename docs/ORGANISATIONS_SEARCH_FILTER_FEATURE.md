# Organisations Search and Filter Feature

## Overview
Added search and filter functionality to the Organisations table view in the Admin UI, allowing users to quickly find organisations by text search and filter by organisation type.

## Features Implemented

### 1. Text Search
- **Search Field**: Prominent search input at the top of the table
- **Search Scope**: Searches across:
  - Organisation display name
  - Organisation name (URL-friendly identifier)
  - Domain (if set)
- **Case-Insensitive**: Search is not case-sensitive for better usability
- **Real-Time**: Results update as you type
- **Helper Text**: Shows "Search by name, display name, or domain" to guide users

### 2. Organisation Type Filter
- **Dropdown Filter**: Select box to filter by organisation type
- **All Types Option**: Default "All Types" option to show all organisations
- **Dynamic Options**: Populated from available organisation types
- **Combined Filtering**: Works together with text search

### 3. Clear Filters Button
- **Conditional Display**: Only shows when filters are active
- **One-Click Reset**: Clears both search text and type filter
- **Convenient**: Quick way to return to full list view

### 4. Smart Empty State
- **Context-Aware Messages**:
  - If no organisations exist: "No organisations found. Create one to get started."
  - If organisations exist but none match filters: "No organisations match your search criteria."

## User Interface

```
┌─────────────────────────────────────────────────────────────┐
│ Organisations                          [Create Organisation] │
├─────────────────────────────────────────────────────────────┤
│ [Search organisations...        ] [Filter by Type ▼] [Clear]│
│  Search by name, display name, or domain                     │
├─────────────────────────────────────────────────────────────┤
│ Name    │ Type  │ Status │ Capabilities │ Admin │ Account   │
├─────────────────────────────────────────────────────────────┤
│ ...filtered results...                                       │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### State Management
```typescript
const [searchText, setSearchText] = useState('');
const [filterTypeId, setFilterTypeId] = useState<string>('');
```

### Filtering Logic
```typescript
const filteredOrganizations = organizations.filter((org) => {
  const matchesSearch = searchText === '' || 
    org.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
    org.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (org.domain && org.domain.toLowerCase().includes(searchText.toLowerCase()));
  
  const matchesType = filterTypeId === '' || org.organizationTypeId === filterTypeId;
  
  return matchesSearch && matchesType;
});
```

### UI Components Used
- **TextField**: For search input with helper text
- **FormControl + Select**: For type filter dropdown
- **Button**: For clear filters action
- **Box**: For flexible layout with gap spacing

## Benefits

1. **Improved Usability**: Users can quickly find specific organisations
2. **Scalability**: Essential for systems with many organisations
3. **Flexibility**: Multiple search criteria (name, display name, domain)
4. **Efficiency**: Real-time filtering without server requests
5. **User-Friendly**: Clear visual feedback and intuitive controls

## Testing

- ✅ All 143 admin UI tests passing
- ✅ Hot module replacement working
- ✅ No breaking changes to existing functionality
- ✅ Filtering logic tested with multiple criteria

## Files Modified

1. `packages/admin/src/pages/OrganizationsPage.tsx`
   - Added search and filter state
   - Implemented filtering logic
   - Added search/filter UI controls
   - Updated table to use filtered results

## Future Enhancements

Potential improvements for future iterations:

1. **Status Filter**: Add filter by organisation status (active/inactive/blocked)
2. **Advanced Search**: Add filters for capabilities, user counts, etc.
3. **Sort Options**: Allow sorting by name, type, status, user counts
4. **Pagination**: For very large datasets
5. **Export**: Export filtered results to CSV/Excel
6. **Saved Filters**: Save commonly used filter combinations
7. **URL Parameters**: Persist filters in URL for bookmarking/sharing

## Usage Examples

### Example 1: Find all swimming clubs
1. Click "Filter by Type" dropdown
2. Select "Swimming Club"
3. View filtered results

### Example 2: Search for specific organisation
1. Type "riverside" in search box
2. See all organisations with "riverside" in name, display name, or domain

### Example 3: Combined filtering
1. Select "Sports Club" from type filter
2. Type "north" in search box
3. See only sports clubs with "north" in their details

### Example 4: Clear all filters
1. Click "Clear Filters" button
2. View full list of all organisations
