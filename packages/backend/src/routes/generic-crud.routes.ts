import { Router, Request, Response } from 'express';
import { genericCrudService } from '../services/generic-crud.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all generic CRUD routes
router.use(authenticateToken());

/**
 * @swagger
 * /api/objects/{objectType}/instances:
 *   get:
 *     summary: List instances of an object type
 *     description: Retrieve instances with optional filtering, sorting, and pagination
 *     tags: [Generic CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectType
 *         required: true
 *         schema:
 *           type: string
 *         description: Object type short name
 *         example: "customer"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by
 *         example: "name"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term (searches searchable fields)
 *     responses:
 *       200:
 *         description: List of instances with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListResponse'
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object type not found
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
router.get('/:objectType/instances', async (req: Request, res: Response) => {
  try {
    const { objectType } = req.params;
    const {
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      ...filters
    } = req.query;

    const params = {
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      search: search as string | undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined
    };

    const result = await genericCrudService.listInstances(objectType, params);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    } else {
      console.error('Error listing instances:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
});

/**
 * @swagger
 * /api/objects/{objectType}/instances/{id}:
 *   get:
 *     summary: Get a single instance by ID
 *     description: Retrieve a specific instance of an object type
 *     tags: [Generic CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectType
 *         required: true
 *         schema:
 *           type: string
 *         description: Object type short name
 *         example: "customer"
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Instance found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object type or instance not found
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
router.get('/:objectType/instances/:id', async (req: Request, res: Response) => {
  try {
    const { objectType, id } = req.params;
    const instance = await genericCrudService.getInstance(objectType, id);

    if (!instance) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Instance with ID '${id}' not found`
        }
      });
      return;
    }

    res.json(instance);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    } else {
      console.error('Error getting instance:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
});

/**
 * @swagger
 * /api/objects/{objectType}/instances:
 *   post:
 *     summary: Create a new instance
 *     description: Create a new instance of an object type with validation. Requires user or admin role.
 *     tags: [Generic CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectType
 *         required: true
 *         schema:
 *           type: string
 *         description: Object type short name
 *         example: "customer"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             name: "John Doe"
 *             email: "john@example.com"
 *             phone: "+1234567890"
 *     responses:
 *       201:
 *         description: Instance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Validation error - missing required fields or invalid values
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
 *         description: Forbidden - requires user or admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object type not found
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
router.post('/:objectType/instances', requireRole(['user', 'admin']), async (req: Request, res: Response) => {
  try {
    const { objectType } = req.params;
    const data = req.body;

    const instance = await genericCrudService.createInstance(objectType, data);
    res.status(201).json(instance);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    } else if (error.validationErrors) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.validationErrors
        }
      });
    } else {
      console.error('Error creating instance:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
});

/**
 * @swagger
 * /api/objects/{objectType}/instances/{id}:
 *   put:
 *     summary: Update an existing instance
 *     description: Update an instance with validation. Requires user or admin role.
 *     tags: [Generic CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectType
 *         required: true
 *         schema:
 *           type: string
 *         description: Object type short name
 *         example: "customer"
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             name: "John Doe Updated"
 *             email: "john.updated@example.com"
 *     responses:
 *       200:
 *         description: Instance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Validation error - invalid values
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
 *         description: Forbidden - requires user or admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object type or instance not found
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
router.put('/:objectType/instances/:id', requireRole(['user', 'admin']), async (req: Request, res: Response) => {
  try {
    const { objectType, id } = req.params;
    const data = req.body;

    const instance = await genericCrudService.updateInstance(objectType, id, data);

    if (!instance) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Instance with ID '${id}' not found`
        }
      });
      return;
    }

    res.json(instance);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    } else if (error.validationErrors) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.validationErrors
        }
      });
    } else {
      console.error('Error updating instance:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
});

/**
 * @swagger
 * /api/objects/{objectType}/instances/{id}:
 *   delete:
 *     summary: Delete an instance
 *     description: Delete an instance by ID. Requires user or admin role.
 *     tags: [Generic CRUD]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectType
 *         required: true
 *         schema:
 *           type: string
 *         description: Object type short name
 *         example: "customer"
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       204:
 *         description: Instance deleted successfully
 *       401:
 *         description: Unauthorized - invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - requires user or admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Object type or instance not found
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
router.delete('/:objectType/instances/:id', requireRole(['user', 'admin']), async (req: Request, res: Response) => {
  try {
    const { objectType, id } = req.params;
    const deleted = await genericCrudService.deleteInstance(objectType, id);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Instance with ID '${id}' not found`
        }
      });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    } else {
      console.error('Error deleting instance:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
});

export default router;
