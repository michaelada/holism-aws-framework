#!/usr/bin/env ts-node
/**
 * Test Data Generator
 * 
 * Generates comprehensive test data for the metadata system including:
 * - Field definitions for all datatypes
 * - Object definitions with various configurations:
 *   - Simple objects (no groups, no wizard)
 *   - Grouped objects (with field groups)
 *   - Wizard objects (with wizard configuration)
 *   - Complex objects (with both groups and wizard)
 * - 100+ instances for each object type
 * 
 * Usage:
 *   npm run generate-test-data
 *   or
 *   ts-node scripts/generate-test-data.ts
 */

import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface FieldDefinition {
  shortName: string;
  displayName: string;
  description: string;
  datatype: string;
  datatypeProperties: Record<string, any>;
  mandatory: boolean;
  validationRules?: any[];
}

interface ObjectDefinition {
  shortName: string;
  displayName: string;
  description: string;
  fields: Array<{
    fieldShortName: string;
    mandatory: boolean;
    order: number;
  }>;
  displayProperties: {
    defaultSortField?: string;
    defaultSortOrder?: 'asc' | 'desc';
    searchableFields?: string[];
    tableColumns?: string[];
  };
  wizardConfig?: {
    steps: Array<{
      name: string;
      description: string;
      fields: string[];
      order: number;
    }>;
  };
  fieldGroups?: Array<{
    name: string;
    description: string;
    fields: string[];
    order: number;
  }>;
}

class TestDataGenerator {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  private createdFields: string[] = [];
  private createdObjects: string[] = [];

  /**
   * Main execution
   */
  async run() {
    console.log('🚀 Starting test data generation...\n');

    try {
      // Step 1: Create field definitions
      await this.createFieldDefinitions();

      // Step 2: Create object definitions
      await this.createObjectDefinitions();

      // Step 3: Generate instances
      await this.generateInstances();

      console.log('\n✅ Test data generation completed successfully!');
      console.log(`\n📊 Summary:`);
      console.log(`   - Fields created: ${this.createdFields.length}`);
      console.log(`   - Objects created: ${this.createdObjects.length}`);
      console.log(`   - Instances per object: 100`);
      console.log(`   - Total instances: ${this.createdObjects.length * 100}`);
    } catch (error) {
      console.error('\n❌ Error generating test data:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      process.exit(1);
    }
  }

  /**
   * Create comprehensive field definitions
   */
  private async createFieldDefinitions() {
    console.log('📝 Creating field definitions...');

    const fields: FieldDefinition[] = [
      // Text fields
      {
        shortName: 'first_name',
        displayName: 'First Name',
        description: 'Person first name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'last_name',
        displayName: 'Last Name',
        description: 'Person last name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'company_name',
        displayName: 'Company Name',
        description: 'Name of the company',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'job_title',
        displayName: 'Job Title',
        description: 'Job title or position',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'phone',
        displayName: 'Phone Number',
        description: 'Contact phone number',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'address',
        displayName: 'Address',
        description: 'Street address',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'city',
        displayName: 'City',
        description: 'City name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'country',
        displayName: 'Country',
        description: 'Country name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'postal_code',
        displayName: 'Postal Code',
        description: 'Postal or ZIP code',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },

      // Text area
      {
        shortName: 'description',
        displayName: 'Description',
        description: 'Detailed description',
        datatype: 'text_area',
        datatypeProperties: { rows: 4 },
        mandatory: false,
      },
      {
        shortName: 'notes',
        displayName: 'Notes',
        description: 'Additional notes',
        datatype: 'text_area',
        datatypeProperties: { rows: 3 },
        mandatory: false,
      },
      {
        shortName: 'comments',
        displayName: 'Comments',
        description: 'User comments',
        datatype: 'text_area',
        datatypeProperties: { rows: 5 },
        mandatory: false,
      },

      // Email and URL
      {
        shortName: 'email',
        displayName: 'Email Address',
        description: 'Email address',
        datatype: 'email',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'website',
        displayName: 'Website',
        description: 'Website URL',
        datatype: 'url',
        datatypeProperties: {},
        mandatory: false,
      },

      // Single select
      {
        shortName: 'status',
        displayName: 'Status',
        description: 'Current status',
        datatype: 'single_select',
        datatypeProperties: {
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'pending', label: 'Pending' },
            { value: 'archived', label: 'Archived' },
          ],
        },
        mandatory: true,
      },
      {
        shortName: 'priority',
        displayName: 'Priority',
        description: 'Priority level',
        datatype: 'single_select',
        datatypeProperties: {
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ],
        },
        mandatory: false,
      },
      {
        shortName: 'category',
        displayName: 'Category',
        description: 'Item category',
        datatype: 'single_select',
        datatypeProperties: {
          options: [
            { value: 'sales', label: 'Sales' },
            { value: 'marketing', label: 'Marketing' },
            { value: 'support', label: 'Support' },
            { value: 'development', label: 'Development' },
            { value: 'operations', label: 'Operations' },
          ],
        },
        mandatory: false,
      },

