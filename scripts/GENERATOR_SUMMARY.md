# Test Data Generator - Summary

## Overview

A comprehensive command-line utility that generates test data for extensive testing of the MetadataTable, MetadataForm, and MetadataWizard components.

## Quick Usage

```bash
npm run generate-test-data
```

## What It Creates

### 📋 30+ Field Definitions
Covers all supported data types:
- Text, Text Area, Email, URL
- Single Select, Multi Select
- Date, DateTime, Time
- Number, Boolean

### 🏗️ 5 Object Definitions

1. **Contact** - Simple object (no groups, no wizard)
2. **Employee** - With 3 field groups
3. **Customer** - With 4-step wizard
4. **Project** - Complex (4 groups + 4-step wizard)
5. **Product** - All field types demonstration

### 📦 500 Instances
- 100 instances per object type
- Realistic fake data using Faker.js
- Covers all field types and combinations

## Testing Coverage

### MetadataTable Component
✅ Pagination (100 records per object)
✅ Sorting
✅ Filtering
✅ Search
✅ Performance with large datasets
✅ CRUD operations

### MetadataForm Component
✅ All field types
✅ Field validation
✅ Mandatory fields
✅ Field groups (Employee, Project)
✅ Form submission
✅ Error handling

### MetadataWizard Component
✅ Multi-step navigation (Customer, Project)
✅ Step validation
✅ Progress tracking
✅ Data preservation
✅ Wizard completion

## Files Created

```
scripts/
├── generate-test-data.ts    # Main generator script
├── README.md                 # Detailed documentation
└── GENERATOR_SUMMARY.md      # This file

TEST_DATA_GUIDE.md            # User guide for testing
```

## Key Features

- **Idempotent**: Can be run multiple times safely
- **Realistic Data**: Uses Faker.js for authentic test data
- **Comprehensive**: Covers all field types and configurations
- **Progress Tracking**: Real-time feedback during generation
- **Error Handling**: Gracefully handles existing data and failures

## Example Output

```
🚀 Starting test data generation...

📝 Creating field definitions...
   ✓ Created field: first_name
   ✓ Created field: last_name
   ...
   Created 30 field definitions

🏗️  Creating object definitions...
   ✓ Created object: contact
   ✓ Created object: employee
   ...
   Created 5 object definitions

📦 Generating instances...
   Generating 100 instances for contact...
   ✓ Created 100 instances for contact
   ...

✅ Test data generation completed successfully!

📊 Summary:
   - Fields created: 30
   - Objects created: 5
   - Instances per object: 100
   - Total instances: 500
```

## Dependencies Added

- `@faker-js/faker`: Realistic fake data generation
- `axios`: HTTP client for API calls
- `ts-node`: TypeScript execution

## Configuration

Environment variable:
```bash
API_BASE_URL=http://localhost:3000  # Default
```

## Next Steps

1. Run the generator: `npm run generate-test-data`
2. Start frontend: `npm run dev:frontend`
3. Navigate to: `http://localhost:5174`
4. Test all components with the generated data

## Documentation

- **scripts/README.md**: Detailed technical documentation
- **TEST_DATA_GUIDE.md**: User guide for testing scenarios
- **This file**: Quick reference summary
