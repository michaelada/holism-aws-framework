import { Router, Request, Response } from 'express';
import { metadataService } from '../services/metadata.service';
import { FieldDefinition, ObjectDefinition } from '../types/metadata.types';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all metadata routes
router.use(authenticateToken());

/**
 * Field Definition Routes
 */

/**
 * @swagger
 * /api/metadata/fields:
 *   post:
 *     summary: Register a new field definition
 *     description: Create a new field definition that can be used in object definitions. Requires admin role.
 *     tags: [Metadata - Fields]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FieldDefinition'
 *           example:
 *             shortName: "user_email"
 *             displayName: "Email Address"
 *             description: "User email address for login and notifications"
 *             datatype: "email"
 *             datatypeProperties: {}
 *             mandatory: true
 *             validationRules:
 *               - type: "email"
 *                 message: "Please enter a valid email address"
 *     responses:
 *       201:
 *         description: Field definition created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FieldDefinition'
 *       400:
 *         description: Validation error - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - field with this short name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/fields', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const field: FieldDefinition = req.body;

    // Basic validation
    if (!field.shortName || !field.displayName || !field.datatype) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: shortName, displayName, and datatype are required',
          details: []
        }
      });
    }

    const registered = await metadataService.registerField(field);
    return res.status(201).json(registered);
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ERROR',
          message: `Field with short name '${req.body.shortName}' already exists`
        }
      });
    }

    console.error('Error registering field:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register field'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/fields:
 *   get:
 *     summary: List all field definitions
 *     description: Retrieve all registered field definitions
 *     tags: [Metadata - Fields]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of field definitions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FieldDefinition'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/fields', async (_req: Request, res: Response) => {
  try {
    const fields = await metadataService.getAllFields();
    return res.json(fields);
  } catch (error) {
    console.error('Error fetching fields:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch fields'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/fields/{shortName}:
 *   get:
 *     summary: Get a field definition by short name
 *     description: Retrieve a single field definition by its short name
 *     tags: [Metadata - Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Field short name
 *         example: "user_email"
 *     responses:
 *       200:
 *         description: Field definition found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FieldDefinition'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Field not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/fields/:shortName', async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const field = await metadataService.getFieldByShortName(shortName);

    if (!field) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Field '${shortName}' not found`
        }
      });
    }

    return res.json(field);
  } catch (error) {
    console.error('Error fetching field:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch field'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/fields/{shortName}:
 *   put:
 *     summary: Update a field definition
 *     description: Update an existing field definition. Requires admin role.
 *     tags: [Metadata - Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Field short name
 *         example: "user_email"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FieldDefinition'
 *           example:
 *             displayName: "Email Address (Updated)"
 *             description: "Updated description"
 *     responses:
 *       200:
 *         description: Field definition updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FieldDefinition'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Field not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/fields/:shortName', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const updates: Partial<FieldDefinition> = req.body;

    const updated = await metadataService.updateField(shortName, updates);

    if (!updated) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Field '${shortName}' not found`
        }
      });
    }

    return res.json(updated);
  } catch (error) {
    console.error('Error updating field:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update field'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/fields/{shortName}:
 *   delete:
 *     summary: Delete a field definition
 *     description: Delete a field definition. Cannot delete if referenced by object definitions. Requires admin role.
 *     tags: [Metadata - Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Field short name
 *         example: "user_email"
 *     responses:
 *       204:
 *         description: Field definition deleted successfully
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Field not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - field is referenced by object definitions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/fields/:shortName', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const deleted = await metadataService.deleteField(shortName);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Field '${shortName}' not found`
        }
      });
    }

    return res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(409).json({
        error: {
          code: 'CONSTRAINT_ERROR',
          message: `Cannot delete field '${req.params.shortName}' because it is referenced by object definitions`
        }
      });
    }

    console.error('Error deleting field:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete field'
      }
    });
  }
});

/**
 * Object Definition Routes
 */

