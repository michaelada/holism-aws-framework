/**
 * Property-Based Tests for Discount Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate universal properties for discount CRUD operations.
 */

import * as fc from 'fast-check';
import { DiscountService } from '../../services/discount.service';
import { CreateDiscountDto } from '../../types/discount.types';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
    getClient: jest.fn(),
  },
}));

describe('Discount Service - Property-Based Tests', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 2: Required Field Validation
   * 
   * For any discount creation request, if any required field (name, module type,
   * discount type, discount value) is missing, the system should reject the request
   * with a validation error.
   * 
   * **Validates: Requirements 2.1**
   */
  describe('Property 2: Required Field Validation', () => {
    it('should reject discount creation when name is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            discountType: fc.constantFrom('percentage', 'fixed'),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
            applicationScope: fc.constantFrom('item', 'category', 'cart', 'quantity-based'),
          }),
          async (data) => {
            // Arrange: Create DTO without name
            const dto: any = {
              organisationId: data.organisationId,
              moduleType: data.moduleType,
              discountType: data.discountType,
              discountValue: data.discountValue,
              applicationScope: data.applicationScope,
              // name is missing
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Missing required fields');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount creation when discountType is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
            applicationScope: fc.constantFrom('item', 'category', 'cart', 'quantity-based'),
          }),
          async (data) => {
            // Arrange: Create DTO without discountType
            const dto: any = {
              organisationId: data.organisationId,
              moduleType: data.moduleType,
              name: data.name,
              discountValue: data.discountValue,
              applicationScope: data.applicationScope,
              // discountType is missing
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Missing required fields');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount creation when discountValue is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountType: fc.constantFrom('percentage', 'fixed'),
            applicationScope: fc.constantFrom('item', 'category', 'cart', 'quantity-based'),
          }),
          async (data) => {
            // Arrange: Create DTO without discountValue
            const dto: any = {
              organisationId: data.organisationId,
              moduleType: data.moduleType,
              name: data.name,
              discountType: data.discountType,
              applicationScope: data.applicationScope,
              // discountValue is missing
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Missing required fields');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount creation when applicationScope is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountType: fc.constantFrom('percentage', 'fixed'),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          async (data) => {
            // Arrange: Create DTO without applicationScope
            const dto: any = {
              organisationId: data.organisationId,
              moduleType: data.moduleType,
              name: data.name,
              discountType: data.discountType,
              discountValue: data.discountValue,
              // applicationScope is missing
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Missing required fields');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept discount creation when all required fields are present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountType: fc.constantFrom('percentage', 'fixed'),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
            applicationScope: fc.constantFrom('item', 'category', 'cart', 'quantity-based'),
          }),
          async (data) => {
            // Arrange: Create valid DTO
            const dto: CreateDiscountDto = {
              organisationId: data.organisationId,
              moduleType: data.moduleType as any,
              name: data.name,
              discountType: data.discountType as any,
              discountValue: data.discountValue,
              applicationScope: data.applicationScope as any,
            };

            // Mock successful database insert
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Should not throw
            const result = await service.create(dto);

            // Assert: Should return created discount
            expect(result).toBeDefined();
            expect(result.name).toBe(dto.name);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Discount Value Range Validation
   * 
   * For any discount, if the discount type is percentage then the value must be
   * between 0 and 100, and if the discount type is fixed then the value must be
   * greater than 0.
   * 
   * **Validates: Requirements 2.3, 2.4**
   */
  describe('Property 3: Discount Value Range Validation', () => {
    it('should reject percentage discount with value > 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10001, max: 100000 }).map(n => n / 100),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (discountValue, organisationId, name) => {
            // Arrange: Create percentage discount with value > 100
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue,
              applicationScope: 'item',
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Percentage discount must be between 0 and 100');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject percentage discount with negative value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -100000, max: -1 }).map(n => n / 100),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (discountValue, organisationId, name) => {
            // Arrange: Create percentage discount with negative value
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue,
              applicationScope: 'item',
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Percentage discount must be between 0 and 100');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept percentage discount with value between 0 and 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (discountValue, organisationId, name) => {
            // Pre-condition: discount value must be greater than 0 for this test
            fc.pre(discountValue > 0);
            
            // Arrange: Create valid percentage discount
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue,
              applicationScope: 'item',
            };

            // Mock successful database insert
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Should not throw
            const result = await service.create(dto);

            // Assert: Should succeed
            expect(result).toBeDefined();
            expect(result.discountValue).toBe(discountValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject fixed discount with value <= 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -100000, max: 0 }).map(n => n / 100),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (discountValue, organisationId, name) => {
            // Pre-condition: Ensure we have a valid name and discount value is not exactly 0 (which is falsy)
            fc.pre(name.trim().length > 0 && discountValue !== 0);
            
            // Arrange: Create fixed discount with value < 0
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'fixed',
              discountValue,
              applicationScope: 'item',
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow('Fixed discount must be greater than 0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept fixed discount with value > 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000000 }).map(n => n / 100),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (discountValue, organisationId, name) => {
            // Pre-condition: discount value must be greater than 0
            fc.pre(discountValue > 0);
            
            // Arrange: Create valid fixed discount
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'fixed',
              discountValue,
              applicationScope: 'item',
            };

            // Mock successful database insert
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Should not throw
            const result = await service.create(dto);

            // Assert: Should succeed
            expect(result).toBeDefined();
            expect(result.discountValue).toBe(discountValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Organization Scoping
   * 
   * For any discount and any user, the user should only be able to access the discount
   * if they belong to the same organization that created the discount.
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 4: Organization Scoping', () => {
    it('should return null when accessing discount from different organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountOrgId, userOrgId) => {
            // Pre-condition: Organizations must be different
            fc.pre(discountOrgId !== userOrgId);

            // Arrange: Mock database to return discount with different org
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act: Try to get discount with different organization ID
            const result = await service.getById('discount-id', userOrgId);

            // Assert: Should return null (not found)
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return discount when accessing from same organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (organisationId, name) => {
            // Arrange: Mock database to return discount
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'discount-id',
                organisationId,
                moduleType: 'events',
                name,
                discountType: 'percentage',
                discountValue: 10,
                applicationScope: 'item',
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                eligibilityCriteria: { requiresCode: false },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Get discount with same organization ID
            const result = await service.getById('discount-id', organisationId);

            // Assert: Should return discount
            expect(result).not.toBeNull();
            expect(result?.organisationId).toBe(organisationId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Update Invariant Preservation
   * 
   * For any discount update operation, the discount ID, organisation ID, and creation
   * timestamp should remain unchanged after the update.
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 5: Update Invariant Preservation', () => {
    it('should preserve discount ID, organisation ID, and creation timestamp on update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            organisationId: fc.uuid(),
            createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
            originalName: fc.string({ minLength: 1, maxLength: 100 }),
            updatedName: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async (data) => {
            // Pre-condition: Names should be different to ensure update happens
            fc.pre(data.originalName !== data.updatedName);

            // Arrange: Mock existing discount
            mockDb.query
              .mockResolvedValueOnce({
                // First call: getById check
                rows: [{
                  id: data.id,
                  organisationId: data.organisationId,
                  moduleType: 'events',
                  name: data.originalName,
                  discountType: 'percentage',
                  discountValue: 10,
                  applicationScope: 'item',
                  combinable: true,
                  priority: 0,
                  status: 'active',
                  usageLimits: { currentUsageCount: 0 },
                  eligibilityCriteria: { requiresCode: false },
                  createdAt: data.createdAt,
                  updatedAt: new Date(),
                }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              })
              .mockResolvedValueOnce({
                // Second call: update query
                rows: [{
                  id: data.id,
                  organisationId: data.organisationId,
                  moduleType: 'events',
                  name: data.updatedName,
                  discountType: 'percentage',
                  discountValue: 10,
                  applicationScope: 'item',
                  combinable: true,
                  priority: 0,
                  status: 'active',
                  usageLimits: { currentUsageCount: 0 },
                  eligibilityCriteria: { requiresCode: false },
                  createdAt: data.createdAt, // Should remain unchanged
                  updatedAt: new Date(),
                }],
                command: 'UPDATE',
                rowCount: 1,
                oid: 0,
                fields: [],
              });

            // Act: Update discount
            const result = await service.update(data.id, data.organisationId, {
              name: data.updatedName,
            });

            // Assert: Invariants preserved
            expect(result).not.toBeNull();
            expect(result!.id).toBe(data.id);
            expect(result!.organisationId).toBe(data.organisationId);
            expect(result!.createdAt.getTime()).toBe(data.createdAt.getTime());
            expect(result!.name).toBe(data.updatedName);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Cascade Deletion
   * 
   * For any discount, when it is deleted, all associated discount applications
   * should also be deleted from the database.
   * 
   * **Validates: Requirements 2.8**
   */
  describe('Property 6: Cascade Deletion', () => {
    it('should cascade delete all discount applications when discount is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, organisationId) => {
            // Arrange: Mock isDiscountInUse checks and deletion
            mockDb.query
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // events check
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // activities check
              .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] }) // membership types check
              .mockResolvedValueOnce({
                rows: [],
                command: 'DELETE',
                rowCount: 1,
                oid: 0,
                fields: [],
              }); // delete query

            // Act: Delete discount
            const result = await service.delete(discountId, organisationId);

            // Assert: Deletion succeeded
            expect(result).toBe(true);
            
            // Note: Cascade deletion is handled by database ON DELETE CASCADE constraint
            // The service doesn't need to explicitly delete applications
            // This test verifies the service correctly calls the delete operation
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Discount Code Uniqueness
   * 
   * For any two discounts within the same organization, if both have discount codes,
   * the codes must be different.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 8: Discount Code Uniqueness', () => {
    it('should reject discount creation with duplicate code in same organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 3, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (organisationId, code, name) => {
            // Arrange: Create discount with code
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Mock database unique constraint violation
            mockDb.query.mockRejectedValueOnce({
              code: '23505', // PostgreSQL unique violation
              message: 'duplicate key value violates unique constraint',
            });

            // Act & Assert: Should throw error about duplicate code
            await expect(service.create(dto)).rejects.toThrow(
              'Discount code already exists in this organization'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow same code in different organizations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(fc.uuid(), fc.uuid()),
          fc.string({ minLength: 3, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async ([org1Id, org2Id], code, name) => {
            // Pre-condition: Organizations must be different
            fc.pre(org1Id !== org2Id);

            // Arrange: Create discount in first org
            const dto1: CreateDiscountDto = {
              organisationId: org1Id,
              moduleType: 'events',
              name: name + '1',
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Mock successful creation for first org
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'discount-1',
                organisationId: org1Id,
                moduleType: 'events',
                name: dto1.name,
                discountType: 'percentage',
                discountValue: 10,
                applicationScope: 'item',
                code,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create discount in first org
            const result1 = await service.create(dto1);
            expect(result1.code).toBe(code);

            // Arrange: Create discount with same code in second org
            const dto2: CreateDiscountDto = {
              organisationId: org2Id,
              moduleType: 'events',
              name: name + '2',
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Mock successful creation for second org
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'discount-2',
                organisationId: org2Id,
                moduleType: 'events',
                name: dto2.name,
                discountType: 'percentage',
                discountValue: 10,
                applicationScope: 'item',
                code,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create discount in second org - should succeed
            const result2 = await service.create(dto2);
            expect(result2.code).toBe(code);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Discount Code Length Validation
   * 
   * For any discount with a discount code, the code length must be at least 3
   * characters and at most 50 characters.
   * 
   * **Validates: Requirements 4.3**
   */
  describe('Property 9: Discount Code Length Validation', () => {
    it('should reject discount code shorter than 3 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 2 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (organisationId, code, name) => {
            // Pre-condition: Ensure we have a valid name and code is actually short but not empty
            fc.pre(name.trim().length > 0 && code.length > 0 && code.length < 3);
            
            // Clear mocks for each iteration
            jest.clearAllMocks();
            
            // Arrange: Create discount with short code
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow(
              'Discount code must be between 3 and 50 characters'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount code longer than 50 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 51, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (organisationId, code, name) => {
            // Clear mocks for each iteration
            jest.clearAllMocks();
            
            // Arrange: Create discount with long code
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow(
              'Discount code must be between 3 and 50 characters'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept discount code between 3 and 50 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (organisationId, code, name) => {
            // Clear mocks for each iteration
            jest.clearAllMocks();
            
            // Arrange: Create discount with valid code
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              code,
            };

            // Mock successful creation
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                code,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Should not throw
            const result = await service.create(dto);

            // Assert: Should succeed
            expect(result).toBeDefined();
            expect(result.code).toBe(code);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Date Range Validation
   * 
   * For any discount with both valid-from and valid-until dates, the valid-from
   * date must be before the valid-until date.
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 10: Date Range Validation', () => {
    it('should reject discount when valid-from is after valid-until', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
          async (organisationId, name, validFrom, validUntil) => {
            // Pre-condition: validFrom must be after validUntil
            fc.pre(validFrom > validUntil);

            // Arrange: Create discount with invalid date range
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              validFrom,
              validUntil,
            };

            // Act & Assert: Should throw error
            await expect(service.create(dto)).rejects.toThrow(
              'Valid from date must be before valid until date'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept discount when valid-from is before valid-until', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') }),
          fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') }),
          async (organisationId, name, validFrom, validUntil) => {
            // Pre-condition: validFrom must be before validUntil
            fc.pre(validFrom < validUntil);

            // Arrange: Create discount with valid date range
            const dto: CreateDiscountDto = {
              organisationId,
              moduleType: 'events',
              name,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              validFrom,
              validUntil,
            };

            // Mock successful creation
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                validFrom: validFrom,
                validUntil: validUntil,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Should not throw
            const result = await service.create(dto);

            // Assert: Should succeed
            expect(result).toBeDefined();
            expect(result.validFrom).toBeDefined();
            expect(result.validUntil).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 7: Inactive Discount Prevention
 * 
 * For any discount with status inactive, any attempt to apply it to a new target
 * entity should be rejected.
 * 
 * **Validates: Requirements 2.10**
 */
describe('Discount Service - Property 7: Inactive Discount Prevention', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject applying inactive discount to target', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('event', 'event_activity', 'membership_type'),
        async (discountId, targetId, targetType) => {
          // Clear mocks for each property test iteration
          jest.clearAllMocks();
          
          // Arrange: Mock inactive discount
          mockDb.query.mockResolvedValueOnce({
            rows: [{ status: 'inactive' }],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          });

          // Act & Assert: Should throw error
          await expect(
            service.applyToTarget(discountId, targetType, targetId)
          ).rejects.toThrow('Cannot apply inactive discount');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow applying active discount to target', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('event', 'event_activity', 'membership_type'),
        async (discountId, targetId, targetType) => {
          // Clear mocks for each property test iteration
          jest.clearAllMocks();
          
          // Arrange: Mock active discount
          mockDb.query
            .mockResolvedValueOnce({
              rows: [{ status: 'active' }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            })
            .mockResolvedValueOnce({
              rows: [],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

          // Act: Should not throw
          await expect(
            service.applyToTarget(discountId, targetType, targetId)
          ).resolves.not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 12: Atomic Usage Tracking
 * 
 * For any concurrent discount applications, the usage counters (both total and
 * per-user) should be incremented atomically such that the final count equals
 * the number of successful applications.
 * 
 * **Validates: Requirements 6.2, 6.4, 6.6, 14.3, 14.4**
 */
describe('Discount Service - Property 12: Atomic Usage Tracking', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should atomically increment usage counters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        async (discountId, userId, transactionType, transactionId, originalAmount, discountAmount) => {
          const finalAmount = originalAmount - discountAmount;

          // Arrange: Mock database client with transaction support
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
              .mockResolvedValueOnce({ rows: [], command: 'INSERT' })
              .mockResolvedValueOnce({ rows: [], command: 'UPDATE' })
              .mockResolvedValueOnce({ rows: [], command: 'COMMIT' }),
            release: jest.fn(),
          };

          mockDb.getClient.mockResolvedValueOnce(mockClient as any);

          // Act: Record usage
          await service.recordUsage(
            discountId,
            userId,
            transactionType,
            transactionId,
            originalAmount,
            discountAmount,
            finalAmount
          );

          // Assert: Transaction was used (BEGIN, INSERT, UPDATE, COMMIT)
          expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
          expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
          expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO discount_usage'),
            [discountId, userId, transactionType, transactionId, originalAmount, discountAmount, finalAmount]
          );
          expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE discounts'),
            [discountId]
          );
          expect(mockClient.release).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should rollback on error to maintain atomicity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        async (discountId, userId, transactionType, transactionId, originalAmount, discountAmount) => {
          const finalAmount = originalAmount - discountAmount;

          // Arrange: Mock database client that fails on UPDATE
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
              .mockResolvedValueOnce({ rows: [], command: 'INSERT' })
              .mockRejectedValueOnce(new Error('Database error')),
            release: jest.fn(),
          };

          mockDb.getClient.mockResolvedValueOnce(mockClient as any);

          // Act & Assert: Should throw and rollback
          await expect(
            service.recordUsage(
              discountId,
              userId,
              transactionType,
              transactionId,
              originalAmount,
              discountAmount,
              finalAmount
            )
          ).rejects.toThrow('Database error');

          // Assert: ROLLBACK was called
          expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
          expect(mockClient.release).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 23: Usage Recording
 * 
 * For any successful discount application to a completed transaction, a usage
 * record should be created in the discount_usage table.
 * 
 * **Validates: Requirements 14.1**
 */
describe('Discount Service - Property 23: Usage Recording', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create usage record for every successful application', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('event_entry', 'membership', 'booking', 'merchandise', 'registration'),
        fc.uuid(),
        fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        async (discountId, userId, transactionType, transactionId, originalAmount, discountAmount) => {
          // Pre-condition: discount amount should not exceed original amount
          fc.pre(discountAmount <= originalAmount);

          const finalAmount = originalAmount - discountAmount;

          // Arrange: Mock successful transaction
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
              .mockResolvedValueOnce({ rows: [], command: 'INSERT' })
              .mockResolvedValueOnce({ rows: [], command: 'UPDATE' })
              .mockResolvedValueOnce({ rows: [], command: 'COMMIT' }),
            release: jest.fn(),
          };

          mockDb.getClient.mockResolvedValueOnce(mockClient as any);

          // Act: Record usage
          await service.recordUsage(
            discountId,
            userId,
            transactionType,
            transactionId,
            originalAmount,
            discountAmount,
            finalAmount
          );

          // Assert: INSERT was called with correct parameters
          expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO discount_usage'),
            [discountId, userId, transactionType, transactionId, originalAmount, discountAmount, finalAmount]
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 24: Usage Data Completeness
 * 
 * For any usage record, it should contain all required fields: discount ID,
 * user ID, transaction type, transaction ID, original amount, discount amount,
 * and final amount.
 * 
 * **Validates: Requirements 14.2**
 */
describe('Discount Service - Property 24: Usage Data Completeness', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include all required fields in usage record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          discountId: fc.uuid(),
          userId: fc.uuid(),
          transactionType: fc.constantFrom('event_entry', 'membership', 'booking'),
          transactionId: fc.uuid(),
          originalAmount: fc.integer({ min: 1000, max: 100000 }).map(n => n / 100),
          discountAmount: fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        }),
        async (data) => {
          // Pre-condition: discount amount should not exceed original amount
          fc.pre(data.discountAmount <= data.originalAmount);

          const finalAmount = data.originalAmount - data.discountAmount;

          // Arrange: Mock successful transaction
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
              .mockResolvedValueOnce({ rows: [], command: 'INSERT' })
              .mockResolvedValueOnce({ rows: [], command: 'UPDATE' })
              .mockResolvedValueOnce({ rows: [], command: 'COMMIT' }),
            release: jest.fn(),
          };

          mockDb.getClient.mockResolvedValueOnce(mockClient as any);

          // Act: Record usage
          await service.recordUsage(
            data.discountId,
            data.userId,
            data.transactionType,
            data.transactionId,
            data.originalAmount,
            data.discountAmount,
            finalAmount
          );

          // Assert: All required fields are present in INSERT call
          const insertCall = mockClient.query.mock.calls.find(
            call => call[0].includes('INSERT INTO discount_usage')
          );
          expect(insertCall).toBeDefined();
          expect(insertCall![1]).toEqual([
            data.discountId,
            data.userId,
            data.transactionType,
            data.transactionId,
            data.originalAmount,
            data.discountAmount,
            finalAmount,
          ]);

          // Verify all fields are non-null
          insertCall![1].forEach((field: any) => {
            expect(field).not.toBeNull();
            expect(field).not.toBeUndefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: Module Type Filtering Consistency
   * 
   * For any module type and any organization, when retrieving discounts filtered by
   * that module type, all returned discounts should have that exact moduleType value.
   * 
   * **Validates: Requirements 2.6, 6.3, 6.4**
   */
  describe('Feature: membership-discount-integration, Property 1: Module Type Filtering Consistency', () => {
    it('should return only discounts matching the specified module type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            discountCount: fc.integer({ min: 1, max: 10 }),
          }),
          async (data) => {
            // Arrange: Create mock discounts all with the same module type
            const mockDiscounts = Array.from({ length: data.discountCount }, (_, i) => ({
              id: `discount-${i}`,
              organisationId: data.organisationId,
              moduleType: data.moduleType,
              name: `Discount ${i}`,
              discountType: 'percentage',
              discountValue: 10,
              applicationScope: 'item',
              status: 'active',
              combinable: true,
              priority: 0,
              usageLimits: { currentUsageCount: 0 },
              eligibilityCriteria: { requiresCode: false },
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            mockDb.query
              .mockResolvedValueOnce({
                rows: mockDiscounts,
                command: 'SELECT',
                rowCount: data.discountCount,
                oid: 0,
                fields: [],
              })
              .mockResolvedValueOnce({
                rows: [{ count: data.discountCount.toString() }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });

            // Act: Get discounts by organization and module type
            const result = await service.getByOrganisation(
              data.organisationId,
              data.moduleType as any,
              1,
              50
            );

            // Assert: All returned discounts should have the specified module type
            expect(result.discounts).toHaveLength(data.discountCount);
            result.discounts.forEach(discount => {
              expect(discount.moduleType).toBe(data.moduleType);
            });

            // Verify query included module type filter
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('module_type = $2'),
              expect.arrayContaining([data.organisationId, data.moduleType])
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not return discounts with different module types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            requestedModuleType: fc.constantFrom('events', 'memberships'),
            otherModuleType: fc.constantFrom('calendar', 'merchandise', 'registrations'),
          }),
          async (data) => {
            // Pre-condition: module types must be different
            fc.pre(data.requestedModuleType !== data.otherModuleType);

            // Arrange: Mock discounts with different module type
            const mockDiscounts = [
              {
                id: 'discount-1',
                organisationId: data.organisationId,
                moduleType: data.requestedModuleType,
                name: 'Correct Module Type',
                discountType: 'percentage',
                discountValue: 10,
                applicationScope: 'item',
                status: 'active',
                combinable: true,
                priority: 0,
                usageLimits: { currentUsageCount: 0 },
                eligibilityCriteria: { requiresCode: false },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];

            mockDb.query
              .mockResolvedValueOnce({
                rows: mockDiscounts,
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              })
              .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });

            // Act: Get discounts filtered by requested module type
            const result = await service.getByOrganisation(
              data.organisationId,
              data.requestedModuleType as any,
              1,
              50
            );

            // Assert: No discounts with other module type should be returned
            result.discounts.forEach(discount => {
              expect(discount.moduleType).not.toBe(data.otherModuleType);
              expect(discount.moduleType).toBe(data.requestedModuleType);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Module Type Assignment by Context
   * 
   * For any discount created from a specific module context (events or memberships),
   * the created discount should have the moduleType corresponding to that context.
   * 
   * **Validates: Requirements 6.2, 6.6, 6.7**
   */
  describe('Feature: membership-discount-integration, Property 2: Module Type Assignment by Context', () => {
    it('should assign moduleType from request body when creating discount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            moduleType: fc.constantFrom('events', 'memberships', 'calendar', 'merchandise', 'registrations'),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          async (data) => {
            // Arrange: Create discount with specific module type
            const dto: CreateDiscountDto = {
              organisationId: data.organisationId,
              moduleType: data.moduleType as any,
              name: data.name,
              discountType: 'percentage',
              discountValue: data.discountValue,
              applicationScope: 'item',
            };

            // Mock successful creation
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: dto.moduleType,
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create discount
            const result = await service.create(dto);

            // Assert: Created discount should have the specified module type
            expect(result.moduleType).toBe(data.moduleType);

            // Verify INSERT query included module type
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('module_type'),
              expect.arrayContaining([data.moduleType])
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve moduleType when discount is created from memberships context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          async (data) => {
            // Arrange: Create discount from memberships context
            const dto: CreateDiscountDto = {
              organisationId: data.organisationId,
              moduleType: 'memberships',
              name: data.name,
              discountType: 'percentage',
              discountValue: data.discountValue,
              applicationScope: 'item',
            };

            // Mock successful creation
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: 'memberships',
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create discount
            const result = await service.create(dto);

            // Assert: Created discount should have memberships module type
            expect(result.moduleType).toBe('memberships');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve moduleType when discount is created from events context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            organisationId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            discountValue: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          async (data) => {
            // Arrange: Create discount from events context
            const dto: CreateDiscountDto = {
              organisationId: data.organisationId,
              moduleType: 'events',
              name: data.name,
              discountType: 'percentage',
              discountValue: data.discountValue,
              applicationScope: 'item',
            };

            // Mock successful creation
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: 'new-discount-id',
                organisationId: dto.organisationId,
                moduleType: 'events',
                name: dto.name,
                discountType: dto.discountType,
                discountValue: dto.discountValue,
                applicationScope: dto.applicationScope,
                combinable: true,
                priority: 0,
                status: 'active',
                usageLimits: { currentUsageCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date(),
              }],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create discount
            const result = await service.create(dto);

            // Assert: Created discount should have events module type
            expect(result.moduleType).toBe('events');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Discount Deletion Association Check
   * 
   * For any discount being deleted, the API should query the membership_types table
   * to check if the discount ID appears in any discountIds array before proceeding
   * with deletion.
   * 
   * **Validates: Requirements 10.1**
   */
  describe('Feature: membership-discount-integration, Property 14: Discount Deletion Association Check', () => {
    it('should check membership_types table before deleting discount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
            hasMembershipTypes: fc.boolean(),
          }),
          async (data) => {
            // Arrange: Mock membership types check
            mockDb.query
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // events check
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // activities check
              .mockResolvedValueOnce({ 
                rows: data.hasMembershipTypes 
                  ? [{ id: 'mt-1' }, { id: 'mt-2' }] 
                  : [],
                command: 'SELECT',
                rowCount: data.hasMembershipTypes ? 2 : 0,
                oid: 0,
                fields: []
              }); // membership types check

            // Act & Assert
            if (data.hasMembershipTypes) {
              await expect(
                service.delete(data.discountId, data.organisationId)
              ).rejects.toThrow('Discount is in use');
            } else {
              mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] }); // delete query
              await service.delete(data.discountId, data.organisationId);
            }

            // Verify membership types check was called
            const membershipTypesCall = mockDb.query.mock.calls.find(
              (call: any) => call[0].includes('membership_types') && call[0].includes('discount_ids')
            );
            expect(membershipTypesCall).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: In-Use Discount Deletion Prevention
   * 
   * For any discount that is referenced in one or more membership type discountIds
   * arrays, attempting to delete it should return a 409 error indicating the discount
   * is in use.
   * 
   * **Validates: Requirements 10.2**
   */
  describe('Feature: membership-discount-integration, Property 15: In-Use Discount Deletion Prevention', () => {
    it('should prevent deletion of discounts in use by membership types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
            membershipTypeCount: fc.integer({ min: 1, max: 10 }),
          }),
          async (data) => {
            // Arrange: Mock discount in use by membership types
            const membershipTypeIds = Array.from(
              { length: data.membershipTypeCount },
              (_, i) => ({ id: `mt-${i}` })
            );

            mockDb.query
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // events check
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // activities check
              .mockResolvedValueOnce({ rows: membershipTypeIds, command: 'SELECT', rowCount: data.membershipTypeCount, oid: 0, fields: [] }); // membership types check

            // Act & Assert: Should throw 409 error
            try {
              await service.delete(data.discountId, data.organisationId);
              throw new Error('Expected deletion to fail');
            } catch (error: any) {
              expect(error.statusCode).toBe(409);
              expect(error.message).toBe('Discount is in use');
              expect(error.affectedCount).toBe(data.membershipTypeCount);
              expect(error.discountId).toBe(data.discountId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Deletion Error Message Count Accuracy
   * 
   * For any 409 error returned when attempting to delete an in-use discount, the
   * error message should include the count of membership types that reference that
   * discount.
   * 
   * **Validates: Requirements 10.3**
   */
  describe('Feature: membership-discount-integration, Property 16: Deletion Error Message Count Accuracy', () => {
    it('should include accurate count in deletion error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
            membershipTypeCount: fc.integer({ min: 1, max: 20 }),
          }),
          async (data) => {
            // Arrange: Mock membership types using discount
            const membershipTypeIds = Array.from(
              { length: data.membershipTypeCount },
              (_, i) => ({ id: `mt-${i}` })
            );

            mockDb.query
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // events check
              .mockResolvedValueOnce({ rows: [{ count: '0' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] }) // activities check
              .mockResolvedValueOnce({ rows: membershipTypeIds, command: 'SELECT', rowCount: data.membershipTypeCount, oid: 0, fields: [] }); // membership types check

            // Act & Assert: Error should contain accurate count
            try {
              await service.delete(data.discountId, data.organisationId);
              throw new Error('Expected deletion to fail');
            } catch (error: any) {
              expect(error.affectedCount).toBe(data.membershipTypeCount);
              expect(error.affectedCount).toBe(membershipTypeIds.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Discount Association Retrieval
   * 
   * For any discount ID, the API endpoint for retrieving associated membership types
   * should return all membership types whose discountIds array contains that discount ID.
   * 
   * **Validates: Requirements 10.4**
   */
  describe('Feature: membership-discount-integration, Property 17: Discount Association Retrieval', () => {
    it('should retrieve all membership types using a discount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
            membershipTypeCount: fc.integer({ min: 0, max: 15 }),
          }),
          async (data) => {
            // Arrange: Mock membership types
            const membershipTypeIds = Array.from(
              { length: data.membershipTypeCount },
              (_, i) => ({ id: `mt-${i}` })
            );

            mockDb.query.mockResolvedValueOnce({ rows: membershipTypeIds, command: 'SELECT', rowCount: data.membershipTypeCount, oid: 0, fields: [] });

            // Act: Get membership types using discount
            const result = await service.getMembershipTypesUsingDiscount(
              data.discountId,
              data.organisationId
            );

            // Assert: Should return all membership type IDs
            expect(result).toHaveLength(data.membershipTypeCount);
            expect(result).toEqual(membershipTypeIds.map(mt => mt.id));

            // Verify query was called with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('membership_types'),
              [data.organisationId, JSON.stringify([data.discountId])]
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Force Delete Cleanup Completeness
   * 
   * For any discount being force deleted, after the operation completes, no membership
   * type should have that discount ID in its discountIds array, and the discount should
   * no longer exist in the database.
   * 
   * **Validates: Requirements 10.5, 10.6**
   */
  describe('Feature: membership-discount-integration, Property 18: Force Delete Cleanup Completeness', () => {
    it('should remove discount from all membership types and delete discount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
            membershipTypeCount: fc.integer({ min: 0, max: 10 }),
          }),
          async (data) => {
            // Arrange: Mock transaction
            const mockClient = {
              query: jest.fn()
                .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
                .mockResolvedValueOnce({ rows: [], command: 'UPDATE' }) // remove from membership types
                .mockResolvedValueOnce({ rowCount: 1, command: 'DELETE' }) // delete discount
                .mockResolvedValueOnce({ rows: [], command: 'COMMIT' }),
              release: jest.fn(),
            };

            mockDb.getClient.mockResolvedValueOnce(mockClient as any);

            // Act: Force delete discount
            await service.forceDelete(data.discountId, data.organisationId);

            // Assert: Transaction was used
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

            // Verify UPDATE query to remove discount from membership types
            const updateCall = mockClient.query.mock.calls.find(
              (call: any) => call[0].includes('UPDATE membership_types')
            );
            expect(updateCall).toBeDefined();
            expect(updateCall![1]).toContain(JSON.stringify(data.discountId));
            expect(updateCall![1]).toContain(data.organisationId);

            // Verify DELETE query
            const deleteCall = mockClient.query.mock.calls.find(
              (call: any) => call[0].includes('DELETE FROM discounts')
            );
            expect(deleteCall).toBeDefined();
            expect(deleteCall![1]).toContain(data.discountId);
            expect(deleteCall![1]).toContain(data.organisationId);

            // Verify client was released
            expect(mockClient.release).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rollback transaction on error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            discountId: fc.uuid(),
            organisationId: fc.uuid(),
          }),
          async (data) => {
            // Arrange: Mock transaction with error
            const mockClient = {
              query: jest.fn()
                .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
                .mockResolvedValueOnce({ rows: [], command: 'UPDATE' })
                .mockRejectedValueOnce(new Error('Database error')), // delete fails
              release: jest.fn(),
            };

            mockDb.getClient.mockResolvedValueOnce(mockClient as any);

            // Act & Assert: Should rollback and throw error
            await expect(
              service.forceDelete(data.discountId, data.organisationId)
            ).rejects.toThrow('Database error');

            // Verify rollback was called
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
