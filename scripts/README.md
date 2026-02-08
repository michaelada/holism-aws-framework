# Test Data Generator

This script generates comprehensive test data for the AWS Web Application Framework metadata system.

## What It Creates

### Field Definitions (30+ fields)
- **Text fields**: first_name, last_name, company_name, job_title, phone, address, city, country, postal_code
- **Text area fields**: description, notes, comments
- **Email/URL fields**: email, website
- **Single select fields**: status, priority, category
- **Multi select fields**: tags, skills
- **Date/Time fields**: start_date, end_date, birth_date, created_date
- **Number fields**: age, salary, quantity, price
- **Boolean fields**: is_active, is_verified, is_featured

### Object Definitions (5 types)

1. **Contact** (Simple)
   - No field groups
   - No wizard
   - Basic contact information

2. **Employee** (With Field Groups)
   - 3 field groups: Personal Information, Employment Details, Additional Information
   - No wizard
   - Comprehensive employee data

3. **Customer** (With Wizard)
   - No field groups
   - 4-step wizard: Basic Information, Company Details, Address, Additional Details
   - Customer management

4. **Project** (Complex - Groups + Wizard)
   - 4 field groups: Project Details, Status & Priority, Timeline & Budget, Additional Notes
   - 4-step wizard: Project Setup, Timeline, Classification, Budget & Notes
   - Full project management

5. **Product** (All Field Types)
   - No groups or wizard
   - Demonstrates all available field types

### Instance Data
- **100 instances** per object type
- **500 total instances**
- Realistic fake data using Faker.js

## Prerequisites

1. Backend server must be running:
   ```bash
   npm run dev:backend
   ```

2. Database must be initialized and accessible

3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Run the generator:

```bash
npm run generate-test-data
```

Or directly with ts-node:

```bash
ts-node scripts/generate-test-data.ts
```

## Configuration

You can customize the API base URL by setting an environment variable:

```bash
API_BASE_URL=http://localhost:3000 npm run generate-test-data
```

## What to Test

After running the script, you can test:

### MetadataTable Component
- Pagination with 100+ records
- Sorting by different columns
- Filtering and search
- Performance with large datasets
- Column configuration

### MetadataForm Component
- All field types rendering
- Field validation
- Mandatory vs optional fields
- Field groups (Employee, Project)
- Form submission

### MetadataWizard Component
- Multi-step navigation (Customer, Project)
- Step validation
- Progress tracking
- Data preservation between steps
- Wizard completion

## Output

The script will display progress as it runs:

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

## Troubleshooting

### Connection Refused
- Ensure the backend server is running on port 3000
- Check that Docker containers are up if using Docker

### Field Already Exists
- The script handles existing fields gracefully
- It will skip creation and continue

### Instance Creation Fails
- Check backend logs for validation errors
- Ensure all field definitions were created successfully
- Verify database connectivity

## Cleanup

To remove all test data, you can:

1. Drop and recreate the database
2. Or manually delete objects through the API:
   ```bash
   curl -X DELETE http://localhost:3000/api/metadata/objects/contact
   curl -X DELETE http://localhost:3000/api/metadata/objects/employee
   # etc...
   ```

## Extending

To add more test data:

1. Add new field definitions to the `createFieldDefinitions()` method
2. Add new object definitions to the `createObjectDefinitions()` method
3. Add corresponding data generation logic in `generateInstanceData()`