/**
 * @swagger
 * /api/metadata/objects:
 *   post:
 *     summary: Register a new object definition
 *     description: Create a new object definition with field references. Requires admin role.
 *     tags: [Metadata - Objects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ObjectDefinition'
 *           example:
 *             shortName: "customer"
 *             displayName: "Customer"
 *             description: "Customer information and contact details"
 *             fields:
 *               - fieldShortName: "customer_name"
 *                 mandatory: true
 *                 order: 1
 *               - fieldShortName: "customer_email"
 *                 mandatory: true
 *                 order: 2
 *             displayProperties:
 *               defaultSortField: "customer_name"
 *               defaultSortOrder: "asc"
 *               searchableFields: ["customer_name", "customer_email"]
 *               tableColumns: ["customer_name", "customer_email"]
 *     responses:
 *       201:
 *         description: Object definition created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ObjectDefinition'
 *       400:
 *         description: Validation error - missing required fields or invalid field references
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflict - object with this short name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/objects', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const object: ObjectDefinition = req.body;

    // Basic validation
    if (!object.shortName || !object.displayName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: shortName and displayName are required',
          details: []
        }
      });
    }

    // Ensure fields is an array (can be empty)
    if (!object.fields) {
      object.fields = [];
    }

    const registered = await metadataService.registerObject(object);
    return res.status(201).json(registered);
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ERROR',
          message: `Object with short name '${req.body.shortName}' already exists`
        }
      });
    }

    if (error.message && error.message.includes('does not exist')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: []
        }
      });
    }

    console.error('Error registering object:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register object'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/objects:
 *   get:
 *     summary: List all object definitions
 *     description: Retrieve all registered object definitions
 *     tags: [Metadata - Objects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of object definitions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ObjectDefinition'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/objects', async (_req: Request, res: Response) => {
  try {
    const objects = await metadataService.getAllObjects();
    return res.json(objects);
  } catch (error) {
    console.error('Error fetching objects:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch objects'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/objects/{shortName}:
 *   get:
 *     summary: Get an object definition by short name
 *     description: Retrieve a single object definition by its short name
 *     tags: [Metadata - Objects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Object short name
 *         example: "customer"
 *     responses:
 *       200:
 *         description: Object definition found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ObjectDefinition'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/objects/:shortName', async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const object = await metadataService.getObjectByShortName(shortName);

    if (!object) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Object '${shortName}' not found`
        }
      });
    }

    return res.json(object);
  } catch (error) {
    console.error('Error fetching object:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch object'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/objects/{shortName}:
 *   put:
 *     summary: Update an object definition
 *     description: Update an existing object definition. Requires admin role.
 *     tags: [Metadata - Objects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Object short name
 *         example: "customer"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ObjectDefinition'
 *           example:
 *             displayName: "Customer (Updated)"
 *             description: "Updated description"
 *     responses:
 *       200:
 *         description: Object definition updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ObjectDefinition'
 *       400:
 *         description: Validation error - invalid field references
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/objects/:shortName', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const updates: Partial<ObjectDefinition> = req.body;

    const updated = await metadataService.updateObject(shortName, updates);

    if (!updated) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Object '${shortName}' not found`
        }
      });
    }

    return res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('does not exist')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: []
        }
      });
    }

    console.error('Error updating object:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update object'
      }
    });
  }
});

/**
 * @swagger
 * /api/metadata/objects/{shortName}:
 *   delete:
 *     summary: Delete an object definition
 *     description: Delete an object definition and its associated instance table. Requires admin role.
 *     tags: [Metadata - Objects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortName
 *         required: true
 *         schema:
 *           type: string
 *         description: Object short name
 *         example: "customer"
 *     responses:
 *       204:
 *         description: Object definition deleted successfully
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/objects/:shortName', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { shortName } = req.params;
    const deleted = await metadataService.deleteObject(shortName);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Object '${shortName}' not found`
        }
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting object:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete object'
      }
    });
  }
});

export default router;
