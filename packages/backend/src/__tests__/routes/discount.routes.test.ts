/**
 * Integration Tests for Discount Routes
 * 
 * Tests all discount API endpoints including:
 * - CRUD operations (tasks 9.2)
 * - Application operations (tasks 10.2)
 * - Validation operations (tasks 11.2)
 * - Usage operations (tasks 12.2)
 * 
 * Requirements: 16.1-16.13
 */

// Mock the database pool BEFORE any imports
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
    getPool: jest.fn(() => ({
      query: jest.fn()
    })),
    initialize: jest.fn(),
    close: jest.fn(),
    isHealthy: jest.fn()
  }
}));

// Mock the auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => {
    return (req: any, res: any, next: any) => {
      if (req.headers.authorization === 'Bearer valid-token') {
        req.user = {
          userId: 'test-user-123',
          email: 'test@example.com',
          username: 'testuser',
          roles: ['org-admin'],
          groups: [],
          organisationId: 'test-org-123'
        };
        next();
      } else {
        res.status(401).json({ 
          error: { 
            code: 'UNAUTHORIZED',
            message: 'Authentication required' 
          } 
        });
      }
    };
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAllRoles: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: () => (_req: any, _res: any, next: any) => next(),
  requireAdminRole: () => (_req: any, _res: any, next: any) => next(),
  optionalAuth: () => (_req: any, _res: any, next: any) => next()
}));

// Mock the capability middleware
jest.mock('../../middleware/capability.middleware', () => ({
  requireOrgAdminCapability: (_capability: string) => {
    // Return an array of middleware functions
    return [(req: any, _res: any, next: any) => {
      // Always allow in tests when authenticated
      if (req.user) {
        next();
      } else {
        next(new Error('Insufficient permissions'));
      }
    }];
  },
  loadOrganisationCapabilities: () => (_req: any, _res: any, next: any) => next(),
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
  requireAllCapabilities: () => (_req: any, _res: any, next: any) => next()
}));

import request from 'supertest';
import { app } from '../../index';
import { discountService } from '../../services/discount.service';
import { discountValidatorService } from '../../services/discount-validator.service';
import { discountCalculatorService } from '../../services/discount-calculator.service';

// Mock the services
jest.mock('../../services/discount.service');
jest.mock('../../services/discount-validator.service');
jest.mock('../../services/discount-calculator.service');

describe('Discount Routes - CRUD Operations (Task 9.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orgadmin/discounts - Create Discount', () => {
    it('should create a discount with valid data', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.create as jest.Mock).mockResolvedValue(mockDiscount);

      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Summer Sale',
          discountType: 'percentage',
          discountValue: 20,
          applicationScope: 'item'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20
      });
      expect(discountService.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Summer Sale',
        moduleType: 'events'
      }));
    });

    it('should return 400 when module type is missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          name: 'Summer Sale',
          discountType: 'percentage',
          discountValue: 20
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Module type is required');
    });

    it('should return 400 when validation fails', async () => {
      (discountService.create as jest.Mock).mockRejectedValue(
        new Error('Discount value must be between 0 and 100 for percentage discounts')
      );

      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Invalid Discount',
          discountType: 'percentage',
          discountValue: 150,
          applicationScope: 'item'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Discount value must be between 0 and 100');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Summer Sale'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/orgadmin/discounts/:id - Get Discount by ID', () => {
    it('should return discount when found', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      if (response.status !== 200) {
        console.log('Response body:', response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20
      });
      expect(discountService.getById).toHaveBeenCalledWith('discount-1', 'test-org-123');
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orgadmin/discounts/nonexistent?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });

    it('should return 400 when organisation ID is missing', async () => {
      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Organisation ID is required');
    });
  });

  describe('PUT /api/orgadmin/discounts/:id - Update Discount', () => {
    it('should update discount with valid data', async () => {
      const existingDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedDiscount = { ...existingDiscount, discountValue: 25 };

      (discountService.getById as jest.Mock).mockResolvedValue(existingDiscount);
      (discountService.update as jest.Mock).mockResolvedValue(updatedDiscount);

      const response = await request(app)
        .put('/api/orgadmin/discounts/discount-1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          discountValue: 25
        });

      expect(response.status).toBe(200);
      expect(response.body.discountValue).toBe(25);
      expect(discountService.update).toHaveBeenCalledWith('discount-1', 'test-org-123', expect.any(Object));
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/orgadmin/discounts/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          discountValue: 25
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });

    it('should return 400 when organisation ID is missing', async () => {
      const response = await request(app)
        .put('/api/orgadmin/discounts/discount-1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountValue: 25
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Organisation ID is required');
    });
  });

  describe('DELETE /api/orgadmin/discounts/:id - Delete Discount', () => {
    it('should delete discount successfully', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(discountService.delete).toHaveBeenCalledWith('discount-1', 'test-org-123');
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/nonexistent?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });
  });

  describe('GET /api/orgadmin/organisations/:organisationId/discounts - List Discounts', () => {
    it('should return paginated discounts', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Summer Sale',
          discountType: 'percentage',
          discountValue: 20,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'discount-2',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Winter Sale',
          discountType: 'fixed',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: mockDiscounts,
        total: 2
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.discounts).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', undefined, 1, 50);
    });

    it('should filter by module type', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Event Discount',
          discountType: 'percentage',
          discountValue: 20,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: mockDiscounts,
        total: 1
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts?moduleType=events')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.discounts).toHaveLength(1);
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', 'events', 1, 50);
    });

    it('should support pagination', async () => {
      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: [],
        total: 100
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts?page=2&pageSize=25')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', undefined, 2, 25);
    });
  });
});