      // Multi select
      {
        shortName: 'tags',
        displayName: 'Tags',
        description: 'Associated tags',
        datatype: 'multi_select',
        datatypeProperties: {
          options: [
            { value: 'important', label: 'Important' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'review', label: 'Needs Review' },
            { value: 'approved', label: 'Approved' },
            { value: 'featured', label: 'Featured' },
          ],
        },
        mandatory: false,
      },
      {
        shortName: 'skills',
        displayName: 'Skills',
        description: 'Technical skills',
        datatype: 'multi_select',
        datatypeProperties: {
          options: [
            { value: 'javascript', label: 'JavaScript' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
            { value: 'react', label: 'React' },
            { value: 'nodejs', label: 'Node.js' },
            { value: 'aws', label: 'AWS' },
          ],
        },
        mandatory: false,
      },

      // Date/Time
      {
        shortName: 'start_date',
        displayName: 'Start Date',
        description: 'Start date',
        datatype: 'date',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'end_date',
        displayName: 'End Date',
        description: 'End date',
        datatype: 'date',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'birth_date',
        displayName: 'Birth Date',
        description: 'Date of birth',
        datatype: 'date',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'created_date',
        displayName: 'Created Date',
        description: 'Creation date',
        datatype: 'datetime',
        datatypeProperties: {},
        mandatory: false,
      },

      // Number
      {
        shortName: 'age',
        displayName: 'Age',
        description: 'Age in years',
        datatype: 'number',
        datatypeProperties: { min: 0, max: 150 },
        mandatory: false,
      },
      {
        shortName: 'salary',
        displayName: 'Salary',
        description: 'Annual salary',
        datatype: 'number',
        datatypeProperties: { min: 0 },
        mandatory: false,
      },
      {
        shortName: 'quantity',
        displayName: 'Quantity',
        description: 'Item quantity',
        datatype: 'number',
        datatypeProperties: { min: 0 },
        mandatory: false,
      },
      {
        shortName: 'price',
        displayName: 'Price',
        description: 'Item price',
        datatype: 'number',
        datatypeProperties: { min: 0, step: 0.01 },
        mandatory: false,
      },

      // Boolean
      {
        shortName: 'is_active',
        displayName: 'Is Active',
        description: 'Whether the item is active',
        datatype: 'boolean',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'is_verified',
        displayName: 'Is Verified',
        description: 'Whether the item is verified',
        datatype: 'boolean',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'is_featured',
        displayName: 'Is Featured',
        description: 'Whether the item is featured',
        datatype: 'boolean',
        datatypeProperties: {},
        mandatory: false,
      },
    ];

    for (const field of fields) {
      try {
        await this.apiClient.post('/api/metadata/fields', field);
        this.createdFields.push(field.shortName);
        console.log(`   ✓ Created field: ${field.shortName}`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          console.log(`   ⊙ Field already exists: ${field.shortName}`);
          this.createdFields.push(field.shortName);
        } else {
          throw error;
        }
      }
    }

