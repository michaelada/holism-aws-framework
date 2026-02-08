import { MetadataService } from '../../services/metadata.service';
import { FieldDefinition, FieldDatatype } from '../../types/metadata.types';
import { db } from '../../database/pool';

describe('Field Grouping Tests', () => {
  let metadataService: MetadataService;

  beforeAll(async () => {
    await db.initialize();
    metadataService = new MetadataService();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    try {
      await db.query('DELETE FROM object_fields');
      await db.query('DELETE FROM object_definitions');
      await db.query('DELETE FROM field_definitions');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    try {
      await db.query('DELETE FROM object_fields');
      await db.query('DELETE FROM object_definitions');
      await db.query('DELETE FROM field_definitions');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should store and retrieve field groups configuration', async () => {
    // Create fields
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    const emailField: FieldDefinition = {
      shortName: `email_${Date.now()}`,
      displayName: 'Email',
      description: 'User email',
      datatype: FieldDatatype.EMAIL,
      datatypeProperties: {},
      mandatory: true
    };

    const phoneField: FieldDefinition = {
      shortName: `phone_${Date.now()}`,
      displayName: 'Phone',
      description: 'User phone',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: false
    };

    await metadataService.registerField(nameField);
    await metadataService.registerField(emailField);
    await metadataService.registerField(phoneField);

    // Create object with field groups
    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 },
        { fieldShortName: emailField.shortName, mandatory: true, order: 2 },
        { fieldShortName: phoneField.shortName, mandatory: false, order: 3 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          fields: [nameField.shortName],
          order: 1
        },
        {
          name: 'Contact Information',
          description: 'User contact details',
          fields: [emailField.shortName, phoneField.shortName],
          order: 2
        }
      ]
    };

    const registered = await metadataService.registerObject(objectDef);
    expect(registered.fieldGroups).toBeDefined();
    expect(registered.fieldGroups).toHaveLength(2);
    expect(registered.fieldGroups![0].name).toBe('Basic Information');
    expect(registered.fieldGroups![0].fields).toContain(nameField.shortName);
    expect(registered.fieldGroups![1].name).toBe('Contact Information');
    expect(registered.fieldGroups![1].fields).toContain(emailField.shortName);
    expect(registered.fieldGroups![1].fields).toContain(phoneField.shortName);

    // Retrieve and verify
    const retrieved = await metadataService.getObjectByShortName(objectDef.shortName);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.fieldGroups).toBeDefined();
    expect(retrieved!.fieldGroups).toHaveLength(2);
    expect(retrieved!.fieldGroups![0].name).toBe('Basic Information');
    expect(retrieved!.fieldGroups![1].name).toBe('Contact Information');

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
    await metadataService.deleteField(emailField.shortName);
    await metadataService.deleteField(phoneField.shortName);
  });

  it('should reject field groups with non-existent fields', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          fields: [nameField.shortName, 'nonexistent_field'],
          order: 1
        }
      ]
    };

    await expect(metadataService.registerObject(objectDef)).rejects.toThrow(
      /does not exist in the object's fields list/
    );

    // Clean up
    await metadataService.deleteField(nameField.shortName);
  });

  it('should allow objects without field groups', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {}
    };

    const registered = await metadataService.registerObject(objectDef);
    expect(registered.fieldGroups).toBeUndefined();

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
  });

  it('should update field groups configuration', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    const emailField: FieldDefinition = {
      shortName: `email_${Date.now()}`,
      displayName: 'Email',
      description: 'User email',
      datatype: FieldDatatype.EMAIL,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);
    await metadataService.registerField(emailField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 },
        { fieldShortName: emailField.shortName, mandatory: true, order: 2 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          fields: [nameField.shortName],
          order: 1
        }
      ]
    };

    await metadataService.registerObject(objectDef);

    // Update with new field groups
    const updated = await metadataService.updateObject(objectDef.shortName, {
      fieldGroups: [
        {
          name: 'All Information',
          description: 'All user information',
          fields: [nameField.shortName, emailField.shortName],
          order: 1
        }
      ]
    });

    expect(updated).not.toBeNull();
    expect(updated!.fieldGroups).toBeDefined();
    expect(updated!.fieldGroups).toHaveLength(1);
    expect(updated!.fieldGroups![0].name).toBe('All Information');
    expect(updated!.fieldGroups![0].fields).toHaveLength(2);

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
    await metadataService.deleteField(emailField.shortName);
  });

  it('should reject field groups without a name', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          description: 'Basic user information',
          fields: [nameField.shortName],
          order: 1
        } as any
      ]
    };

    await expect(metadataService.registerObject(objectDef as any)).rejects.toThrow(
      /must have a name/
    );

    // Clean up
    await metadataService.deleteField(nameField.shortName);
  });

  it('should reject field groups without a description', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          fields: [nameField.shortName],
          order: 1
        } as any
      ]
    };

    await expect(metadataService.registerObject(objectDef as any)).rejects.toThrow(
      /must have a description/
    );

    // Clean up
    await metadataService.deleteField(nameField.shortName);
  });

  it('should reject field groups without a fields array', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          order: 1
        } as any
      ]
    };

    await expect(metadataService.registerObject(objectDef as any)).rejects.toThrow(
      /must have a fields array/
    );

    // Clean up
    await metadataService.deleteField(nameField.shortName);
  });

  it('should reject field groups without an order number', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          fields: [nameField.shortName]
        } as any
      ]
    };

    await expect(metadataService.registerObject(objectDef as any)).rejects.toThrow(
      /must have an order number/
    );

    // Clean up
    await metadataService.deleteField(nameField.shortName);
  });

  it('should reject field groups with invalid field references during update', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Information',
          description: 'Basic user information',
          fields: [nameField.shortName],
          order: 1
        }
      ]
    };

    await metadataService.registerObject(objectDef);

    // Try to update with invalid field reference
    await expect(
      metadataService.updateObject(objectDef.shortName, {
        fieldGroups: [
          {
            name: 'Invalid Group',
            description: 'Group with invalid field',
            fields: ['nonexistent_field'],
            order: 1
          }
        ]
      })
    ).rejects.toThrow(/does not exist in the object's fields list/);

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
  });

  it('should allow multiple fields in a single group', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    const emailField: FieldDefinition = {
      shortName: `email_${Date.now()}`,
      displayName: 'Email',
      description: 'User email',
      datatype: FieldDatatype.EMAIL,
      datatypeProperties: {},
      mandatory: true
    };

    const phoneField: FieldDefinition = {
      shortName: `phone_${Date.now()}`,
      displayName: 'Phone',
      description: 'User phone',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: false
    };

    await metadataService.registerField(nameField);
    await metadataService.registerField(emailField);
    await metadataService.registerField(phoneField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 },
        { fieldShortName: emailField.shortName, mandatory: true, order: 2 },
        { fieldShortName: phoneField.shortName, mandatory: false, order: 3 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'All Contact Info',
          description: 'All contact information',
          fields: [nameField.shortName, emailField.shortName, phoneField.shortName],
          order: 1
        }
      ]
    };

    const registered = await metadataService.registerObject(objectDef);
    expect(registered.fieldGroups).toBeDefined();
    expect(registered.fieldGroups![0].fields).toHaveLength(3);
    expect(registered.fieldGroups![0].fields).toContain(nameField.shortName);
    expect(registered.fieldGroups![0].fields).toContain(emailField.shortName);
    expect(registered.fieldGroups![0].fields).toContain(phoneField.shortName);

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
    await metadataService.deleteField(emailField.shortName);
    await metadataService.deleteField(phoneField.shortName);
  });

  it('should allow empty field groups array', async () => {
    const nameField: FieldDefinition = {
      shortName: `name_${Date.now()}`,
      displayName: 'Name',
      description: 'User name',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(nameField);

    const objectDef = {
      shortName: `user_${Date.now()}`,
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: nameField.shortName, mandatory: true, order: 1 }
      ],
      displayProperties: {},
      fieldGroups: []
    };

    const registered = await metadataService.registerObject(objectDef);
    expect(registered.fieldGroups).toBeDefined();
    expect(registered.fieldGroups).toHaveLength(0);

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(nameField.shortName);
  });

  it('should preserve field groups order', async () => {
    const field1: FieldDefinition = {
      shortName: `field1_${Date.now()}`,
      displayName: 'Field 1',
      description: 'First field',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    const field2: FieldDefinition = {
      shortName: `field2_${Date.now()}`,
      displayName: 'Field 2',
      description: 'Second field',
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
      mandatory: true
    };

    await metadataService.registerField(field1);
    await metadataService.registerField(field2);

    const objectDef = {
      shortName: `test_${Date.now()}`,
      displayName: 'Test',
      description: 'Test object',
      fields: [
        { fieldShortName: field1.shortName, mandatory: true, order: 1 },
        { fieldShortName: field2.shortName, mandatory: true, order: 2 }
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Group B',
          description: 'Second group',
          fields: [field2.shortName],
          order: 2
        },
        {
          name: 'Group A',
          description: 'First group',
          fields: [field1.shortName],
          order: 1
        }
      ]
    };

    const registered = await metadataService.registerObject(objectDef);
    expect(registered.fieldGroups).toBeDefined();
    expect(registered.fieldGroups).toHaveLength(2);
    
    // Verify order is preserved as specified
    expect(registered.fieldGroups![0].order).toBe(2);
    expect(registered.fieldGroups![0].name).toBe('Group B');
    expect(registered.fieldGroups![1].order).toBe(1);
    expect(registered.fieldGroups![1].name).toBe('Group A');

    // Clean up
    await metadataService.deleteObject(objectDef.shortName);
    await metadataService.deleteField(field1.shortName);
    await metadataService.deleteField(field2.shortName);
  });
});
