import { MembershipService } from '../membership.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('MembershipService', () => {
  let service: MembershipService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new MembershipService();
    jest.clearAllMocks();
  });

  describe('getMembershipTypesByOrganisation', () => {
    it('should return all membership types for an organisation', async () => {
      const mockMembershipTypes = [
        {
          id: '1',
          organisation_id: 'org-1',
          name: 'Adult Membership',
          description: 'Full adult membership',
          membership_form_id: 'form-1',
          membership_status: 'open',
          is_rolling_membership: false,
          valid_until: new Date('2024-12-31'),
          number_of_months: null,
          automatically_approve: true,
          member_labels: ['adult', 'full'],
          supported_payment_methods: ['card', 'offline'],
          use_terms_and_conditions: true,
          terms_and_conditions: 'You must agree to the terms',
          membership_type_category: 'single',
          max_people_in_application: null,
          min_people_in_application: null,
          person_titles: null,
          person_labels: null,
          field_configuration: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockMembershipTypes } as any);

      const result = await service.getMembershipTypesByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Adult Membership');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getMembershipTypeById', () => {
    it('should return membership type by ID', async () => {
      const mockMembershipType = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Adult Membership',
        description: 'Full adult membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        member_labels: ['adult', 'full'],
        supported_payment_methods: ['card', 'offline'],
        use_terms_and_conditions: true,
        terms_and_conditions: 'You must agree to the terms',
        membership_type_category: 'single',
        max_people_in_application: null,
        min_people_in_application: null,
        person_titles: null,
        person_labels: null,
        field_configuration: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockMembershipType] } as any);

      const result = await service.getMembershipTypeById('1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Adult Membership');
    });

    it('should return null when membership type not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getMembershipTypeById('999');

      expect(result).toBeNull();
    });
  });

  describe('createMembershipType', () => {
    it('should create single membership type with fixed period', async () => {
      const newMembershipType = {
        organisationId: 'org-1',
        name: 'Adult Membership',
        description: 'Full adult membership',
        membershipFormId: 'form-1',
        membershipStatus: 'open' as const,
        isRollingMembership: false,
        validUntil: new Date('2024-12-31'),
        automaticallyApprove: true,
        memberLabels: ['adult', 'full'],
        supportedPaymentMethods: ['card', 'offline'],
        useTermsAndConditions: true,
        termsAndConditions: 'You must agree to the terms',
        membershipTypeCategory: 'single' as const,
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Adult Membership',
        description: 'Full adult membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        member_labels: ['adult', 'full'],
        supported_payment_methods: ['card', 'offline'],
        use_terms_and_conditions: true,
        terms_and_conditions: 'You must agree to the terms',
        membership_type_category: 'single',
        max_people_in_application: null,
        min_people_in_application: null,
        person_titles: null,
        person_labels: null,
        field_configuration: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createMembershipType(newMembershipType);

      expect(result.name).toBe('Adult Membership');
      expect(result.isRollingMembership).toBe(false);
      expect(result.validUntil).toBeDefined();
    });

    it('should create rolling membership type', async () => {
      const newMembershipType = {
        organisationId: 'org-1',
        name: 'Rolling Membership',
        description: 'Rolling membership',
        membershipFormId: 'form-1',
        isRollingMembership: true,
        numberOfMonths: 12,
        supportedPaymentMethods: ['card'],
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Rolling Membership',
        description: 'Rolling membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: true,
        valid_until: null,
        number_of_months: 12,
        automatically_approve: false,
        member_labels: [],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        membership_type_category: 'single',
        max_people_in_application: null,
        min_people_in_application: null,
        person_titles: null,
        person_labels: null,
        field_configuration: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createMembershipType(newMembershipType);

      expect(result.isRollingMembership).toBe(true);
      expect(result.numberOfMonths).toBe(12);
    });

    it('should create group membership type', async () => {
      const newMembershipType = {
        organisationId: 'org-1',
        name: 'Family Membership',
        description: 'Family membership',
        membershipFormId: 'form-1',
        isRollingMembership: false,
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
        membershipTypeCategory: 'group' as const,
        maxPeopleInApplication: 5,
        minPeopleInApplication: 2,
        personTitles: ['Parent 1', 'Parent 2', 'Child 1', 'Child 2', 'Child 3'],
        personLabels: [['adult'], ['adult'], ['child'], ['child'], ['child']],
        fieldConfiguration: {
          'first_name': 'unique' as const,
          'last_name': 'unique' as const,
          'address': 'common' as const,
        },
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Family Membership',
        description: 'Family membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: false,
        member_labels: [],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        membership_type_category: 'group',
        max_people_in_application: 5,
        min_people_in_application: 2,
        person_titles: ['Parent 1', 'Parent 2', 'Child 1', 'Child 2', 'Child 3'],
        person_labels: [['adult'], ['adult'], ['child'], ['child'], ['child']],
        field_configuration: {
          'first_name': 'unique',
          'last_name': 'unique',
          'address': 'common',
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createMembershipType(newMembershipType);

      expect(result.membershipTypeCategory).toBe('group');
      expect(result.maxPeopleInApplication).toBe(5);
      expect(result.minPeopleInApplication).toBe(2);
    });

    it('should throw error when rolling membership without number of months', async () => {
      const invalidMembershipType = {
        organisationId: 'org-1',
        name: 'Test Membership',
        description: 'Test',
        membershipFormId: 'form-1',
        isRollingMembership: true,
        supportedPaymentMethods: ['card'],
      };

      await expect(service.createMembershipType(invalidMembershipType)).rejects.toThrow(
        'Number of months is required for rolling memberships'
      );
    });

    it('should throw error when fixed period membership without valid until date', async () => {
      const invalidMembershipType = {
        organisationId: 'org-1',
        name: 'Test Membership',
        description: 'Test',
        membershipFormId: 'form-1',
        isRollingMembership: false,
        supportedPaymentMethods: ['card'],
      };

      await expect(service.createMembershipType(invalidMembershipType)).rejects.toThrow(
        'Valid until date is required for fixed-period memberships'
      );
    });

    it('should throw error when group membership without max people', async () => {
      const invalidMembershipType = {
        organisationId: 'org-1',
        name: 'Test Membership',
        description: 'Test',
        membershipFormId: 'form-1',
        isRollingMembership: false,
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
        membershipTypeCategory: 'group' as const,
        minPeopleInApplication: 2,
      };

      await expect(service.createMembershipType(invalidMembershipType)).rejects.toThrow(
        'Max people in application must be at least 1 for group memberships'
      );
    });

    it('should throw error when min people greater than max people', async () => {
      const invalidMembershipType = {
        organisationId: 'org-1',
        name: 'Test Membership',
        description: 'Test',
        membershipFormId: 'form-1',
        isRollingMembership: false,
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
        membershipTypeCategory: 'group' as const,
        maxPeopleInApplication: 2,
        minPeopleInApplication: 5,
      };

      await expect(service.createMembershipType(invalidMembershipType)).rejects.toThrow(
        'Min people cannot be greater than max people'
      );
    });

    it('should throw error when terms enabled but no terms text', async () => {
      const invalidMembershipType = {
        organisationId: 'org-1',
        name: 'Test Membership',
        description: 'Test',
        membershipFormId: 'form-1',
        isRollingMembership: false,
        validUntil: new Date('2024-12-31'),
        supportedPaymentMethods: ['card'],
        useTermsAndConditions: true,
      };

      await expect(service.createMembershipType(invalidMembershipType)).rejects.toThrow(
        'Terms and conditions text is required when use terms and conditions is enabled'
      );
    });
  });

  describe('updateMembershipType', () => {
    it('should update membership type fields', async () => {
      const mockExisting = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Adult Membership',
        description: 'Full adult membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        member_labels: ['adult'],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        membership_type_category: 'single',
        max_people_in_application: null,
        min_people_in_application: null,
        person_titles: null,
        person_labels: null,
        field_configuration: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdated = {
        ...mockExisting,
        name: 'Updated Membership',
        membership_status: 'closed',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockExisting] } as any) // getMembershipTypeById
        .mockResolvedValueOnce({ rows: [mockUpdated] } as any); // update

      const result = await service.updateMembershipType('1', {
        name: 'Updated Membership',
        membershipStatus: 'closed',
      });

      expect(result.name).toBe('Updated Membership');
      expect(result.membershipStatus).toBe('closed');
    });

    it('should throw error when membership type not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateMembershipType('999', { name: 'Test' })).rejects.toThrow(
        'Membership type not found'
      );
    });

    it('should validate rolling membership configuration on update', async () => {
      const mockExisting = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Adult Membership',
        description: 'Full adult membership',
        membership_form_id: 'form-1',
        membership_status: 'open',
        is_rolling_membership: false,
        valid_until: new Date('2024-12-31'),
        number_of_months: null,
        automatically_approve: true,
        member_labels: [],
        supported_payment_methods: ['card'],
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        membership_type_category: 'single',
        max_people_in_application: null,
        min_people_in_application: null,
        person_titles: null,
        person_labels: null,
        field_configuration: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockExisting] } as any);

      await expect(
        service.updateMembershipType('1', {
          isRollingMembership: true,
          // Missing numberOfMonths
        })
      ).rejects.toThrow('Number of months is required for rolling memberships');
    });
  });

  describe('deleteMembershipType', () => {
    it('should delete membership type', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteMembershipType('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM membership_types WHERE id = $1',
        ['1']
      );
    });

    it('should throw error when membership type not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteMembershipType('999')).rejects.toThrow(
        'Membership type not found'
      );
    });
  });

  describe('getMembersByOrganisation', () => {
    it('should return all members for an organisation', async () => {
      const mockMembers = [
        {
          id: '1',
          organisation_id: 'org-1',
          membership_type_id: 'type-1',
          user_id: 'user-1',
          membership_number: 'MEM-2024-001',
          first_name: 'John',
          last_name: 'Doe',
          form_submission_id: 'submission-1',
          date_last_renewed: new Date('2024-01-01'),
          status: 'active',
          valid_until: new Date('2024-12-31'),
          labels: ['adult', 'full'],
          processed: true,
          payment_status: 'paid',
          payment_method: 'card',
          group_membership_id: null,
          person_slot: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockMembers } as any);

      const result = await service.getMembersByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('John');
      expect(result[0].membershipNumber).toBe('MEM-2024-001');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getMemberById', () => {
    it('should return member by ID', async () => {
      const mockMember = {
        id: '1',
        organisation_id: 'org-1',
        membership_type_id: 'type-1',
        user_id: 'user-1',
        membership_number: 'MEM-2024-001',
        first_name: 'John',
        last_name: 'Doe',
        form_submission_id: 'submission-1',
        date_last_renewed: new Date('2024-01-01'),
        status: 'active',
        valid_until: new Date('2024-12-31'),
        labels: ['adult', 'full'],
        processed: true,
        payment_status: 'paid',
        payment_method: 'card',
        group_membership_id: null,
        person_slot: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockMember] } as any);

      const result = await service.getMemberById('1');

      expect(result).not.toBeNull();
      expect(result?.firstName).toBe('John');
    });

    it('should return null when member not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getMemberById('999');

      expect(result).toBeNull();
    });
  });
});
