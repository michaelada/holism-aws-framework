# Memberships Module Translation Keys

This document lists all translation keys used in the Memberships module.

## Status

- ✅ English (en-GB) - Complete
- ✅ French (fr-FR) - Complete  
- ✅ Spanish (es-ES) - Complete
- ⏳ Italian (it-IT) - Pending
- ⏳ German (de-DE) - Pending
- ⏳ Portuguese (pt-PT) - Pending

## Translation Keys Structure

All memberships translations are under the `memberships` namespace:

```
memberships.{category}.{key}
```

## Key Categories

### Main Navigation
- `memberships.title`
- `memberships.membershipTypes`
- `memberships.members`
- `memberships.membersDatabase`

### Actions
- `memberships.createMembershipType`
- `memberships.editMembershipType`
- `memberships.actions.*`

### Table Headers
- `memberships.table.*`

### Filters
- `memberships.filters.*`
- `memberships.statusOptions.*`
- `memberships.typeOptions.*`

### Forms
- `memberships.fields.*`
- `memberships.sections.*`
- `memberships.validation.*`

### Details Pages
- `memberships.details.*`
- `memberships.delete.*`

### Batch Operations
- `memberships.batch.*`

### Custom Filters
- `memberships.customFilter.*`

## Usage in Components

Components use the `useTranslation` hook from react-i18next:

```typescript
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return <h1>{t('memberships.title')}</h1>;
};
```

## Notes

- All date formatting should use the `formatDate` utility from `packages/orgadmin-shell/src/utils/dateFormatting.ts`
- All currency formatting should use the `formatCurrency` utility from `packages/orgadmin-shell/src/utils/currencyFormatting.ts`
- Translation keys support interpolation using `{{variable}}` syntax
