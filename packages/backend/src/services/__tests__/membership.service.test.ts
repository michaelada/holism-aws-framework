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

  describe('Discount Handling', () => {
    describe('createMembershipType with discountIds', () => {
      it('should create membership type with valid discountIds', async () => {
        const discountIds = ['discount-1', 'discount-2'];
        
        // Mock discount validation
        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'discount-1', organisation_id: 'org-1', module_type: 'memberships', status: 'active' },
            { id: 'discount-2', organisation_id: 'org-1', module_type: 'memberships', status: 'active' },
          ],
        } as any);

        // Mock insert
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(discountIds),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test Description',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          discountIds,
        });

        expect(result.discountIds).toEqual(discountIds);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = ANY($1)'),
          [discountIds]
        );
      });

      it('should create membership type with empty discountIds array', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify([]),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test Description',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          discountIds: [],
        });

        expect(result.discountIds).toEqual([]);
      });

      it('should throw error when discount validation fails', async () => {
        const discountIds = ['discount-1', 'discount-2'];
        
        // Mock discount validation - only one discount exists
        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'discount-1', organisation_id: 'org-1', module_type: 'memberships', status: 'active' },
          ],
        } as any);

        await expect(service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test Description',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          discountIds,
        })).rejects.toThrow('Discount validation failed');
      });

      it('should throw error when discount belongs to different organization', async () => {
        const discountIds = ['discount-1'];
        
        // Mock discount validation - discount belongs to different org
        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'discount-1', organisation_id: 'org-2', module_type: 'memberships', status: 'active' },
          ],
        } as any);

        await expect(service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test Description',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          discountIds,
        })).rejects.toThrow('Discount validation failed');
      });

      it('should throw error when discount has wrong moduleType', async () => {
        const discountIds = ['discount-1'];
        
        // Mock discount validation - discount has wrong moduleType
        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'discount-1', organisation_id: 'org-1', module_type: 'events', status: 'active' },
          ],
        } as any);

        await expect(service.createMembershipType({
          organisationId: 'org-1',
          name: 'Test Membership',
          description: 'Test Description',
          membershipFormId: 'form-1',
          supportedPaymentMethods: ['card'],
          isRollingMembership: true,
          numberOfMonths: 12,
          discountIds,
        })).rejects.toThrow('Discount validation failed');
      });
    });

    describe('updateMembershipType with discountIds', () => {
      it('should update membership type with new discountIds', async () => {
        const newDiscountIds = ['discount-3', 'discount-4'];
        
        // Mock get existing
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(['discount-1']),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        // Mock discount validation
        mockDb.query.mockResolvedValueOnce({
          rows: [
            { id: 'discount-3', organisation_id: 'org-1', module_type: 'memberships', status: 'active' },
            { id: 'discount-4', organisation_id: 'org-1', module_type: 'memberships', status: 'active' },
          ],
        } as any);

        // Mock update
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(newDiscountIds),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.updateMembershipType('1', {
          discountIds: newDiscountIds,
        });

        expect(result.discountIds).toEqual(newDiscountIds);
      });

      it('should update membership type to remove all discounts', async () => {
        // Mock get existing
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(['discount-1', 'discount-2']),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        // Mock update
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify([]),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.updateMembershipType('1', {
          discountIds: [],
        });

        expect(result.discountIds).toEqual([]);
      });

      it('should throw error when updating with invalid discountIds', async () => {
        const newDiscountIds = ['discount-3'];
        
        // Mock get existing
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(['discount-1']),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        // Mock discount validation - discount doesn't exist
        mockDb.query.mockResolvedValueOnce({
          rows: [],
        } as any);

        await expect(service.updateMembershipType('1', {
          discountIds: newDiscountIds,
        })).rejects.toThrow('Discount validation failed');
      });
    });

    describe('getMembershipTypeById with discountIds', () => {
      it('should deserialize discountIds from JSON string', async () => {
        const discountIds = ['discount-1', 'discount-2'];
        
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: JSON.stringify(discountIds),
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.getMembershipTypeById('1');

        expect(result).not.toBeNull();
        expect(result!.discountIds).toEqual(discountIds);
      });

      it('should handle null discount_ids as empty array', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.getMembershipTypeById('1');

        expect(result).not.toBeNull();
        expect(result!.discountIds).toEqual([]);
      });

      it('should handle already-parsed discount_ids array', async () => {
        const discountIds = ['discount-1', 'discount-2'];
        
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            organisation_id: 'org-1',
            name: 'Test Membership',
            description: 'Test Description',
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
            discount_ids: discountIds, // Already an array
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

        const result = await service.getMembershipTypeById('1');

        expect(result).not.toBeNull();
        expect(result!.discountIds).toEqual(discountIds);
      });
    });
  });

  describe('createMember', () => {
    describe('successful member creation', () => {
      it('should create member with active status when automaticallyApprove is true', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '0' };
        const year = new Date().getFullYear();

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any) // getSubmissionById
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any) // getOrganization
          .mockResolvedValueOnce({ rows: [mockMemberCount] } as any) // getMemberCount
          .mockResolvedValueOnce({ // INSERT member
            rows: [{
              id: 'member-1',
              organisation_id: 'org-1',
              membership_type_id: 'type-1',
              user_id: 'user-1',
              membership_number: `TEST-${year}-00001`,
              first_name: 'John',
              last_name: 'Doe',
              form_submission_id: 'submission-1',
              date_last_renewed: new Date(),
              status: 'active',
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

        const result = await service.createMember(memberData);

        expect(result).toBeDefined();
        expect(result.status).toBe('active');
        expect(result.firstName).toBe('John');
        expect(result.lastName).toBe('Doe');
        expect(result.membershipNumber).toBe(`TEST-${year}-00001`);
      });

      it('should create member with pending status when automaticallyApprove is false', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'Jane',
          lastName: 'Smith',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: false,
          validUntil: new Date('2024-12-31'),
          automaticallyApprove: false,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '5' };
        const year = new Date().getFullYear();

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any) // getSubmissionById
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any) // getOrganization
          .mockResolvedValueOnce({ rows: [mockMemberCount] } as any) // getMemberCount
          .mockResolvedValueOnce({ // INSERT member
            rows: [{
              id: 'member-2',
              organisation_id: 'org-1',
              membership_type_id: 'type-1',
              user_id: 'user-1',
              membership_number: `TEST-${year}-00006`,
              first_name: 'Jane',
              last_name: 'Smith',
              form_submission_id: 'submission-1',
              date_last_renewed: new Date(),
              status: 'pending',
              valid_until: new Date('2024-12-31'),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

        const result = await service.createMember(memberData);

        expect(result).toBeDefined();
        expect(result.status).toBe('pending');
        expect(result.firstName).toBe('Jane');
        expect(result.lastName).toBe('Smith');
      });

      it('should trim whitespace from first and last names', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: '  John  ',
          lastName: '  Doe  ',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '0' };
        const year = new Date().getFullYear();

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any)
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any)
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any)
          .mockResolvedValueOnce({ rows: [mockMemberCount] } as any)
          .mockResolvedValueOnce({
            rows: [{
              id: 'member-1',
              organisation_id: 'org-1',
              membership_type_id: 'type-1',
              user_id: 'user-1',
              membership_number: `TEST-${year}-00001`,
              first_name: 'John',
              last_name: 'Doe',
              form_submission_id: 'submission-1',
              date_last_renewed: new Date(),
              status: 'active',
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

        const result = await service.createMember(memberData);

        expect(result.firstName).toBe('John');
        expect(result.lastName).toBe('Doe');
      });
    });

    describe('error handling for missing membership type', () => {
      it('should throw error when membership type not found', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'non-existent-type',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        mockDb.query.mockResolvedValueOnce({ rows: [] } as any); // getMembershipTypeById returns empty

        await expect(service.createMember(memberData)).rejects.toThrow('Membership type not found');
      });
    });

    describe('error handling for missing form submission', () => {
      it('should throw error when form submission not found', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'non-existent-submission',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [] } as any); // getSubmissionById returns empty

        await expect(service.createMember(memberData)).rejects.toThrow('Form submission not found');
      });
    });

    describe('error handling for invalid data', () => {
      it('should throw error when firstName is empty', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: '',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any)
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any);

        await expect(service.createMember(memberData)).rejects.toThrow('First name is required');
      });

      it('should throw error when firstName is only whitespace', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: '   ',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any)
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any);

        await expect(service.createMember(memberData)).rejects.toThrow('First name is required');
      });

      it('should throw error when lastName is empty', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: '',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any)
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any);

        await expect(service.createMember(memberData)).rejects.toThrow('Last name is required');
      });

      it('should throw error when lastName is only whitespace', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: '   ',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any)
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any);

        await expect(service.createMember(memberData)).rejects.toThrow('Last name is required');
      });
    });

    describe('retry logic for membership number collision', () => {
      it('should retry on membership number collision and succeed', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '0' };
        const year = new Date().getFullYear();

        // First attempt: collision error
        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any) // getSubmissionById
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any) // getOrganization
          .mockResolvedValueOnce({ rows: [mockMemberCount] } as any) // getMemberCount
          .mockRejectedValueOnce({ // INSERT fails with unique constraint violation
            code: '23505',
            constraint: 'members_membership_number_key',
          })
          // Second attempt: success
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any) // getOrganization
          .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any) // getMemberCount (incremented)
          .mockResolvedValueOnce({ // INSERT succeeds
            rows: [{
              id: 'member-1',
              organisation_id: 'org-1',
              membership_type_id: 'type-1',
              user_id: 'user-1',
              membership_number: `TEST-${year}-00002`,
              first_name: 'John',
              last_name: 'Doe',
              form_submission_id: 'submission-1',
              date_last_renewed: new Date(),
              status: 'active',
              valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              labels: [],
              processed: false,
              payment_status: 'pending',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

        const result = await service.createMember(memberData);

        expect(result).toBeDefined();
        expect(result.membershipNumber).toBe(`TEST-${year}-00002`);
        // 1 getMembershipTypeById + 1 getSubmissionById + (3 queries per attempt * 2 attempts) = 8 total
        expect(mockDb.query).toHaveBeenCalledTimes(8);
      });

      it('should throw error after max retries on persistent collision', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '0' };

        // All attempts fail with collision
        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any) // getSubmissionById
          .mockResolvedValue({ rows: [mockOrganization] } as any) // getOrganization (all attempts)
          .mockResolvedValue({ rows: [mockMemberCount] } as any) // getMemberCount (all attempts)
          .mockRejectedValue({ // INSERT fails (all attempts)
            code: '23505',
            constraint: 'members_membership_number_key',
          });

        await expect(service.createMember(memberData)).rejects.toThrow(
          'Failed to create member after 3 attempts due to membership number collision'
        );
      });

      it('should throw immediately on non-collision errors', async () => {
        const memberData = {
          organisationId: 'org-1',
          membershipTypeId: 'type-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          formSubmissionId: 'submission-1',
        };

        const mockMembershipType = {
          id: 'type-1',
          organisationId: 'org-1',
          name: 'Test Membership',
          isRollingMembership: true,
          numberOfMonths: 12,
          automaticallyApprove: true,
        };

        const mockFormSubmission = {
          id: 'submission-1',
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'membership_application',
          contextId: 'manual-creation',
          submissionData: {},
          status: 'approved',
        };

        const mockOrganization = { id: 'org-1', short_name: 'TEST' };
        const mockMemberCount = { count: '0' };

        // Different error (not collision)
        mockDb.query
          .mockResolvedValueOnce({ rows: [mockMembershipType] } as any) // getMembershipTypeById
          .mockResolvedValueOnce({ rows: [mockFormSubmission] } as any) // getSubmissionById
          .mockResolvedValueOnce({ rows: [mockOrganization] } as any) // getOrganization
          .mockResolvedValueOnce({ rows: [mockMemberCount] } as any) // getMemberCount
          .mockRejectedValueOnce(new Error('Database connection error')); // Different error

        await expect(service.createMember(memberData)).rejects.toThrow('Database connection error');
        
        // Should not retry on non-collision errors
        expect(mockDb.query).toHaveBeenCalledTimes(5); // Only one attempt
      });
    });
  });
});