describe('Discount Routes - Application Operations (Task 10.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orgadmin/discounts/:id/apply - Apply Discount', () => {
    it('should apply discount to target successfully', async () => {
      (discountService.applyToTarget as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/orgadmin/discounts/discount-1/apply')
        .set('Authorization', 'Bearer valid-token')
        .send({
          targetType: 'event',
          targetId: 'event-123',
          appliedBy: 'test-user-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Discount applied successfully');
      expect(discountService.applyToTarget).toHaveBeenCalledWith(
        'discount-1',
        'event',
        'event-123',
        'test-user-123'
      );
    });

    it('should return 400 when target type is missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/discount-1/apply')
        .set('Authorization', 'Bearer valid-token')
        .send({
          targetId: 'event-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Target type and ID are required');
    });

    it('should return 400 when target ID is missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/discount-1/apply')
        .set('Authorization', 'Bearer valid-token')
        .send({
          targetType: 'event'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Target type and ID are required');
    });

    it('should return 400 when applying inactive discount', async () => {
      (discountService.applyToTarget as jest.Mock).mockRejectedValue(
        new Error('Cannot apply inactive discount')
      );

      const response = await request(app)
        .post('/api/orgadmin/discounts/discount-1/apply')
        .set('Authorization', 'Bearer valid-token')
        .send({
          targetType: 'event',
          targetId: 'event-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot apply inactive discount');
    });
  });

  describe('DELETE /api/orgadmin/discounts/:id/apply/:targetType/:targetId - Remove Discount', () => {
    it('should remove discount from target successfully', async () => {
      (discountService.removeFromTarget as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1/apply/event/event-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(discountService.removeFromTarget).toHaveBeenCalledWith(
        'discount-1',
        'event',
        'event-123'
      );
    });

    it('should return 404 when discount application not found', async () => {
      (discountService.removeFromTarget as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1/apply/event/event-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount application not found');
    });
  });

  describe('GET /api/orgadmin/discounts/target/:targetType/:targetId - Get Discounts for Target', () => {
    it('should return all discounts for a target', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Early Bird',
          discountType: 'percentage',
          discountValue: 15,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'discount-2',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Member Discount',
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (discountService.getForTarget as jest.Mock).mockResolvedValue(mockDiscounts);

      const response = await request(app)
        .get('/api/orgadmin/discounts/target/event/event-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(discountService.getForTarget).toHaveBeenCalledWith('event', 'event-123');
    });

    it('should return empty array when no discounts applied', async () => {
      (discountService.getForTarget as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/orgadmin/discounts/target/event/event-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});

describe('Discount Routes - Validation Operations (Task 11.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orgadmin/discounts/validate - Validate Discount', () => {
    it('should validate discount successfully', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockValidationResult = {
        valid: true,
        errors: []
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountValidatorService.validateDiscount as jest.Mock).mockResolvedValue(mockValidationResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          userId: 'user-123',
          amount: 100,
          quantity: 2,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(discountValidatorService.validateDiscount).toHaveBeenCalledWith(
        mockDiscount,
        'user-123',
        100,
        2
      );
    });

    it('should return validation errors when discount is invalid', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Expired Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'expired',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockValidationResult = {
        valid: false,
        errors: [
          { code: 'DISCOUNT_EXPIRED', message: 'Discount has expired' }
        ]
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountValidatorService.validateDiscount as jest.Mock).mockResolvedValue(mockValidationResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          userId: 'user-123',
          amount: 100,
          quantity: 1,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].code).toBe('DISCOUNT_EXPIRED');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          userId: 'user-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/orgadmin/discounts/validate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'nonexistent',
          userId: 'user-123',
          amount: 100,
          quantity: 1,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });
  });

  describe('POST /api/orgadmin/discounts/validate-code - Validate Discount Code', () => {
    it('should validate discount code successfully', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        code: 'SUMMER20',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountValidatorService.validateCode as jest.Mock).mockResolvedValue(mockDiscount);

      const response = await request(app)
        .post('/api/orgadmin/discounts/validate-code')
        .set('Authorization', 'Bearer valid-token')
        .send({
          code: 'SUMMER20',
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('SUMMER20');
      expect(discountValidatorService.validateCode).toHaveBeenCalledWith('SUMMER20', 'test-org-123');
    });

    it('should return 404 when code not found', async () => {
      (discountValidatorService.validateCode as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/orgadmin/discounts/validate-code')
        .set('Authorization', 'Bearer valid-token')
        .send({
          code: 'INVALID',
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount code not found');
    });

    it('should return 400 when code is missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/validate-code')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code and organisation ID are required');
    });

    it('should return 400 when organisation ID is missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/validate-code')
        .set('Authorization', 'Bearer valid-token')
        .send({
          code: 'SUMMER20'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Code and organisation ID are required');
    });
  });

  describe('POST /api/orgadmin/discounts/calculate - Calculate Discount', () => {
    it('should calculate item discount successfully', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCalculationResult = {
        originalAmount: 100,
        discountAmount: 20,
        finalAmount: 80,
        appliedDiscounts: [
          {
            discountId: 'discount-1',
            discountName: 'Summer Sale',
            discountAmount: 20
          }
        ]
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountCalculatorService.calculateItemDiscount as jest.Mock).mockReturnValue(mockCalculationResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          itemPrice: 100,
          quantity: 1,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.originalAmount).toBe(100);
      expect(response.body.discountAmount).toBe(20);
      expect(response.body.finalAmount).toBe(80);
      expect(discountCalculatorService.calculateItemDiscount).toHaveBeenCalledWith(mockDiscount, 100, 1);
    });

    it('should calculate quantity-based discount', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Buy 2 Get 1 Free',
        discountType: 'percentage',
        discountValue: 100,
        applicationScope: 'quantity-based',
        quantityRules: {
          minimumQuantity: 2,
          applyToQuantity: 1
        },
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCalculationResult = {
        originalAmount: 150,
        discountAmount: 50,
        finalAmount: 100,
        appliedDiscounts: [
          {
            discountId: 'discount-1',
            discountName: 'Buy 2 Get 1 Free',
            discountAmount: 50
          }
        ]
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountCalculatorService.calculateQuantityDiscount as jest.Mock).mockReturnValue(mockCalculationResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          itemPrice: 50,
          quantity: 3,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.discountAmount).toBe(50);
      expect(discountCalculatorService.calculateQuantityDiscount).toHaveBeenCalledWith(mockDiscount, 50, 3);
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'discount-1',
          itemPrice: 100
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          discountId: 'nonexistent',
          itemPrice: 100,
          quantity: 1,
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });
  });

  describe('POST /api/orgadmin/discounts/calculate-cart - Calculate Cart Discounts', () => {
    it('should calculate cart discounts successfully', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Cart Discount',
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'cart',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockCartResult = {
        items: [
          {
            itemId: 'item-1',
            originalAmount: 100,
            discountAmount: 10,
            finalAmount: 90
          }
        ],
        cartTotal: {
          originalAmount: 100,
          discountAmount: 10,
          finalAmount: 90
        },
        appliedDiscounts: [
          {
            discountId: 'discount-1',
            discountName: 'Cart Discount',
            discountAmount: 10
          }
        ]
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscounts[0]);
      (discountCalculatorService.calculateCartDiscounts as jest.Mock).mockReturnValue(mockCartResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate-cart')
        .set('Authorization', 'Bearer valid-token')
        .send({
          cartItems: [
            { itemId: 'item-1', price: 100, quantity: 1 }
          ],
          discountIds: ['discount-1'],
          userId: 'user-123',
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.cartTotal.finalAmount).toBe(90);
      expect(discountCalculatorService.calculateCartDiscounts).toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate-cart')
        .set('Authorization', 'Bearer valid-token')
        .send({
          cartItems: [{ itemId: 'item-1', price: 100, quantity: 1 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields');
    });

    it('should handle empty cart', async () => {
      const mockCartResult = {
        items: [],
        cartTotal: {
          originalAmount: 0,
          discountAmount: 0,
          finalAmount: 0
        },
        appliedDiscounts: []
      };

      (discountCalculatorService.calculateCartDiscounts as jest.Mock).mockReturnValue(mockCartResult);

      const response = await request(app)
        .post('/api/orgadmin/discounts/calculate-cart')
        .set('Authorization', 'Bearer valid-token')
        .send({
          cartItems: [],
          discountIds: [],
          userId: 'user-123',
          organisationId: 'test-org-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.cartTotal.finalAmount).toBe(0);
    });
  });
});

describe('Discount Routes - Usage Operations (Task 12.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orgadmin/discounts/:id/usage - Get Usage History', () => {
    it('should return usage history with pagination', async () => {
      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/usage?page=1&pageSize=10')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.usage)).toBe(true);
    });

    it('should return empty array when no usage history', async () => {
      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/usage')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.usage).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/usage?page=2&pageSize=25')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('usage');
    });
  });

  describe('GET /api/orgadmin/discounts/:id/stats - Get Usage Statistics', () => {
    it('should return usage statistics', async () => {
      const mockStats = {
        totalUses: 50,
        remainingUses: 50,
        totalDiscountGiven: 1000,
        averageDiscountAmount: 20,
        topUsers: [
          {
            userId: 'user-1',
            usageCount: 10,
            totalDiscountReceived: 200
          },
          {
            userId: 'user-2',
            usageCount: 8,
            totalDiscountReceived: 160
          }
        ]
      };

      (discountService.getUsageStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/stats')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalUses).toBe(50);
      expect(response.body.totalDiscountGiven).toBe(1000);
      expect(response.body.averageDiscountAmount).toBe(20);
      expect(response.body.topUsers).toHaveLength(2);
      expect(discountService.getUsageStats).toHaveBeenCalledWith('discount-1');
    });

    it('should return zero stats when discount has no usage', async () => {
      const mockStats = {
        totalUses: 0,
        remainingUses: 100,
        totalDiscountGiven: 0,
        averageDiscountAmount: 0,
        topUsers: []
      };

      (discountService.getUsageStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-2/stats')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalUses).toBe(0);
      expect(response.body.totalDiscountGiven).toBe(0);
      expect(response.body.topUsers).toEqual([]);
    });

    it('should handle unlimited usage discounts', async () => {
      const mockStats = {
        totalUses: 25,
        remainingUses: undefined,
        totalDiscountGiven: 500,
        averageDiscountAmount: 20,
        topUsers: []
      };

      (discountService.getUsageStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-3/stats')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.totalUses).toBe(25);
      expect(response.body.remainingUses).toBeUndefined();
    });

    it('should return 500 when service fails', async () => {
      (discountService.getUsageStats as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/stats')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch usage statistics');
    });
  });
});

describe('Discount Routes - Authentication and Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const endpoints = [
        { method: 'get' as const, path: '/api/orgadmin/organisations/test-org-123/discounts' },
        { method: 'post' as const, path: '/api/orgadmin/discounts' },
        { method: 'get' as const, path: '/api/orgadmin/discounts/discount-1?organisationId=test-org-123' },
        { method: 'put' as const, path: '/api/orgadmin/discounts/discount-1' },
        { method: 'delete' as const, path: '/api/orgadmin/discounts/discount-1?organisationId=test-org-123' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected server errors', async () => {
      (discountService.getByOrganisation as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch discounts');
    });

    it('should handle service errors gracefully', async () => {
      (discountService.create as jest.Mock).mockRejectedValue(
        new Error('Database constraint violation')
      );

      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Test Discount',
          discountType: 'percentage',
          discountValue: 20,
          applicationScope: 'item'
        });

      // The route catches the error and returns 400 with the error message
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Database constraint violation');
    });
  });
});

describe('Discount Routes - Module Type Filtering and Membership Types (Task 7.6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orgadmin/organisations/:organisationId/discounts/:moduleType - Filter by Module Type', () => {
    it('should filter discounts by memberships module type', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'memberships',
          name: 'Membership Discount',
          discountType: 'percentage',
          discountValue: 15,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'discount-2',
          organisationId: 'test-org-123',
          moduleType: 'memberships',
          name: 'Another Membership Discount',
          discountType: 'fixed',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: mockDiscounts,
        total: 2
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts/memberships')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.discounts).toHaveLength(2);
      expect(response.body.discounts[0].moduleType).toBe('memberships');
      expect(response.body.discounts[1].moduleType).toBe('memberships');
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', 'memberships', 1, 50);
    });

    it('should filter discounts by events module type', async () => {
      const mockDiscounts = [
        {
          id: 'discount-1',
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'Event Discount',
          discountType: 'percentage',
          discountValue: 20,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: mockDiscounts,
        total: 1
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts/events')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.discounts).toHaveLength(1);
      expect(response.body.discounts[0].moduleType).toBe('events');
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', 'events', 1, 50);
    });

    it('should return empty array when no discounts match module type', async () => {
      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts/calendar')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.discounts).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should support pagination with module type filter', async () => {
      (discountService.getByOrganisation as jest.Mock).mockResolvedValue({
        discounts: [],
        total: 50
      });

      const response = await request(app)
        .get('/api/orgadmin/organisations/test-org-123/discounts/memberships?page=2&pageSize=20')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(discountService.getByOrganisation).toHaveBeenCalledWith('test-org-123', 'memberships', 2, 20);
    });
  });

  describe('POST /api/orgadmin/discounts - Create with Module Type', () => {
    it('should create discount with memberships module type', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'New Membership Discount',
        discountType: 'percentage',
        discountValue: 25,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.create as jest.Mock).mockResolvedValue(mockDiscount);

      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'memberships',
          name: 'New Membership Discount',
          discountType: 'percentage',
          discountValue: 25,
          applicationScope: 'item'
        });

      expect(response.status).toBe(201);
      expect(response.body.moduleType).toBe('memberships');
      expect(discountService.create).toHaveBeenCalledWith(expect.objectContaining({
        moduleType: 'memberships'
      }));
    });

    it('should create discount with events module type', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'New Event Discount',
        discountType: 'fixed',
        discountValue: 15,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.create as jest.Mock).mockResolvedValue(mockDiscount);

      const response = await request(app)
        .post('/api/orgadmin/discounts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organisationId: 'test-org-123',
          moduleType: 'events',
          name: 'New Event Discount',
          discountType: 'fixed',
          discountValue: 15,
          applicationScope: 'item'
        });

      expect(response.status).toBe(201);
      expect(response.body.moduleType).toBe('events');
      expect(discountService.create).toHaveBeenCalledWith(expect.objectContaining({
        moduleType: 'events'
      }));
    });

    it('should preserve moduleType from request body', async () => {
      const moduleTypes = ['events', 'memberships', 'calendar', 'merchandise', 'registrations'];

      for (const moduleType of moduleTypes) {
        jest.clearAllMocks();

        const mockDiscount = {
          id: `discount-${moduleType}`,
          organisationId: 'test-org-123',
          moduleType,
          name: `${moduleType} Discount`,
          discountType: 'percentage',
          discountValue: 10,
          applicationScope: 'item',
          status: 'active',
          combinable: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        (discountService.create as jest.Mock).mockResolvedValue(mockDiscount);

        const response = await request(app)
          .post('/api/orgadmin/discounts')
          .set('Authorization', 'Bearer valid-token')
          .send({
            organisationId: 'test-org-123',
            moduleType,
            name: `${moduleType} Discount`,
            discountType: 'percentage',
            discountValue: 10,
            applicationScope: 'item'
          });

        expect(response.status).toBe(201);
        expect(response.body.moduleType).toBe(moduleType);
      }
    });
  });

  describe('GET /api/orgadmin/discounts/:id/membership-types - Get Membership Types Using Discount', () => {
    it('should return membership types using the discount', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Membership Discount',
        discountType: 'percentage',
        discountValue: 15,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockMembershipTypeIds = ['mt-1', 'mt-2', 'mt-3'];

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.getMembershipTypesUsingDiscount as jest.Mock).mockResolvedValue(mockMembershipTypeIds);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/membership-types?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.membershipTypeIds).toEqual(mockMembershipTypeIds);
      expect(response.body.count).toBe(3);
      expect(discountService.getMembershipTypesUsingDiscount).toHaveBeenCalledWith('discount-1', 'test-org-123');
    });

    it('should return empty array when no membership types use the discount', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Unused Discount',
        discountType: 'percentage',
        discountValue: 10,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.getMembershipTypesUsingDiscount as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/membership-types?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.membershipTypeIds).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orgadmin/discounts/nonexistent/membership-types?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });

    it('should return 400 when organisation ID is missing', async () => {
      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/membership-types')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Organisation ID is required');
    });

    it('should work with events module type discount', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'events',
        name: 'Event Discount',
        discountType: 'percentage',
        discountValue: 20,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.getMembershipTypesUsingDiscount as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/membership-types?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.membershipTypeIds).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should return 500 when service fails', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Membership Discount',
        discountType: 'percentage',
        discountValue: 15,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.getMembershipTypesUsingDiscount as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/orgadmin/discounts/discount-1/membership-types?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch membership types');
    });
  });

  describe('DELETE /api/orgadmin/discounts/:id/force - Force Delete with Membership Types', () => {
    it('should force delete discount and remove from membership types', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Membership Discount',
        discountType: 'percentage',
        discountValue: 15,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.forceDelete as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1/force?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(discountService.forceDelete).toHaveBeenCalledWith('discount-1', 'test-org-123');
    });

    it('should return 404 when discount not found', async () => {
      (discountService.getById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/nonexistent/force?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Discount not found');
    });

    it('should return 400 when organisation ID is missing', async () => {
      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1/force')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Organisation ID is required');
    });
  });

  describe('DELETE /api/orgadmin/discounts/:id - Delete with Membership Type Check', () => {
    it('should return 409 when discount is used by membership types', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Membership Discount',
        discountType: 'percentage',
        discountValue: 15,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.delete as jest.Mock).mockRejectedValue({
        statusCode: 409,
        message: 'Discount is in use',
        affectedCount: 3,
        discountId: 'discount-1'
      });

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Discount is in use');
      expect(response.body.message).toContain('3 membership type(s)');
      expect(response.body.affectedCount).toBe(3);
      expect(response.body.discountId).toBe('discount-1');
    });

    it('should successfully delete discount when not used by membership types', async () => {
      const mockDiscount = {
        id: 'discount-1',
        organisationId: 'test-org-123',
        moduleType: 'memberships',
        name: 'Unused Discount',
        discountType: 'percentage',
        discountValue: 10,
        applicationScope: 'item',
        status: 'active',
        combinable: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (discountService.getById as jest.Mock).mockResolvedValue(mockDiscount);
      (discountService.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/orgadmin/discounts/discount-1?organisationId=test-org-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(discountService.delete).toHaveBeenCalledWith('discount-1', 'test-org-123');
    });
  });
});
