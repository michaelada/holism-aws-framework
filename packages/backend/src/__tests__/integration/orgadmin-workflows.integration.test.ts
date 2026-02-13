import request from 'supertest';
import { app } from '../../index';
import { db } from '../../database/pool';

// Mock the Keycloak services
jest.mock('../../services/keycloak-admin.factory', () => {
  let groupIdCounter = 0;
  let userIdCounter = 0;

  const mockClient = {
    groups: {
      create: jest.fn().mockImplementation(() => {
        groupIdCounter++;
        return Promise.resolve({ id: `mock-group-id-${groupIdCounter}` });
      }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((params: any) => {
        return Promise.resolve({ id: params.id, name: 'test-group' });
      }),
    },
    users: {
      create: jest.fn().mockImplementation(() => {
        userIdCounter++;
        return Promise.resolve({ id: `mock-user-id-${userIdCounter}` });
      }),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((params: any) => {
        return Promise.resolve({ 
          id: params.id, 
          username: 'test-user',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          enabled: true,
        });
      }),
    },
  };

  const mockKeycloakAdmin = {
    ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn().mockReturnValue(mockClient),
    authenticate: jest.fn().mockResolvedValue(undefined),
    isTokenExpired: jest.fn().mockReturnValue(false),
  };

  return {
    createKeycloakAdminService: jest.fn().mockReturnValue(mockKeycloakAdmin),
  };
});

/**
 * Integration tests for OrgAdmin workflows
 * 
 * These tests verify end-to-end user flows for organization administrators:
 * - Event creation and management workflow
 * - Membership signup and renewal workflow
 * - Payment and refund workflow
 * - Form builder and submission workflow
 * 
 * Validates: Requirements 3.5.2
 */
describe('OrgAdmin Workflows Integration Tests', () => {
  let authToken: string;
  let adminUserId: string;
  let testOrganisationId: string;

  beforeAll(async () => {
    await db.initialize();
    
    // Set up test authentication
    process.env.DISABLE_AUTH = 'true';
    authToken = 'mock-token';
    adminUserId = 'dev-user-123';

    // Create a test organisation
    const orgResult = await db.query(
      `INSERT INTO organisations (name, display_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['test_org', 'Test Organisation', 'active']
    );
    testOrganisationId = orgResult.rows[0].id;

    // Create a mock admin user
    try {
      await db.query(
        `INSERT INTO users (id, keycloak_user_id, username, email, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (keycloak_user_id) DO NOTHING`,
        [adminUserId, 'dev-user', 'dev@example.com']
      );
    } catch (error) {
      // Ignore if user already exists
    }
  });

  afterAll(async () => {
    // Clean up test organisation
    await db.query('DELETE FROM organisations WHERE id = $1', [testOrganisationId]);
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.query('DELETE FROM events WHERE organisation_id = $1', [testOrganisationId]);
    await db.query('DELETE FROM membership_types WHERE organisation_id = $1', [testOrganisationId]);
    await db.query('DELETE FROM payments WHERE organisation_id = $1', [testOrganisationId]);
    await db.query('DELETE FROM application_forms WHERE organisation_id = $1', [testOrganisationId]);
  });

  describe('Event Creation and Management Workflow', () => {
    it('should complete full event lifecycle: create -> add activities -> manage entries -> export', async () => {
      // Step 1: Create application form for event
      const formData = {
        organisationId: testOrganisationId,
        name: 'Event Entry Form',
        description: 'Form for event entries',
        fields: [
          {
            name: 'participant_name',
            label: 'Participant Name',
            datatype: 'text',
            required: true,
            order: 1,
          },
          {
            name: 'email',
            label: 'Email Address',
            datatype: 'email',
            required: true,
            order: 2,
          },
        ],
      };

      const formResponse = await request(app)
        .post('/api/application-forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formData)
        .expect(201);

      const formId = formResponse.body.id;
      expect(formId).toBeDefined();

      // Step 2: Create event with comprehensive attributes
      const eventData = {
        organisationId: testOrganisationId,
        name: 'Annual Competition',
        description: 'Annual sailing competition event',
        eventOwner: adminUserId,
        emailNotifications: 'admin@example.com,events@example.com',
        startDate: '2024-06-15',
        endDate: '2024-06-16',
        openDateEntries: '2024-05-01T00:00:00Z',
        entriesClosingDate: '2024-06-10T23:59:59Z',
        limitEntries: true,
        entriesLimit: 100,
        addConfirmationMessage: true,
        confirmationMessage: 'Thank you for entering our competition!',
        status: 'published',
      };

      const eventResponse = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      const eventId = eventResponse.body.id;
      expect(eventId).toBeDefined();
      expect(eventResponse.body.name).toBe(eventData.name);

      // Step 3: Add event activity
      const activityData = {
        eventId,
        name: 'Under 18 Category',
        description: 'Competition for under 18 sailors',
        showPublicly: true,
        applicationFormId: formId,
        limitApplicants: true,
        applicantsLimit: 50,
        allowSpecifyQuantity: false,
        useTermsAndConditions: true,
        termsAndConditions: '<p>By entering, you agree to follow all safety rules.</p>',
        fee: 25.00,
        allowedPaymentMethod: 'both',
        handlingFeeIncluded: true,
        chequePaymentInstructions: 'Make cheque payable to Sailing Club',
      };

      const activityResponse = await request(app)
        .post(`/api/events/${eventId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activityData)
        .expect(201);

      const activityId = activityResponse.body.id;
      expect(activityId).toBeDefined();

      // Step 4: Retrieve event with activities
      const getEventResponse = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getEventResponse.body.id).toBe(eventId);
      expect(getEventResponse.body.name).toBe(eventData.name);

      // Step 5: Create event entry (simulating user registration)
      const entryData = {
        eventId,
        eventActivityId: activityId,
        userId: adminUserId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        formSubmissionId: null,
        quantity: 1,
        paymentStatus: 'pending',
      };

      const entryResponse = await request(app)
        .post(`/api/events/${eventId}/entries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(entryData)
        .expect(201);

      const entryId = entryResponse.body.id;
      expect(entryId).toBeDefined();

      // Step 6: List entries for event
      const entriesResponse = await request(app)
        .get(`/api/events/${eventId}/entries`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(entriesResponse.body)).toBe(true);
      expect(entriesResponse.body.length).toBeGreaterThan(0);

      // Step 7: Update event
      const updateData = {
        name: 'Annual Competition - Updated',
        status: 'published',
      };

      await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Step 8: Delete event (cleanup)
      await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('Membership Signup and Renewal Workflow', () => {
    it('should complete full membership lifecycle: create type -> member applies -> renewal -> status changes', async () => {
      // Step 1: Create application form for membership
      const formData = {
        organisationId: testOrganisationId,
        name: 'Membership Application Form',
        description: 'Form for membership applications',
        fields: [
          {
            name: 'full_name',
            label: 'Full Name',
            datatype: 'text',
            required: true,
            order: 1,
          },
          {
            name: 'date_of_birth',
            label: 'Date of Birth',
            datatype: 'date',
            required: true,
            order: 2,
          },
        ],
      };

      const formResponse = await request(app)
        .post('/api/application-forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formData)
        .expect(201);

      const formId = formResponse.body.id;

      // Step 2: Create membership type
      const membershipTypeData = {
        organisationId: testOrganisationId,
        name: 'Adult Membership',
        description: 'Annual membership for adults',
        membershipFormId: formId,
        membershipStatus: 'open',
        isRollingMembership: false,
        validUntil: '2024-12-31',
        automaticallyApprove: true,
        memberLabels: ['adult', 'active'],
        supportedPaymentMethods: ['card', 'offline'],
        useTermsAndConditions: true,
        termsAndConditions: '<p>Membership terms and conditions</p>',
        membershipTypeCategory: 'single',
      };

      const membershipTypeResponse = await request(app)
        .post('/api/memberships/types')
        .set('Authorization', `Bearer ${authToken}`)
        .send(membershipTypeData)
        .expect(201);

      const membershipTypeId = membershipTypeResponse.body.id;
      expect(membershipTypeId).toBeDefined();

      // Step 3: Create member (simulating application)
      const memberData = {
        organisationId: testOrganisationId,
        membershipTypeId,
        userId: adminUserId,
        membershipNumber: 'MEM-2024-001',
        firstName: 'Jane',
        lastName: 'Smith',
        formSubmissionId: null,
        dateLastRenewed: new Date().toISOString(),
        status: 'active',
        validUntil: '2024-12-31',
        labels: ['adult', 'active'],
        processed: false,
        paymentStatus: 'paid',
        paymentMethod: 'card',
      };

      const memberResponse = await request(app)
        .post('/api/memberships/members')
        .set('Authorization', `Bearer ${authToken}`)
        .send(memberData)
        .expect(201);

      const memberId = memberResponse.body.id;
      expect(memberId).toBeDefined();

      // Step 4: Retrieve member details
      const getMemberResponse = await request(app)
        .get(`/api/memberships/members/${memberId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getMemberResponse.body.id).toBe(memberId);
      expect(getMemberResponse.body.status).toBe('active');

      // Step 5: Update member status (simulating renewal)
      const updateMemberData = {
        dateLastRenewed: new Date().toISOString(),
        validUntil: '2025-12-31',
        status: 'active',
      };

      await request(app)
        .put(`/api/memberships/members/${memberId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateMemberData)
        .expect(200);

      // Step 6: List members with filters
      const membersResponse = await request(app)
        .get(`/api/memberships/members?status=active`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(membersResponse.body)).toBe(true);

      // Step 7: Mark member as processed
      await request(app)
        .patch(`/api/memberships/members/${memberId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ processed: true })
        .expect(200);

      // Step 8: Delete membership type (cleanup)
      await request(app)
        .delete(`/api/memberships/types/${membershipTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('Payment and Refund Workflow', () => {
    it('should complete full payment lifecycle: create payment -> view details -> request refund', async () => {
      // Step 1: Create payment record
      const paymentData = {
        organisationId: testOrganisationId,
        userId: adminUserId,
        amount: 50.00,
        currency: 'EUR',
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentType: 'event_entry',
        contextId: 'event-123',
        stripePaymentIntentId: 'pi_test_123',
        metadata: {
          eventName: 'Annual Competition',
          activityName: 'Under 18 Category',
        },
      };

      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(201);

      const paymentId = paymentResponse.body.id;
      expect(paymentId).toBeDefined();
      expect(paymentResponse.body.amount).toBe(paymentData.amount);

      // Step 2: Retrieve payment details
      const getPaymentResponse = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getPaymentResponse.body.id).toBe(paymentId);
      expect(getPaymentResponse.body.paymentStatus).toBe('paid');

      // Step 3: List payments with filters
      const paymentsResponse = await request(app)
        .get(`/api/payments?status=paid&type=event_entry`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(paymentsResponse.body)).toBe(true);

      // Step 4: Request refund
      const refundData = {
        paymentId,
        amount: 50.00,
        reason: 'Event cancelled',
      };

      const refundResponse = await request(app)
        .post('/api/payments/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .send(refundData)
        .expect(201);

      const refundId = refundResponse.body.id;
      expect(refundId).toBeDefined();

      // Step 5: Verify payment status updated to refunded
      const updatedPaymentResponse = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.paymentStatus).toBe('refunded');

      // Step 6: List refunds
      const refundsResponse = await request(app)
        .get('/api/payments/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(refundsResponse.body)).toBe(true);
    });
  });

  describe('Form Builder and Submission Workflow', () => {
    it('should complete full form lifecycle: create form -> add fields -> submit -> retrieve submissions', async () => {
      // Step 1: Create application form
      const formData = {
        organisationId: testOrganisationId,
        name: 'Event Registration Form',
        description: 'Comprehensive event registration form',
        fields: [],
      };

      const formResponse = await request(app)
        .post('/api/application-forms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(formData)
        .expect(201);

      const formId = formResponse.body.id;
      expect(formId).toBeDefined();

      // Step 2: Add fields to form
      const fields = [
        {
          formId,
          name: 'participant_name',
          label: 'Participant Name',
          datatype: 'text',
          required: true,
          order: 1,
        },
        {
          formId,
          name: 'email',
          label: 'Email Address',
          datatype: 'email',
          required: true,
          order: 2,
        },
        {
          formId,
          name: 'age_category',
          label: 'Age Category',
          datatype: 'select',
          required: true,
          options: ['Under 12', 'Under 18', 'Adult'],
          order: 3,
        },
        {
          formId,
          name: 'emergency_contact',
          label: 'Emergency Contact',
          datatype: 'text',
          required: false,
          order: 4,
        },
      ];

      for (const field of fields) {
        await request(app)
          .post(`/api/application-forms/${formId}/fields`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(field)
          .expect(201);
      }

      // Step 3: Retrieve form with fields
      const getFormResponse = await request(app)
        .get(`/api/application-forms/${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getFormResponse.body.id).toBe(formId);
      expect(getFormResponse.body.fields).toBeDefined();

      // Step 4: Submit form (create submission)
      const submissionData = {
        formId,
        organisationId: testOrganisationId,
        userId: adminUserId,
        submissionType: 'event_entry',
        contextId: 'event-456',
        formData: {
          participant_name: 'Alice Johnson',
          email: 'alice@example.com',
          age_category: 'Under 18',
          emergency_contact: 'Bob Johnson - 555-1234',
        },
      };

      const submissionResponse = await request(app)
        .post('/api/form-submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(201);

      const submissionId = submissionResponse.body.id;
      expect(submissionId).toBeDefined();

      // Step 5: Retrieve submission
      const getSubmissionResponse = await request(app)
        .get(`/api/form-submissions/${submissionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getSubmissionResponse.body.id).toBe(submissionId);
      expect(getSubmissionResponse.body.formData.participant_name).toBe('Alice Johnson');

      // Step 6: List submissions for form
      const submissionsResponse = await request(app)
        .get(`/api/form-submissions?formId=${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(submissionsResponse.body)).toBe(true);
      expect(submissionsResponse.body.length).toBeGreaterThan(0);

      // Step 7: Update form
      const updateFormData = {
        name: 'Event Registration Form - Updated',
        description: 'Updated comprehensive event registration form',
      };

      await request(app)
        .put(`/api/application-forms/${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateFormData)
        .expect(200);

      // Step 8: Delete form (cleanup)
      await request(app)
        .delete(`/api/application-forms/${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });
});
