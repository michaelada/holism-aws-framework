# Test Data Generation Guide

## Quick Start

Generate comprehensive test data for testing the Table, Form, and Wizard components:

```bash
# 1. Ensure backend is running
npm run dev:backend

# 2. In another terminal, generate test data
npm run generate-test-data
```

This will create:
- **30+ field definitions** covering all data types
- **5 object definitions** with different configurations
- **500 instances** (100 per object type)

## What Gets Created

### Object Types

| Object | Fields | Groups | Wizard | Use Case |
|--------|--------|--------|--------|----------|
| **Contact** | 6 | ❌ | ❌ | Simple form testing |
| **Employee** | 10 | ✅ (3 groups) | ❌ | Field grouping testing |
| **Customer** | 12 | ❌ | ✅ (4 steps) | Wizard testing |
| **Project** | 11 | ✅ (4 groups) | ✅ (4 steps) | Complex form testing |
| **Product** | 12 | ❌ | ❌ | All field types |

### Field Types Covered

- ✅ Text (single line)
- ✅ Text Area (multi-line)
- ✅ Email
- ✅ URL
- ✅ Single Select (dropdown)
- ✅ Multi Select (multiple choice)
- ✅ Date
- ✅ DateTime
- ✅ Number
- ✅ Boolean (checkbox)

## Testing Scenarios

### 1. MetadataTable Testing

Navigate to any object's instances page to test:

```
http://localhost:5174/instances/contact
http://localhost:5174/instances/employee
http://localhost:5174/instances/customer
http://localhost:5174/instances/project
http://localhost:5174/instances/product
```

**Test:**
- Pagination with 100 records
- Sorting by different columns
- Search functionality
- Column visibility
- Performance with large datasets
- Edit/Delete operations

### 2. MetadataForm Testing

Click "Create Instance" on any object to test:

**Simple Form (Contact, Product):**
- All fields in one view
- Field validation
- Mandatory field indicators
- Form submission

**Grouped Form (Employee, Project):**
- Fields organized in collapsible groups
- Group headers and descriptions
- Navigation between groups
- Validation across groups

### 3. MetadataWizard Testing

Click "Create Instance" on Customer or Project and select "Wizard" tab:

**Customer Wizard (4 steps):**
1. Basic Information
2. Company Details
3. Address
4. Additional Details

**Project Wizard (4 steps):**
1. Project Setup
2. Timeline
3. Classification
4. Budget & Notes

**Test:**
- Step navigation (Next/Previous)
- Progress indicator
- Step validation
- Data preservation between steps
- Final submission
- Cancel/Reset functionality

### 4. Field Type Testing

Use the **Product** object to test all field types in one form:

- Text rendering and validation
- Select dropdowns (single and multi)
- Date pickers
- Number inputs with min/max
- Boolean checkboxes
- URL validation
- Email validation

## Sample Data Characteristics

All generated data uses realistic fake values:

- **Names**: John Doe, Jane Smith, etc.
- **Emails**: realistic email addresses
- **Companies**: Fake but realistic company names
- **Dates**: Past dates for start dates, future for end dates
- **Numbers**: Realistic ranges (salaries: $30k-$150k, prices: $10-$1000)
- **Status**: Random selection from available options
- **Tags/Skills**: Random combinations from predefined lists

## Viewing the Data

### Via Frontend
1. Start frontend: `npm run dev:frontend`
2. Navigate to: `http://localhost:5174`
3. Click "Object Definitions" to see all objects
4. Click "View Instances" on any object

### Via API
```bash
# List all objects
curl http://localhost:3000/api/metadata/objects

# Get specific object
curl http://localhost:3000/api/metadata/objects/contact

# List instances
curl http://localhost:3000/api/instances/contact

# Get specific instance
curl http://localhost:3000/api/instances/contact/{id}
```

## Cleanup

To remove all test data:

```bash
# Delete each object (this will cascade delete instances)
curl -X DELETE http://localhost:3000/api/metadata/objects/contact
curl -X DELETE http://localhost:3000/api/metadata/objects/employee
curl -X DELETE http://localhost:3000/api/metadata/objects/customer
curl -X DELETE http://localhost:3000/api/metadata/objects/project
curl -X DELETE http://localhost:3000/api/metadata/objects/product
```

Or reset the entire database:
```bash
# Stop containers
docker-compose down

# Remove volumes
docker volume rm holism_postgres_data

# Restart
docker-compose up -d
```

## Re-running the Script

The script is idempotent:
- Existing fields will be skipped
- Existing objects will be skipped
- Only new instances will be created

To completely regenerate:
1. Clean up existing data (see above)
2. Run the script again

## Customization

Edit `scripts/generate-test-data.ts` to:
- Add more field definitions
- Create different object configurations
- Change the number of instances (default: 100)
- Modify fake data generation logic
- Add custom validation rules

## Troubleshooting

**Script fails to connect:**
- Ensure backend is running: `npm run dev:backend`
- Check backend is on port 3000
- Verify Docker containers are up: `docker ps`

**Field creation fails:**
- Check backend logs for validation errors
- Ensure database is accessible
- Verify migrations have run

**Instance creation fails:**
- Check that all field definitions were created
- Verify object definitions were created successfully
- Look for validation errors in backend logs

## Performance Notes

- Generating 500 instances takes approximately 30-60 seconds
- Each API call is sequential to avoid overwhelming the server
- Progress is displayed in real-time
- Failed instances are logged but don't stop the process
