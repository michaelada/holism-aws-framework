import { OrgPaymentMethodDataService } from '../org-payment-method-data.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';
import { paymentMethodService } from '../payment-method.service';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../payment-method.service');

describe('OrgPaymentMethodDataService', () => {
  let service: OrgPaymentMethodDataService;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockPaymentMethodService = paymentMethodService as jest.Mocked<typeof paymentMethodService>;

  beforeEach(() => {
    service = new OrgPaymentMethodDataService();
    jest.clearAllMocks();
  });

  describe('getOrgPaymentMethods', () => {
    it('should return all payment methods for an organization', async () => {
      const mockRows = [
        {
          id: 'assoc-1',
          organization_id: 'org-1',
          payment_method_id: 'pm-1',
          status: 'active',
          payment_data: {},
          created_at: new Date(),
          updated_at: new Date(),
          name: 'pay-offline',
          display_name: 'Pay Offline',
          description: 'Pay offline',
          requires_activation: false,
          is_active: true,
          pm_created_at: new Date(),
          pm_updated_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRows } as any);

      const result = await service.getOrgPaymentMethods('org-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT opmd.*, pm.name'),
        ['org-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].organizationId).toBe('org-1');
      expect(result[0].paymentMethod?.name).toBe('pay-offline');
    });

    it('should return empty array when organization has no payment methods', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getOrgPaymentMethods('org-1');

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getOrgPaymentMethods('org-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error getting organization payment methods:', error);
    });
  });

  describe('getOrgPaymentMethod', () => {
    it('should return specific payment method association when found', async () => {
      const mockRow = {
        id: 'assoc-1',
        organization_id: 'org-1',
        payment_method_id: 'pm-1',
        status: 'active',
        payment_data: { key: 'value' },
        created_at: new Date(),
        updated_at: new Date(),
        name: 'pay-offline',
        display_name: 'Pay Offline',
        description: 'Pay offline',
        requires_activation: false,
        is_active: true,
        pm_created_at: new Date(),
        pm_updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] } as any);

      const result = await service.getOrgPaymentMethod('org-1', 'pm-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE opmd.organization_id = $1 AND opmd.payment_method_id = $2'),
        ['org-1', 'pm-1']
      );
      expect(result).not.toBeNull();
      expect(result?.organizationId).toBe('org-1');
      expect(result?.paymentMethodId).toBe('pm-1');
      expect(result?.paymentData).toEqual({ key: 'value' });
    });

    it('should return null when association not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getOrgPaymentMethod('org-1', 'pm-1');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.getOrgPaymentMethod('org-1', 'pm-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error getting organization payment method:', error);
    });
  });

  describe('createOrgPaymentMethod', () => {
    it('should create association with valid data', async () => {
      const mockPaymentMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCreatedRow = {
        id: 'assoc-1',
        organization_id: 'org-1',
        payment_method_id: 'pm-1',
        status: 'active',
        payment_data: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPaymentMethodService.getPaymentMethodById.mockResolvedValue(mockPaymentMethod);
      mockDb.query.mockResolvedValue({ rows: [mockCreatedRow] } as any);

      const result = await service.createOrgPaymentMethod({
        organizationId: 'org-1',
        paymentMethodId: 'pm-1'
      });

      expect(mockPaymentMethodService.getPaymentMethodById).toHaveBeenCalledWith('pm-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_payment_method_data'),
        ['org-1', 'pm-1', 'active', '{}']
      );
      expect(result.organizationId).toBe('org-1');
      expect(result.status).toBe('active');
    });

    it('should set status to inactive for methods requiring activation', async () => {
      const mockPaymentMethod = {
        id: 'pm-2',
        name: 'stripe',
        displayName: 'Stripe',
        requiresActivation: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCreatedRow = {
        id: 'assoc-2',
        organization_id: 'org-1',
        payment_method_id: 'pm-2',
        status: 'inactive',
        payment_data: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPaymentMethodService.getPaymentMethodById.mockResolvedValue(mockPaymentMethod);
      mockDb.query.mockResolvedValue({ rows: [mockCreatedRow] } as any);

      const result = await service.createOrgPaymentMethod({
        organizationId: 'org-1',
        paymentMethodId: 'pm-2'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_payment_method_data'),
        ['org-1', 'pm-2', 'inactive', '{}']
      );
      expect(result.status).toBe('inactive');
    });

    it('should fail with duplicate association', async () => {
      const mockPaymentMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentMethodService.getPaymentMethodById.mockResolvedValue(mockPaymentMethod);
      
      const duplicateError: any = new Error('Duplicate');
      duplicateError.code = '23505';
      mockDb.query.mockRejectedValue(duplicateError);

      await expect(service.createOrgPaymentMethod({
        organizationId: 'org-1',
        paymentMethodId: 'pm-1'
      })).rejects.toThrow('Payment method already associated with organization');
    });

    it('should fail with invalid organization ID (foreign key)', async () => {
      const mockPaymentMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentMethodService.getPaymentMethodById.mockResolvedValue(mockPaymentMethod);
      
      const fkError: any = new Error('Foreign key violation');
      fkError.code = '23503';
      fkError.constraint = 'org_payment_method_data_organization_id_fkey';
      mockDb.query.mockRejectedValue(fkError);

      await expect(service.createOrgPaymentMethod({
        organizationId: 'invalid-org',
        paymentMethodId: 'pm-1'
      })).rejects.toThrow('Organization not found');
    });

    it('should fail with invalid payment method ID (foreign key)', async () => {
      mockPaymentMethodService.getPaymentMethodById.mockResolvedValue(null);

      await expect(service.createOrgPaymentMethod({
        organizationId: 'org-1',
        paymentMethodId: 'invalid-pm'
      })).rejects.toThrow('Payment method not found');
    });
  });

  describe('updateOrgPaymentMethod', () => {
    it('should update association fields correctly', async () => {
      const mockUpdatedRow = {
        id: 'assoc-1',
        organization_id: 'org-1',
        payment_method_id: 'pm-1',
        status: 'active',
        payment_data: { apiKey: 'new-key' },
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdatedRow] } as any);

      const result = await service.updateOrgPaymentMethod('org-1', 'pm-1', {
        status: 'active',
        paymentData: { apiKey: 'new-key' }
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE org_payment_method_data'),
        expect.arrayContaining(['active', '{"apiKey":"new-key"}', 'org-1', 'pm-1'])
      );
      expect(result.status).toBe('active');
      expect(result.paymentData).toEqual({ apiKey: 'new-key' });
    });

    it('should throw error when association not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateOrgPaymentMethod('org-1', 'pm-1', {
        status: 'active'
      })).rejects.toThrow('Organization payment method association not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.updateOrgPaymentMethod('org-1', 'pm-1', {
        status: 'active'
      })).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error updating organization payment method:', error);
    });
  });

  describe('deleteOrgPaymentMethod', () => {
    it('should remove association', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'assoc-1' }] } as any);

      await service.deleteOrgPaymentMethod('org-1', 'pm-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM org_payment_method_data WHERE organization_id = $1 AND payment_method_id = $2 RETURNING id',
        ['org-1', 'pm-1']
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Payment method pm-1 removed from organization org-1')
      );
    });

    it('should throw error when association not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.deleteOrgPaymentMethod('org-1', 'pm-1'))
        .rejects.toThrow('Organization payment method association not found');
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.deleteOrgPaymentMethod('org-1', 'pm-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error deleting organization payment method:', error);
    });
  });

  describe('syncOrgPaymentMethods', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      (mockDb.getClient as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
    });

    it('should add new payment methods and create associations', async () => {
      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock payment methods query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'pm-1', name: 'pay-offline', requires_activation: false },
          { id: 'pm-2', name: 'stripe', requires_activation: true }
        ]
      });
      
      // Mock existing associations query (empty)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock INSERT for pay-offline
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock INSERT for stripe
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.syncOrgPaymentMethods('org-1', ['pay-offline', 'stripe']);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_payment_method_data'),
        ['org-1', 'pm-1', 'active', '{}']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_payment_method_data'),
        ['org-1', 'pm-2', 'inactive', '{}']
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should remove payment methods that are no longer selected', async () => {
      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock payment methods query (only pay-offline selected)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'pm-1', name: 'pay-offline', requires_activation: false }
        ]
      });
      
      // Mock existing associations query (has both pay-offline and stripe)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { payment_method_id: 'pm-1' },
          { payment_method_id: 'pm-2' }
        ]
      });
      
      // Mock DELETE for stripe
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.syncOrgPaymentMethods('org-1', ['pay-offline']);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM org_payment_method_data WHERE organization_id = $1 AND payment_method_id = ANY($2)',
        ['org-1', ['pm-2']]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should preserve existing associations that remain selected', async () => {
      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock payment methods query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'pm-1', name: 'pay-offline', requires_activation: false }
        ]
      });
      
      // Mock existing associations query (already has pay-offline)
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { payment_method_id: 'pm-1' }
        ]
      });
      
      // Mock COMMIT (no INSERT or DELETE should happen)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await service.syncOrgPaymentMethods('org-1', ['pay-offline']);

      // Should only have BEGIN, SELECT queries, and COMMIT - no INSERT or DELETE
      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN, SELECT methods, SELECT existing, COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock payment methods query
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 'pm-1', name: 'pay-offline', requires_activation: false }
        ]
      });
      
      // Mock error on existing associations query
      const error = new Error('Database error');
      mockClient.query.mockRejectedValueOnce(error);
      
      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.syncOrgPaymentMethods('org-1', ['pay-offline']))
        .rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Error syncing organization payment methods:', error);
    });
  });

  describe('initializeDefaultPaymentMethods', () => {
    it('should create pay-offline association with correct status and data', async () => {
      const mockPayOfflineMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentMethodService.getPaymentMethodByName.mockResolvedValue(mockPayOfflineMethod);
      mockDb.query.mockResolvedValue({ rows: [{ id: 'assoc-1' }] } as any);

      await service.initializeDefaultPaymentMethods('org-1');

      expect(mockPaymentMethodService.getPaymentMethodByName).toHaveBeenCalledWith('pay-offline');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO org_payment_method_data'),
        ['org-1', 'pm-1', 'active', '{}']
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized default payment method (pay-offline) for organization org-1')
      );
    });

    it('should handle missing pay-offline gracefully', async () => {
      mockPaymentMethodService.getPaymentMethodByName.mockResolvedValue(null);

      await service.initializeDefaultPaymentMethods('org-1');

      expect(mockPaymentMethodService.getPaymentMethodByName).toHaveBeenCalledWith('pay-offline');
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'pay-offline payment method not found, skipping default initialization'
      );
    });

    it('should handle duplicate association gracefully', async () => {
      const mockPayOfflineMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentMethodService.getPaymentMethodByName.mockResolvedValue(mockPayOfflineMethod);
      
      const duplicateError: any = new Error('Duplicate');
      duplicateError.code = '23505';
      mockDb.query.mockRejectedValue(duplicateError);

      // Should not throw, just log debug
      await service.initializeDefaultPaymentMethods('org-1');

      expect(logger.debug).toHaveBeenCalledWith(
        'pay-offline already associated with organization org-1'
      );
    });

    it('should throw error for non-duplicate database errors', async () => {
      const mockPayOfflineMethod = {
        id: 'pm-1',
        name: 'pay-offline',
        displayName: 'Pay Offline',
        requiresActivation: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentMethodService.getPaymentMethodByName.mockResolvedValue(mockPayOfflineMethod);
      
      const error = new Error('Database error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.initializeDefaultPaymentMethods('org-1')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Error initializing default payment methods:', error);
    });
  });
});