    console.log(`   Created ${this.createdFields.length} field definitions\n`);
  }

  /**
   * Create various object definitions
   */
  private async createObjectDefinitions() {
    console.log('🏗️  Creating object definitions...');

    const objects: ObjectDefinition[] = [
      // 1. Simple Contact (no groups, no wizard)
      {
        shortName: 'contact',
        displayName: 'Contact',
        description: 'Simple contact with basic information',
        fields: [
          { fieldShortName: 'first_name', mandatory: true, order: 1 },
          { fieldShortName: 'last_name', mandatory: true, order: 2 },
          { fieldShortName: 'email', mandatory: true, order: 3 },
          { fieldShortName: 'phone', mandatory: false, order: 4 },
          { fieldShortName: 'company_name', mandatory: false, order: 5 },
          { fieldShortName: 'notes', mandatory: false, order: 6 },
        ],
        displayProperties: {
          defaultSortField: 'last_name',
          defaultSortOrder: 'asc',
          searchableFields: ['first_name', 'last_name', 'email', 'company_name'],
          tableColumns: ['first_name', 'last_name', 'email', 'phone', 'company_name'],
        },
      },

      // 2. Employee with Field Groups
      {
        shortName: 'employee',
        displayName: 'Employee',
        description: 'Employee with grouped fields',
        fields: [
          { fieldShortName: 'first_name', mandatory: true, order: 1 },
          { fieldShortName: 'last_name', mandatory: true, order: 2 },
          { fieldShortName: 'email', mandatory: true, order: 3 },
          { fieldShortName: 'phone', mandatory: false, order: 4 },
          { fieldShortName: 'job_title', mandatory: true, order: 5 },
          { fieldShortName: 'salary', mandatory: false, order: 6 },
          { fieldShortName: 'start_date', mandatory: true, order: 7 },
          { fieldShortName: 'status', mandatory: true, order: 8 },
          { fieldShortName: 'skills', mandatory: false, order: 9 },
          { fieldShortName: 'notes', mandatory: false, order: 10 },
        ],
        displayProperties: {
          defaultSortField: 'last_name',
          defaultSortOrder: 'asc',
          searchableFields: ['first_name', 'last_name', 'email', 'job_title'],
          tableColumns: ['first_name', 'last_name', 'email', 'job_title', 'status'],
        },
        fieldGroups: [
          {
            name: 'Personal Information',
            description: 'Basic personal details',
            fields: ['first_name', 'last_name', 'email', 'phone'],
            order: 1,
          },
          {
            name: 'Employment Details',
            description: 'Job-related information',
            fields: ['job_title', 'salary', 'start_date', 'status'],
            order: 2,
          },
          {
            name: 'Additional Information',
            description: 'Skills and notes',
            fields: ['skills', 'notes'],
            order: 3,
          },
        ],
      },

      // 3. Customer with Wizard
      {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer with wizard configuration',
        fields: [
          { fieldShortName: 'first_name', mandatory: true, order: 1 },
          { fieldShortName: 'last_name', mandatory: true, order: 2 },
          { fieldShortName: 'email', mandatory: true, order: 3 },
          { fieldShortName: 'phone', mandatory: false, order: 4 },
          { fieldShortName: 'company_name', mandatory: false, order: 5 },
          { fieldShortName: 'address', mandatory: false, order: 6 },
          { fieldShortName: 'city', mandatory: false, order: 7 },
          { fieldShortName: 'country', mandatory: false, order: 8 },
          { fieldShortName: 'postal_code', mandatory: false, order: 9 },
          { fieldShortName: 'status', mandatory: true, order: 10 },
          { fieldShortName: 'category', mandatory: false, order: 11 },
          { fieldShortName: 'notes', mandatory: false, order: 12 },
        ],
        displayProperties: {
          defaultSortField: 'last_name',
          defaultSortOrder: 'asc',
          searchableFields: ['first_name', 'last_name', 'email', 'company_name'],
          tableColumns: ['first_name', 'last_name', 'email', 'company_name', 'status'],
        },
        wizardConfig: {
          steps: [
            {
              name: 'Basic Information',
              description: 'Enter customer basic details',
              fields: ['first_name', 'last_name', 'email', 'phone'],
              order: 1,
            },
            {
              name: 'Company Details',
              description: 'Enter company information',
              fields: ['company_name', 'category'],
              order: 2,
            },
            {
              name: 'Address',
              description: 'Enter address information',
              fields: ['address', 'city', 'country', 'postal_code'],
              order: 3,
            },
            {
              name: 'Additional Details',
              description: 'Status and notes',
              fields: ['status', 'notes'],
              order: 4,
            },
          ],
        },
      },

      // 4. Project with Both Groups and Wizard
      {
        shortName: 'project',
        displayName: 'Project',
        description: 'Project with field groups and wizard',
        fields: [
          { fieldShortName: 'company_name', mandatory: true, order: 1 },
          { fieldShortName: 'description', mandatory: true, order: 2 },
          { fieldShortName: 'status', mandatory: true, order: 3 },
          { fieldShortName: 'priority', mandatory: true, order: 4 },
          { fieldShortName: 'category', mandatory: false, order: 5 },
          { fieldShortName: 'start_date', mandatory: true, order: 6 },
          { fieldShortName: 'end_date', mandatory: false, order: 7 },
          { fieldShortName: 'tags', mandatory: false, order: 8 },
          { fieldShortName: 'price', mandatory: false, order: 9 },
          { fieldShortName: 'is_active', mandatory: false, order: 10 },
          { fieldShortName: 'notes', mandatory: false, order: 11 },
        ],
        displayProperties: {
          defaultSortField: 'start_date',
          defaultSortOrder: 'desc',
          searchableFields: ['company_name', 'description'],
          tableColumns: ['company_name', 'status', 'priority', 'start_date', 'end_date'],
        },
        fieldGroups: [
          {
            name: 'Project Details',
            description: 'Basic project information',
            fields: ['company_name', 'description', 'category'],
            order: 1,
          },
          {
            name: 'Status & Priority',
            description: 'Project status and priority',
            fields: ['status', 'priority', 'tags', 'is_active'],
            order: 2,
          },
          {
            name: 'Timeline & Budget',
            description: 'Dates and financial information',
            fields: ['start_date', 'end_date', 'price'],
            order: 3,
          },
          {
            name: 'Additional Notes',
            description: 'Extra information',
            fields: ['notes'],
            order: 4,
          },
        ],
        wizardConfig: {
          steps: [
            {
              name: 'Project Setup',
              description: 'Basic project details',
              fields: ['company_name', 'description', 'category'],
              order: 1,
            },
            {
              name: 'Timeline',
              description: 'Project timeline',
              fields: ['start_date', 'end_date'],
              order: 2,
            },
            {
              name: 'Classification',
              description: 'Status, priority, and tags',
              fields: ['status', 'priority', 'tags'],
              order: 3,
            },
            {
              name: 'Budget & Notes',
              description: 'Financial and additional information',
              fields: ['price', 'is_active', 'notes'],
              order: 4,
            },
          ],
        },
      },

      // 5. Product (all field types)
      {
        shortName: 'product',
        displayName: 'Product',
        description: 'Product with all field types',
        fields: [
          { fieldShortName: 'company_name', mandatory: true, order: 1 },
          { fieldShortName: 'description', mandatory: true, order: 2 },
          { fieldShortName: 'category', mandatory: true, order: 3 },
          { fieldShortName: 'price', mandatory: true, order: 4 },
          { fieldShortName: 'quantity', mandatory: false, order: 5 },
          { fieldShortName: 'status', mandatory: true, order: 6 },
          { fieldShortName: 'tags', mandatory: false, order: 7 },
          { fieldShortName: 'website', mandatory: false, order: 8 },
          { fieldShortName: 'is_featured', mandatory: false, order: 9 },
          { fieldShortName: 'is_active', mandatory: false, order: 10 },
          { fieldShortName: 'created_date', mandatory: false, order: 11 },
          { fieldShortName: 'notes', mandatory: false, order: 12 },
        ],
        displayProperties: {
          defaultSortField: 'company_name',
          defaultSortOrder: 'asc',
          searchableFields: ['company_name', 'description', 'category'],
          tableColumns: ['company_name', 'category', 'price', 'quantity', 'status'],
        },
      },
    ];

    for (const object of objects) {
      try {
        await this.apiClient.post('/api/metadata/objects', object);
        this.createdObjects.push(object.shortName);
        console.log(`   ✓ Created object: ${object.shortName}`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          console.log(`   ⊙ Object already exists: ${object.shortName}`);
          this.createdObjects.push(object.shortName);
        } else {
          throw error;
        }
      }
    }

    console.log(`   Created ${this.createdObjects.length} object definitions\n`);
  }

  /**
   * Generate instances for each object
   */
  private async generateInstances() {
    console.log('📦 Generating instances...');

    for (const objectType of this.createdObjects) {
      console.log(`   Generating 100 instances for ${objectType}...`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < 100; i++) {
        const instance = this.generateInstanceData(objectType);
        
        try {
          await this.apiClient.post(`/api/objects/${objectType}/instances`, instance);
          successCount++;
          
          // Progress indicator every 10 instances
          if ((i + 1) % 10 === 0) {
            process.stdout.write(`   Progress: ${i + 1}/100\r`);
          }
        } catch (error) {
          failCount++;
          if (failCount === 1) {
            // Only log the first error in detail
            console.error(`\n   ✗ Failed to create instance ${i + 1} for ${objectType}`);
            if (axios.isAxiosError(error)) {
              console.error('   Error:', JSON.stringify(error.response?.data, null, 2));
              console.error('   Instance data:', JSON.stringify(instance, null, 2));
            } else {
              console.error('   Error:', error);
            }
            console.log('   (Suppressing further errors for this object...)');
          }
        }
        
        // Small delay to avoid overwhelming the server
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`   ✓ Created ${successCount} instances for ${objectType} (${failCount} failed)`);
    }
  }

  /**
   * Generate fake data for an instance
   */
  private generateInstanceData(objectType: string): Record<string, any> {
    const data: Record<string, any> = {};

    switch (objectType) {
      case 'contact':
        data.first_name = faker.person.firstName();
        data.last_name = faker.person.lastName();
        data.email = faker.internet.email();
        data.phone = faker.phone.number();
        data.company_name = faker.company.name();
        data.notes = faker.lorem.paragraph();
        break;

      case 'employee':
        data.first_name = faker.person.firstName();
        data.last_name = faker.person.lastName();
        data.email = faker.internet.email();
        data.phone = faker.phone.number();
        data.job_title = faker.person.jobTitle();
        data.salary = faker.number.int({ min: 30000, max: 150000 });
        data.start_date = faker.date.past({ years: 5 }).toISOString().split('T')[0];
        data.status = faker.helpers.arrayElement(['active', 'inactive', 'pending']);
        data.skills = faker.helpers.arrayElements(['javascript', 'python', 'java', 'react', 'nodejs', 'aws'], { min: 1, max: 4 });
        data.notes = faker.lorem.paragraph();
        break;

      case 'customer':
        data.first_name = faker.person.firstName();
        data.last_name = faker.person.lastName();
        data.email = faker.internet.email();
        data.phone = faker.phone.number();
        data.company_name = faker.company.name();
        data.address = faker.location.streetAddress();
        data.city = faker.location.city();
        data.country = faker.location.country();
        data.postal_code = faker.location.zipCode();
        data.status = faker.helpers.arrayElement(['active', 'inactive', 'pending', 'archived']);
        data.category = faker.helpers.arrayElement(['sales', 'marketing', 'support', 'development', 'operations']);
        data.notes = faker.lorem.paragraph();
        break;

      case 'project':
        data.company_name = faker.company.name();
        data.description = faker.lorem.paragraphs(2);
        data.status = faker.helpers.arrayElement(['active', 'inactive', 'pending', 'archived']);
        data.priority = faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']);
        data.category = faker.helpers.arrayElement(['sales', 'marketing', 'support', 'development', 'operations']);
        // Ensure start_date is in the past
        const projectStartDate = faker.date.past({ years: 2 });
        data.start_date = projectStartDate.toISOString().split('T')[0];
        // Ensure end_date is after start_date but could be in past or future
        const projectEndDate = new Date(projectStartDate);
        projectEndDate.setMonth(projectEndDate.getMonth() + faker.number.int({ min: 1, max: 24 }));
        data.end_date = projectEndDate.toISOString().split('T')[0];
        data.tags = faker.helpers.arrayElements(['important', 'urgent', 'review', 'approved', 'featured'], { min: 0, max: 3 });
        data.price = parseFloat(faker.number.float({ min: 1000, max: 100000, precision: 0.01 }).toFixed(2));
        data.is_active = faker.datatype.boolean();
        data.notes = faker.lorem.paragraph();
        break;

      case 'product':
        data.company_name = faker.commerce.productName();
        data.description = faker.commerce.productDescription();
        data.category = faker.helpers.arrayElement(['sales', 'marketing', 'support', 'development', 'operations']);
        data.price = parseFloat(faker.number.float({ min: 10, max: 1000, precision: 0.01 }).toFixed(2));
        data.quantity = faker.number.int({ min: 0, max: 1000 });
        data.status = faker.helpers.arrayElement(['active', 'inactive', 'pending', 'archived']);
        data.tags = faker.helpers.arrayElements(['important', 'urgent', 'review', 'approved', 'featured'], { min: 0, max: 3 });
        data.website = faker.internet.url();
        data.is_featured = faker.datatype.boolean();
        data.is_active = faker.datatype.boolean();
        data.created_date = faker.date.past({ years: 1 }).toISOString();
        data.notes = faker.lorem.paragraph();
        break;
    }

    return data;
  }
}

// Run the generator
const generator = new TestDataGenerator();
generator.run();
