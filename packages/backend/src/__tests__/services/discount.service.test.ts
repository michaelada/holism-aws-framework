/**
 * Unit Tests for Discount Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate specific examples and edge cases for discount operations.
 */

import { DiscountService } from '../../services/discount.service';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
    getClient: jest.fn(),
  },
}));

describe('Discount Service - Unit Tests', () => {
  const service = new DiscountService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Discount Application', () => {
    /**
     * Test applying discount to event
     * Requirements: 16.6, 16.7, 16.8
     */
    it('should apply discount to event', async () => {
      // Arrange
      const discountId = 'discount-123';
      const targetType = 'event';
      const targetId = 'event-456';
      const appliedBy = 'user-789';

      mockDb.query
        .mockResolvedValueOnce({
          // Check discount status
          rows: [{ status: 'active' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // Insert application
          rows: [],
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      await service.applyToTarget(discountId, targetType, targetId, appliedBy);

      // Assert
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT status FROM discounts'),
        [discountId]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO discount_applications'),
        [discountId, targetType, targetId, appliedBy]
      );
    });

    /**
     * Test applying discount to activity
     * Requirements: 16.6
     */
    it('should apply discount to event activity', async () => {
      // Arrange
      const discountId = 'discount-123';
      const targetType = 'event_activity';
      const targetId = 'activity-456';

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

      // Act
      await service.applyToTarget(discountId, targetType, targetId);

      // Assert
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO discount_applications'),
        [discountId, targetType, targetId, null]
      );
    });

    /**
     * Test removing discount from target
     * Requirements: 16.7
     */
    it('should remove discount from target', async () => {
      // Arrange
      const discountId = 'discount-123';
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'DELETE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.removeFromTarget(discountId, targetType, targetId);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM discount_applications'),
        [discountId, targetType, targetId]
      );
    });

    /**
     * Test removing non-existent discount application
     * Requirements: 16.7
     */
    it('should return false when removing non-existent application', async () => {
      // Arrange
      const discountId = 'discount-123';
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.removeFromTarget(discountId, targetType, targetId);

      // Assert
      expect(result).toBe(false);
    });

    /**
     * Test retrieving discounts for target
     * Requirements: 16.8
     */
    it('should retrieve all discounts for a target', async () => {
      // Arrange
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'discount-1',
            organisationId: 'org-123',
            moduleType: 'events',
            name: 'Early Bird',
            discountType: 'percentage',
            discountValue: 20,
            applicationScope: 'item',
            combinable: true,
            priority: 10,
            status: 'active',
            usageLimits: { currentUsageCount: 0 },
            eligibilityCriteria: { requiresCode: false },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'discount-2',
            organisationId: 'org-123',
            moduleType: 'events',
            name: 'Member Discount',
            discountType: 'fixed',
            discountValue: 10,
            applicationScope: 'item',
            combinable: true,
            priority: 5,
            status: 'active',
            usageLimits: { currentUsageCount: 0 },
            eligibilityCriteria: { requiresCode: false },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.getForTarget(targetType, targetId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Early Bird');
      expect(result[1].name).toBe('Member Discount');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM discounts d'),
        [targetType, targetId]
      );
    });

    /**
     * Test retrieving discounts returns empty array when none applied
     * Requirements: 16.8
     */
    it('should return empty array when no discounts applied to target', async () => {
      // Arrange
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.getForTarget(targetType, targetId);

      // Assert
      expect(result).toHaveLength(0);
    });

    /**
     * Test that discounts are returned sorted by priority
     * Requirements: 16.8
     */
    it('should return discounts sorted by priority descending', async () => {
      // Arrange
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'discount-1',
            organisationId: 'org-123',
            moduleType: 'events',
            name: 'High Priority',
            discountType: 'percentage',
            discountValue: 20,
            applicationScope: 'item',
            combinable: true,
            priority: 100,
            status: 'active',
            usageLimits: { currentUsageCount: 0 },
            eligibilityCriteria: { requiresCode: false },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'discount-2',
            organisationId: 'org-123',
            moduleType: 'events',
            name: 'Low Priority',
            discountType: 'fixed',
            discountValue: 10,
            applicationScope: 'item',
            combinable: true,
            priority: 1,
            status: 'active',
            usageLimits: { currentUsageCount: 0 },
            eligibilityCriteria: { requiresCode: false },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.getForTarget(targetType, targetId);

      // Assert
      expect(result[0].priority).toBe(100);
      expect(result[1].priority).toBe(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY d.priority DESC'),
        [targetType, targetId]
      );
    });

    /**
     * Test applying discount to non-existent discount
     * Requirements: 16.6
     */
    it('should throw error when applying non-existent discount', async () => {
      // Arrange
      const discountId = 'non-existent';
      const targetType = 'event';
      const targetId = 'event-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act & Assert
      await expect(
        service.applyToTarget(discountId, targetType, targetId)
      ).rejects.toThrow('Discount not found');
    });
  });

  describe('Usage Statistics', () => {
    /**
     * Test total discount amount calculation
     * Requirements: 14.7
     */
    it('should calculate total discount amount given', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          // Usage stats query
          rows: [{
            totalUses: '5',
            totalDiscountGiven: '150.50',
            averageDiscountAmount: '30.10',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // Top users query
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // Discount query for remaining uses
          rows: [{
            usage_limits: { totalUsageLimit: 10, currentUsageCount: 5 },
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.totalUses).toBe(5);
      expect(stats.totalDiscountGiven).toBe(150.50);
    });

    /**
     * Test average discount amount calculation
     * Requirements: 14.8
     */
    it('should calculate average discount amount per use', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            totalUses: '10',
            totalDiscountGiven: '250.00',
            averageDiscountAmount: '25.00',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{
            usage_limits: null,
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.averageDiscountAmount).toBe(25.00);
    });

    /**
     * Test top users identification
     * Requirements: 14.9
     */
    it('should identify top users of discount', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            totalUses: '15',
            totalDiscountGiven: '300.00',
            averageDiscountAmount: '20.00',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              userId: 'user-1',
              usageCount: '5',
              totalDiscountReceived: '100.00',
            },
            {
              userId: 'user-2',
              usageCount: '4',
              totalDiscountReceived: '80.00',
            },
            {
              userId: 'user-3',
              usageCount: '3',
              totalDiscountReceived: '60.00',
            },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{
            usage_limits: null,
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.topUsers).toHaveLength(3);
      expect(stats.topUsers[0].userId).toBe('user-1');
      expect(stats.topUsers[0].usageCount).toBe(5);
      expect(stats.topUsers[0].totalDiscountReceived).toBe(100.00);
      expect(stats.topUsers[1].usageCount).toBe(4);
      expect(stats.topUsers[2].usageCount).toBe(3);
    });

    /**
     * Test remaining uses calculation
     * Requirements: 14.7
     */
    it('should calculate remaining uses when limit is set', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            totalUses: '7',
            totalDiscountGiven: '140.00',
            averageDiscountAmount: '20.00',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{
            usage_limits: { totalUsageLimit: 10, currentUsageCount: 7 },
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.remainingUses).toBe(3);
    });

    /**
     * Test remaining uses is undefined when no limit
     * Requirements: 14.7
     */
    it('should return undefined remaining uses when no limit set', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            totalUses: '100',
            totalDiscountGiven: '2000.00',
            averageDiscountAmount: '20.00',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{
            usage_limits: { currentUsageCount: 100 },
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.remainingUses).toBeUndefined();
    });

    /**
     * Test remaining uses is 0 when limit reached
     * Requirements: 14.7
     */
    it('should return 0 remaining uses when limit is reached', async () => {
      // Arrange
      const discountId = 'discount-123';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            totalUses: '10',
            totalDiscountGiven: '200.00',
            averageDiscountAmount: '20.00',
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{
            usage_limits: { totalUsageLimit: 10, currentUsageCount: 10 },
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const stats = await service.getUsageStats(discountId);

      // Assert
      expect(stats.remainingUses).toBe(0);
    });

    /**
     * Test user usage count
     * Requirements: 14.4
     */
    it('should get user usage count for a discount', async () => {
      // Arrange
      const discountId = 'discount-123';
      const userId = 'user-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const count = await service.getUserUsageCount(discountId, userId);

      // Assert
      expect(count).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        [discountId, userId]
      );
    });

    /**
     * Test user usage count returns 0 when user hasn't used discount
     * Requirements: 14.4
     */
    it('should return 0 when user has not used discount', async () => {
      // Arrange
      const discountId = 'discount-123';
      const userId = 'user-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const count = await service.getUserUsageCount(discountId, userId);

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('Discount Deletion with Membership Type Associations', () => {
    /**
     * Test normal deletion with no associations
     * Requirements: 10.1
     */
    it('should delete discount when not associated with any membership types', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      mockDb.query
        .mockResolvedValueOnce({
          // events check
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // activities check
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // membership types check
          rows: [],
          command: 'SELECT',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          // delete query
          rows: [],
          command: 'DELETE',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      // Act
      const result = await service.delete(discountId, organisationId);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(4);
      expect(mockDb.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('membership_types'),
        [organisationId, JSON.stringify([discountId])]
      );
    });

    /**
     * Test deletion prevention when in use
     * Requirements: 10.2, 10.3
     */
    it('should prevent deletion when discount is associated with membership types', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 'mt-1' },
            { id: 'mt-2' },
            { id: 'mt-3' },
          ],
          command: 'SELECT',
          rowCount: 3,
          oid: 0,
          fields: [],
        });

      // Act & Assert
      try {
        await service.delete(discountId, organisationId);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('Discount is in use');
        expect(error.affectedCount).toBe(3);
        expect(error.discountId).toBe(discountId);
      }
    });

    /**
     * Test force delete with multiple associations
     * Requirements: 10.5, 10.6
     */
    it('should force delete discount and remove from all membership types', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
          .mockResolvedValueOnce({ rows: [], command: 'UPDATE', rowCount: 3 })
          .mockResolvedValueOnce({ rows: [], command: 'DELETE', rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], command: 'COMMIT' }),
        release: jest.fn(),
      };

      mockDb.getClient.mockResolvedValueOnce(mockClient as any);

      // Act
      await service.forceDelete(discountId, organisationId);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE membership_types'),
        [JSON.stringify(discountId), organisationId, JSON.stringify([discountId])]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM discounts'),
        [discountId, organisationId]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    /**
     * Test force delete rollback on error
     * Requirements: 10.5, 10.6
     */
    it('should rollback force delete on error', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
          .mockResolvedValueOnce({ rows: [], command: 'UPDATE' })
          .mockRejectedValueOnce(new Error('Database error')),
        release: jest.fn(),
      };

      mockDb.getClient.mockResolvedValueOnce(mockClient as any);

      // Act & Assert
      await expect(service.forceDelete(discountId, organisationId)).rejects.toThrow('Database error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    /**
     * Test getting membership types using discount
     * Requirements: 10.4
     */
    it('should retrieve all membership types using a discount', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: 'mt-1' },
          { id: 'mt-2' },
          { id: 'mt-3' },
        ],
        command: 'SELECT',
        rowCount: 3,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.getMembershipTypesUsingDiscount(discountId, organisationId);

      // Assert
      expect(result).toEqual(['mt-1', 'mt-2', 'mt-3']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM membership_types'),
        [organisationId, JSON.stringify([discountId])]
      );
    });

    /**
     * Test getting membership types returns empty array when none found
     * Requirements: 10.4
     */
    it('should return empty array when no membership types use discount', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';

      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await service.getMembershipTypesUsingDiscount(discountId, organisationId);

      // Assert
      expect(result).toEqual([]);
    });

    /**
     * Test error message formatting
     * Requirements: 10.3
     */
    it('should include count in error message when deletion is prevented', async () => {
      // Arrange
      const discountId = 'discount-123';
      const organisationId = 'org-456';
      const membershipTypeCount = 5;

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: Array.from({ length: membershipTypeCount }, (_, i) => ({ id: `mt-${i}` })),
          command: 'SELECT',
          rowCount: membershipTypeCount,
          oid: 0,
          fields: [],
        });

      // Act & Assert
      try {
        await service.delete(discountId, organisationId);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.message).toBe('Discount is in use');
        expect(error.statusCode).toBe(409);
        expect(error.affectedCount).toBe(membershipTypeCount);
        expect(error.discountId).toBe(discountId);
      }
    });
  });
});

