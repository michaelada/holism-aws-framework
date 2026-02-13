import { RegistrationService } from '../registration.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('RegistrationService', () => {
  let service: RegistrationService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new RegistrationService();
    jest.clearAllMocks();
  });

  describe('getRegistrationTypesByOrganisation', () => {
    it('should return all registration types for an organisation', async () => {
      const mockRegistrationTypes = [
        {
          id: '1',
          organisation_id: 'org-1',
          name: '2024 Horse Registration',
          description: 'Annual horse registration',
          entity_name: 'Horse',
          registration_form_id: 'form-1',
          registration_status: 'open',
          is_rolling_registration: false,
          valid_until: new Date('2024-12-31'),
          number_of_months: null,
          automatically_approve: true,
          registration_labels: ['horse', '2024'],
          supported_payment_methods: ['card', 'offline'],
          use_terms_and_conditions: true,
          terms_and_conditions: 'You must agree to the terms',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRegistrationTypes } as any);

      const result = await service.getRegistrationTypesByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('2024 Horse Registration');
      expect(result[0].entityName).toBe('Horse');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getRegistrationTypeById', () => {
    it('should return registration type by ID', async () => {
      const mockRegistrationType = {
        id: '1',
        organisation_id: 'org-1',
        name: '2024 Horse Registration',
        description: 'Annual horse registration',
        entity_name: 'Horse',
        registration_form_id: 'form-1',
        registration_status: 'open',
        is_rolling_registration: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        registration_labels: ['horse', '2024'],
        supported_payment_methods: ['card', 'offline'],
        use_terms_and_conditions: true,
        terms_and_conditions: 'You must agree to the terms',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRegistrationType] } as any);

      const result = await service.getRegistrationTypeById('1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('2024 Horse Registration');
      expect(result?.entityName).toBe('Horse');
    });

    it('should return null when registration type not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getRegistrationTypeById('999');

      expect(result).toBeNull();
    });
  });

  describe('createRegistrationType', () => {
    it('should create registration type with fixed period', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: '2024 Horse Registration',
        description: 'Annual horse registration',
        entityName: 'Horse',
        registrationFormId: 'form-1',
        registrationStatus: 'open' as const,
        isRollingRegistration: false,
        validUntil: new Date('2024-12-31'),
        automaticallyApprove: true,
        registrationLabels: ['horse', '2024'],
        supportedPaymentMethods: ['card', 'offline'],
        useTermsAndConditions: true,
        termsAndConditions: 'You must agree to the terms',
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: '2024 Horse Registration',
        description: 'Annual horse registration',
        entity_name: 'Horse',
        registration_form_id: 'form-1',
        registration_status: 'open',
        is_rolling_registration: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        registration_labels: ['horse', '2024'],
        supported_payment_methods: ['card', 'offline'],
        use_terms_and_conditions: true,
        terms_and_conditions: 'You must agree to the terms',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createRegistrationType(newRegistrationType);

      expect(result.name).toBe('2024 Horse Registration');
      expect(result.entityName).toBe('Horse');
      expect(result.isRollingRegistration).toBe(false);
      expect(result.validUntil).toBeDefined();
    });

    it('should create rolling registration type', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: 'Rolling Boat Registration',
        description: 'Rolling boat registration',
        entityName: 'Boat',
        registrationFormId: 'form-1',
        isRollingRegistration: true,
        numberOfMonths: 12,
        supportedPaymentMethods: ['card'],
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Rolling Boat Registration',
        description: 'Rolling boat registration',
        entity_name: 'Boat',
        registration_form_id: 'form-1',
        registration_status: 'open',
        is_rolling_registration: true,
        valid_until: null,
        number_of_months: 12,
        automatically_approve: false,
        registration_labels: [],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createRegistrationType(newRegistrationType);

      expect(result.isRollingRegistration).toBe(true);
      expect(result.numberOfMonths).toBe(12);
      expect(result.entityName).toBe('Boat');
    });

    it('should throw error when entity name is missing', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: 'Test Registration',
        description: 'Test',
        entityName: '',
        registrationFormId: 'form-1',
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
      };

      await expect(service.createRegistrationType(newRegistrationType)).rejects.toThrow(
        'Entity name is required'
      );
    });

    it('should throw error when rolling registration missing numberOfMonths', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: 'Test Registration',
        description: 'Test',
        entityName: 'Equipment',
        registrationFormId: 'form-1',
        isRollingRegistration: true,
        supportedPaymentMethods: ['card'],
      };

      await expect(service.createRegistrationType(newRegistrationType)).rejects.toThrow(
        'Number of months is required for rolling registrations'
      );
    });

    it('should throw error when fixed-period registration missing validUntil', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: 'Test Registration',
        description: 'Test',
        entityName: 'Equipment',
        registrationFormId: 'form-1',
        isRollingRegistration: false,
        supportedPaymentMethods: ['card'],
      };

      await expect(service.createRegistrationType(newRegistrationType)).rejects.toThrow(
        'Valid until date is required for fixed-period registrations'
      );
    });

    it('should throw error when terms enabled but text missing', async () => {
      const newRegistrationType = {
        organisationId: 'org-1',
        name: 'Test Registration',
        description: 'Test',
        entityName: 'Equipment',
        registrationFormId: 'form-1',
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
        useTermsAndConditions: true,
      };

      await expect(service.createRegistrationType(newRegistrationType)).rejects.toThrow(
        'Terms and conditions text is required when use terms and conditions is enabled'
      );
    });
  });

  describe('updateRegistrationType', () => {
    it('should update registration type', async () => {
      const existingType = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Old Name',
        description: 'Old description',
        entity_name: 'Horse',
        registration_form_id: 'form-1',
        registration_status: 'open',
        is_rolling_registration: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: false,
        registration_labels: [],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedType = {
        ...existingType,
        name: 'New Name',
        description: 'New description',
        updated_at: new Date(),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingType] } as any) // getById
        .mockResolvedValueOnce({ rows: [updatedType] } as any); // update

      const result = await service.updateRegistrationType('1', {
        name: 'New Name',
        description: 'New description',
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New description');
    });

    it('should throw error when registration type not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.updateRegistrationType('999', { name: 'New Name' })
      ).rejects.toThrow('Registration type not found');
    });
  });

  describe('deleteRegistrationType', () => {
    it('should delete registration type', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteRegistrationType('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM registration_types WHERE id = $1',
        ['1']
      );
    });

    it('should throw error when registration type not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteRegistrationType('999')).rejects.toThrow(
        'Registration type not found'
      );
    });
  });

  describe('getRegistrationsByOrganisation', () => {
    it('should return registrations with filtering', async () => {
      const mockRegistrations = [
        {
          id: '1',
          organisation_id: 'org-1',
          registration_type_id: 'type-1',
          user_id: 'user-1',
          registration_number: 'REG-2024-001',
          entity_name: 'Thunder',
          owner_name: 'John Doe',
          form_submission_id: 'sub-1',
          date_last_renewed: new Date('2024-01-01'),
          status: 'active',
          valid_until: new Date('2024-12-31'),
          labels: ['horse', 'premium'],
          processed: false,
          payment_status: 'paid',
          payment_method: 'card',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockRegistrations } as any);

      const result = await service.getRegistrationsByOrganisation({
        organisationId: 'org-1',
        status: ['active'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].entityName).toBe('Thunder');
      expect(result[0].status).toBe('active');
    });

    it('should filter by search term', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getRegistrationsByOrganisation({
        organisationId: 'org-1',
        searchTerm: 'Thunder',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_name ILIKE'),
        expect.arrayContaining(['org-1', '%Thunder%'])
      );
    });

    it('should filter by processed status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getRegistrationsByOrganisation({
        organisationId: 'org-1',
        processed: true,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('processed = $'),
        expect.arrayContaining(['org-1', true])
      );
    });
  });

  describe('getRegistrationById', () => {
    it('should return registration by ID', async () => {
      const mockRegistration = {
        id: '1',
        organisation_id: 'org-1',
        registration_type_id: 'type-1',
        user_id: 'user-1',
        registration_number: 'REG-2024-001',
        entity_name: 'Thunder',
        owner_name: 'John Doe',
        form_submission_id: 'sub-1',
        date_last_renewed: new Date('2024-01-01'),
        status: 'active',
        valid_until: new Date('2024-12-31'),
        labels: ['horse', 'premium'],
        processed: false,
        payment_status: 'paid',
        payment_method: 'card',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRegistration] } as any);

      const result = await service.getRegistrationById('1');

      expect(result).not.toBeNull();
      expect(result?.entityName).toBe('Thunder');
    });

    it('should return null when registration not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getRegistrationById('999');

      expect(result).toBeNull();
    });
  });

  describe('updateRegistrationStatus', () => {
    it('should update registration status to active', async () => {
      const mockUpdated = {
        id: '1',
        organisation_id: 'org-1',
        registration_type_id: 'type-1',
        user_id: 'user-1',
        registration_number: 'REG-2024-001',
        entity_name: 'Thunder',
        owner_name: 'John Doe',
        form_submission_id: 'sub-1',
        date_last_renewed: new Date('2024-01-01'),
        status: 'active',
        valid_until: new Date('2024-12-31'),
        labels: [],
        processed: false,
        payment_status: 'paid',
        payment_method: 'card',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updateRegistrationStatus('1', 'active');

      expect(result.status).toBe('active');
    });

    it('should update registration status to elapsed', async () => {
      const mockUpdated = {
        id: '1',
        organisation_id: 'org-1',
        registration_type_id: 'type-1',
        user_id: 'user-1',
        registration_number: 'REG-2024-001',
        entity_name: 'Thunder',
        owner_name: 'John Doe',
        form_submission_id: 'sub-1',
        date_last_renewed: new Date('2024-01-01'),
        status: 'elapsed',
        valid_until: new Date('2024-12-31'),
        labels: [],
        processed: false,
        payment_status: 'paid',
        payment_method: 'card',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await service.updateRegistrationStatus('1', 'elapsed');

      expect(result.status).toBe('elapsed');
    });

    it('should throw error when registration not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateRegistrationStatus('999', 'active')).rejects.toThrow(
        'Registration not found'
      );
    });
  });

  describe('batch operations', () => {
    describe('addLabelsToRegistrations', () => {
      it('should add labels to multiple registrations', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 3 } as any);

        const count = await service.addLabelsToRegistrations(
          ['reg-1', 'reg-2', 'reg-3'],
          ['premium', 'verified']
        );

        expect(count).toBe(3);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE registrations'),
          expect.arrayContaining([['reg-1', 'reg-2', 'reg-3'], ['premium', 'verified']])
        );
      });

      it('should return 0 when no registrations provided', async () => {
        const count = await service.addLabelsToRegistrations([], ['premium']);

        expect(count).toBe(0);
        expect(mockDb.query).not.toHaveBeenCalled();
      });
    });

    describe('removeLabelsFromRegistrations', () => {
      it('should remove labels from multiple registrations', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 2 } as any);

        const count = await service.removeLabelsFromRegistrations(
          ['reg-1', 'reg-2'],
          ['old-label']
        );

        expect(count).toBe(2);
      });
    });

    describe('markRegistrationsProcessed', () => {
      it('should mark registrations as processed', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 5 } as any);

        const count = await service.markRegistrationsProcessed([
          'reg-1',
          'reg-2',
          'reg-3',
          'reg-4',
          'reg-5',
        ]);

        expect(count).toBe(5);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('processed = true'),
          expect.any(Array)
        );
      });
    });

    describe('markRegistrationsUnprocessed', () => {
      it('should mark registrations as unprocessed', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 3 } as any);

        const count = await service.markRegistrationsUnprocessed(['reg-1', 'reg-2', 'reg-3']);

        expect(count).toBe(3);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('processed = false'),
          expect.any(Array)
        );
      });
    });
  });

  describe('custom filters', () => {
    describe('getCustomFilters', () => {
      it('should return custom filters for a user', async () => {
        const mockFilters = [
          {
            id: 'filter-1',
            organisation_id: 'org-1',
            user_id: 'user-1',
            name: 'Active Horses',
            registration_status: ['active'],
            date_last_renewed_before: null,
            date_last_renewed_after: null,
            valid_until_before: null,
            valid_until_after: null,
            registration_labels: ['horse'],
            registration_types: [],
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];

        mockDb.query.mockResolvedValue({ rows: mockFilters } as any);

        const result = await service.getCustomFilters('org-1', 'user-1');

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Active Horses');
      });
    });

    describe('saveCustomFilter', () => {
      it('should create a custom filter', async () => {
        const newFilter = {
          organisationId: 'org-1',
          userId: 'user-1',
          name: 'Expired Registrations',
          registrationStatus: ['elapsed' as const],
          registrationLabels: ['horse'],
        };

        const mockCreated = {
          id: 'filter-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          name: 'Expired Registrations',
          registration_status: ['elapsed'],
          date_last_renewed_before: null,
          date_last_renewed_after: null,
          valid_until_before: null,
          valid_until_after: null,
          registration_labels: ['horse'],
          registration_types: [],
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

        const result = await service.saveCustomFilter(newFilter);

        expect(result.name).toBe('Expired Registrations');
      });
    });
  });

  describe('automaticStatusUpdate', () => {
    it('should update expired active registrations to elapsed', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 10 } as any);

      const count = await service.automaticStatusUpdate();

      expect(count).toBe(10);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'elapsed'")
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'active'")
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('valid_until < CURRENT_DATE')
      );
    });

    it('should return 0 when no registrations need updating', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      const count = await service.automaticStatusUpdate();

      expect(count).toBe(0);
    });
  });

  describe('exportRegistrationsToExcel', () => {
    it('should export registrations to Excel', async () => {
      const mockRegistrations = [
        {
          id: '1',
          organisation_id: 'org-1',
          registration_type_id: 'type-1',
          user_id: 'user-1',
          registration_number: 'REG-2024-001',
          entity_name: 'Thunder',
          owner_name: 'John Doe',
          form_submission_id: 'sub-1',
          date_last_renewed: new Date('2024-01-01'),
          status: 'active',
          valid_until: new Date('2024-12-31'),
          labels: ['horse', 'premium'],
          processed: false,
          payment_status: 'paid',
          payment_method: 'card',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockTypes = [
        {
          id: 'type-1',
          organisation_id: 'org-1',
          name: 'Horse Registration',
          description: 'Annual horse registration',
          entity_name: 'Horse',
          registration_form_id: 'form-1',
          registration_status: 'open',
          is_rolling_registration: false,
          valid_until: new Date('2024-12-31'),
          number_of_months: null,
          automatically_approve: true,
          registration_labels: [],
          supported_payment_methods: ['card'],
          use_terms_and_conditions: false,
          terms_and_conditions: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockRegistrations } as any) // getRegistrations
        .mockResolvedValueOnce({ rows: mockTypes } as any); // getTypes

      const buffer = await service.exportRegistrationsToExcel({
        organisationId: 'org-1',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
