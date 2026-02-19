import { PaymentMethodService } from '../payment-method.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';
import cacheService from '../cache.service';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../cache.service');

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockCache = cacheService as jest.Mocked<typeof cacheService>;

  beforeEach(() => {
    service = new PaymentMethodService();
    jest.clearAllMocks();
  });

  describe('getAllPaymentMethods', () => {
    it('should return all active payment methods', async () => {
      const mockPaymentMethods = [
        {
          id: '1',
          name: 'pay-offline',
          display_name: 'Pay Offline',
          description: 'Pay offline',
          requires_activation: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: '2',
          name: 'stripe',
          display_name: 'Stripe',
          description: 'Pay with Stripe',
          requires_activation: true,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockCache.get.mockReturnValue(null);
      mockDb.query.mockResolvedValue({ rows: mockPaymentMethods } as any);

      const result = await service.getAllPaymentMethods();

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM payment_methods WHERE is_active = true ORDER BY display_name',
        []
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('pay-offline');
      expect(result[0].displayName).toBe('Pay Offline');
      expect(result[1].name).toBe('stripe');
    });

    it('should return cached payment methods when available', async () => {
      const cachedMethods = [
        {
          id: '1',
          name: 'pay-offline',
          displayName: 'Pay Offline',
          description: 'Pay offline',
          requiresActivation: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockCache.get.mockReturnValue(cachedMethods);

      const result = await service.getAllPaymentMethods();

      expect(mockDb.query).not.toHaveBeenCalled();
      expect(result).toEqual(cachedMethods);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockCache.get.mockReturnValue(null);
      mockDb.query.mockRejectedValue(error);

      await expect(service.getAllPaymentMethods()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error getting payment methods:', error);
    });
  });

  describe('getPaymentMethodById', () => {
    it('should return payment method when found', async () => {
      const mockPaymentMethod = {
        id: '1',
        name: 'pay-offline',
        display_name: 'Pay Offline',
        description: 'Pay offline',
        requires_activation: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockPaymentMethod] } as any);

      const result = await service.getPaymentMethodById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('pay-offline');
      expect(result?.requiresActivation).toBe(false);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getPaymentMethodById('999');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getPaymentMethodById('1')).rejects.toThrow('Database error');
    });
  });

  describe('getPaymentMethodByName', () => {
    it('should return payment method when found by name', async () => {
      const mockPaymentMethod = {
        id: '1',
        name: 'stripe',
        display_name: 'Stripe',
        description: 'Pay with Stripe',
        requires_activation: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockPaymentMethod] } as any);

      const result = await service.getPaymentMethodByName('stripe');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('stripe');
      expect(result?.requiresActivation).toBe(true);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getPaymentMethodByName('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getPaymentMethodByName('stripe')).rejects.toThrow('Database error');
    });
  });

  describe('createPaymentMethod', () => {
    it('should create a new payment method with valid data', async () => {
      const newPaymentMethod = {
        name: 'paypal',
        displayName: 'PayPal',
        description: 'Pay with PayPal',
        requiresActivation: true
      };

      const mockCreated = {
        id: '1',
        name: 'paypal',
        display_name: 'PayPal',
        description: 'Pay with PayPal',
        requires_activation: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createPaymentMethod(newPaymentMethod);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_methods'),
        [newPaymentMethod.name, newPaymentMethod.displayName, newPaymentMethod.description, newPaymentMethod.requiresActivation]
      );
      expect(result.name).toBe('paypal');
      expect(result.requiresActivation).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Payment method created: paypal');
      expect(mockCache.delete).toHaveBeenCalledWith('payment_methods:all:active');
    });

    it('should fail when creating payment method with duplicate name', async () => {
      const duplicatePaymentMethod = {
        name: 'stripe',
        displayName: 'Stripe Duplicate',
        description: 'Duplicate',
        requiresActivation: true
      };

      const error: any = new Error('Duplicate key');
      error.code = '23505';
      mockDb.query.mockRejectedValue(error);

      await expect(service.createPaymentMethod(duplicatePaymentMethod))
        .rejects.toThrow('Payment method with this name already exists');
      expect(logger.error).toHaveBeenCalledWith('Duplicate payment method name: stripe');
    });

    it('should handle other database errors', async () => {
      const newPaymentMethod = {
        name: 'test',
        displayName: 'Test',
        requiresActivation: false
      };

      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.createPaymentMethod(newPaymentMethod)).rejects.toThrow('Database error');
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method fields correctly', async () => {
      const updates = {
        displayName: 'Updated Name',
        description: 'Updated description',
        requiresActivation: false
      };

      const mockUpdated = {
        id: '1',
        name: 'stripe',
        display_name: 'Updated Name',
        description: 'Updated description',
        requires_activation: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updatePaymentMethod('1', updates);

      expect(result.displayName).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
      expect(result.requiresActivation).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Payment method updated: 1');
      expect(mockCache.delete).toHaveBeenCalledWith('payment_methods:all:active');
    });

    it('should update only provided fields', async () => {
      const updates = {
        displayName: 'New Display Name'
      };

      const mockUpdated = {
        id: '1',
        name: 'stripe',
        display_name: 'New Display Name',
        description: 'Original description',
        requires_activation: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updatePaymentMethod('1', updates);

      expect(result.displayName).toBe('New Display Name');
    });

    it('should throw error when payment method not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updatePaymentMethod('999', { displayName: 'Test' }))
        .rejects.toThrow('Payment method not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.updatePaymentMethod('1', { displayName: 'Test' }))
        .rejects.toThrow('Database error');
    });
  });

  describe('deactivatePaymentMethod', () => {
    it('should set is_active to false', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: '1' }] } as any);

      await service.deactivatePaymentMethod('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
        ['1']
      );
      expect(logger.info).toHaveBeenCalledWith('Payment method deactivated: 1');
      expect(mockCache.delete).toHaveBeenCalledWith('payment_methods:all:active');
    });

    it('should throw error when payment method not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.deactivatePaymentMethod('999'))
        .rejects.toThrow('Payment method not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.deactivatePaymentMethod('1')).rejects.toThrow('Database error');
    });
  });

  describe('validatePaymentMethods', () => {
    it('should return true when all payment methods are valid and active', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '3' }] } as any);

      const result = await service.validatePaymentMethods(['pay-offline', 'stripe', 'helix-pay']);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM payment_methods WHERE name = ANY($1) AND is_active = true',
        [['pay-offline', 'stripe', 'helix-pay']]
      );
    });

    it('should return false when some payment methods are invalid', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '2' }] } as any);

      const result = await service.validatePaymentMethods(['pay-offline', 'stripe', 'invalid']);

      expect(result).toBe(false);
    });

    it('should return false when no payment methods are valid', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] } as any);

      const result = await service.validatePaymentMethods(['invalid1', 'invalid2']);

      expect(result).toBe(false);
    });

    it('should return true for empty array', async () => {
      const result = await service.validatePaymentMethods([]);

      expect(result).toBe(true);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.validatePaymentMethods(['stripe'])).rejects.toThrow('Database error');
    });
  });
});
