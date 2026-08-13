import request from 'supertest';
import type { Server } from 'http';
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

/*
 * One listener for the whole file.
 *
 * `request(app)` starts a server on a fresh ephemeral port for every call. Over
 * a run that makes thousands of them, ports get reused while the previous
 * connection's packets are still in flight, and the client reads bytes that are
 * not a response at all — "Parse Error: Expected HTTP/", a hang-up, or somebody
 * else's reply. One listener per file removes that churn.
 */
let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('OrgAdmin Workflows Integration Tests', () => {

  let authToken: string;
  let adminUserId: string;
  let testOrganisationId: string;
  let testOrganisationTypeId: string;
  let adminOrganisationUserId: string;
  let adminRoleId: string;

  beforeAll(async () => {
    await db.initialize();
    
    // Set up test authentication
    process.env.DISABLE_AUTH = 'true';
    authToken = 'mock-token';
    adminUserId = 'dev-user-123';

    /*
     * The table is `organizations`, not `organisations`. This insert used the
     * British spelling and so failed with "relation does not exist" before any
     * test in the file ran.
     *
     * It also omitted four NOT NULL columns — organization_type_id,
     * keycloak_group_id, currency and url_code — so correcting the name alone
     * was not enough. An organisation type is created first because the
     * foreign key requires one.
     */
    const typeResult = await db.query(
      `INSERT INTO organization_types
         (name, display_name, currency, language, default_locale,
          membership_numbering, membership_number_uniqueness,
          initial_membership_number, created_at, updated_at)
       -- The two columns are constrained: numbering is 'internal' | 'external'
       -- and uniqueness is 'organization' | 'organization_type' (American
       -- spelling, unlike most of the schema).
       VALUES ($1, $2, 'EUR', 'en', 'en-GB', 'internal', 'organization', 1, NOW(), NOW())
       RETURNING id`,
      [`test_type_${Date.now()}`, 'Test Organisation Type']
    );
    testOrganisationTypeId = typeResult.rows[0].id;

    /*
     * The organisation has to enable the capabilities these workflows use:
     * `loadOrganisationCapabilities` reads `enabled_capabilities` from the row
     * and `requireCapability` refuses with 403 when the one a route asks for is
     * not among them.
     */
    const orgResult = await db.query(
      `INSERT INTO organizations
         (organization_type_id, keycloak_group_id, name, display_name,
          currency, url_code, status, enabled_capabilities, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'EUR', $5, 'active',
               '["event-management", "memberships", "forms", "payments"]', NOW(), NOW())
       RETURNING id`,
      [
        testOrganisationTypeId,
        `test-group-${Date.now()}`,
        // Unique per run: `organizations.name` is unique, and a run that dies
        // before its teardown would otherwise block every run after it.
        `test_org_${Date.now()}`,
        'Test Organisation',
        `testorg${Date.now()}`,
      ]
    );
    testOrganisationId = orgResult.rows[0].id;

    /*
     * `DISABLE_AUTH` hands every request the mock development user, but that
     * only settles who is calling. Authorisation still reads the database: the
     * caller must have an active `org-admin` row in `organization_users` for
     * this organisation, or every org-admin route answers 403. That row is what
     * ties the mock identity to the fixture organisation.
     */
    await db.query(
      `INSERT INTO users (id, keycloak_user_id, username, email, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (keycloak_user_id) DO NOTHING`,
      [adminUserId, `dev-user-${Date.now()}`, `dev-${Date.now()}@example.com`]
    );

    const orgUserResult = await db.query(
      `INSERT INTO organization_users
         (organization_id, keycloak_user_id, email, first_name, last_name, user_type, status)
       VALUES ($1, $2, $3, 'Dev', 'Admin', 'org-admin', 'active')
       RETURNING id`,
      [testOrganisationId, adminUserId, `dev-${Date.now()}@example.com`]
    );
    adminOrganisationUserId = orgUserResult.rows[0].id;

    /*
     * And a role: `requireOrgAdmin` asks for an `admin` or
     * `full-administrator` role on that membership, separately from the
     * capability check — being an org admin says the person may act for the
     * club, the role says how far.
     */
    const roleResult = await db.query(
      `INSERT INTO organization_admin_roles
         (organization_id, name, display_name, description, capability_permissions, is_system_role)
       VALUES ($1, 'admin', 'Administrator', 'Full access for tests', '{}', true)
       RETURNING id`,
      [testOrganisationId]
    );
    adminRoleId = roleResult.rows[0].id;

    await db.query(
      `INSERT INTO organization_user_roles (organization_user_id, organization_admin_role_id)
       VALUES ($1, $2)`,
      [adminOrganisationUserId, adminRoleId]
    );
  });

  afterAll(async () => {
    // Clean up test organisation
    if (adminOrganisationUserId) {
      // By the member, not by the event: `beforeEach` may already have removed
      // the events, leaving entries this subquery could no longer find.
      await db.query('DELETE FROM event_entries WHERE user_id = $1', [adminOrganisationUserId]);
      await db.query('DELETE FROM events WHERE organisation_id = $1', [testOrganisationId]);
      await db.query('DELETE FROM form_submissions WHERE organisation_id = $1', [
        testOrganisationId,
      ]);
      await db.query('DELETE FROM members WHERE organisation_id = $1', [testOrganisationId]);
      await db.query('DELETE FROM organization_user_roles WHERE organization_user_id = $1', [
        adminOrganisationUserId,
      ]);
      await db.query('DELETE FROM organization_users WHERE id = $1', [adminOrganisationUserId]);
    }
    if (adminRoleId) {
      await db.query('DELETE FROM organization_admin_roles WHERE id = $1', [adminRoleId]);
    }
    await db.query('DELETE FROM users WHERE keycloak_user_id = $1', [adminUserId]);
    await db.query('DELETE FROM organizations WHERE id = $1', [testOrganisationId]);
    await db.query('DELETE FROM organization_types WHERE id = $1', [testOrganisationTypeId]);
    // Left open deliberately: the pool is a singleton shared by every suite in the
      // run — jest uses one worker and a fresh module registry per file, not a fresh
      // process — so closing it here pulls the connection out from under whatever
      // runs next. `forceExit` in jest.config.js ends the process.
      // await db.close();
  });

  beforeEach(async () => {
    /*
     * Clean up test data before each test, deepest first: entries reference an
     * activity and a member, submissions reference a form, and Postgres will
     * not let a parent go while a child still points at it.
     */
    await db.query(
      `DELETE FROM event_entries
        WHERE event_id IN (SELECT id FROM events WHERE organisation_id = $1)`,
      [testOrganisationId]
    );
    await db.query('DELETE FROM members WHERE organisation_id = $1', [testOrganisationId]);
    await db.query('DELETE FROM form_submissions WHERE organisation_id = $1', [
      testOrganisationId,
    ]);
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

      const formResponse = await request(server)
        .post('/api/orgadmin/application-forms')
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

      const eventResponse = await request(server)
        .post('/api/orgadmin/events')
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

      const activityResponse = await request(server)
        .post(`/api/orgadmin/events/${eventId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activityData)
        .expect(201);

      const activityId = activityResponse.body.id;
      expect(activityId).toBeDefined();

      // Step 4: Retrieve event with activities
      const getEventResponse = await request(server)
        .get(`/api/orgadmin/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getEventResponse.body.id).toBe(eventId);
      expect(getEventResponse.body.name).toBe(eventData.name);

      /*
       * Step 5: An entry, as a member entering would leave it.
       *
       * There is no org-admin endpoint that creates one: entries come from the
       * member's own checkout, through fulfilment. What the club does with them
       * is read them, which is the next step.
       */
      const entryResult = await db.query(
        `INSERT INTO event_entries
           (event_id, event_activity_id, user_id, first_name, last_name, email,
            quantity, payment_status, entry_date)
         VALUES ($1, $2, $3, 'John', 'Doe', 'john.doe@example.com', 1, 'pending', NOW())
         RETURNING id`,
        [eventId, activityId, adminOrganisationUserId]
      );
      const entryId = entryResult.rows[0].id;
      expect(entryId).toBeDefined();

      // Step 6: List entries for event
      const entriesResponse = await request(server)
        .get(`/api/orgadmin/events/${eventId}/entries`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(entriesResponse.body)).toBe(true);
      expect(entriesResponse.body.length).toBeGreaterThan(0);

      // Step 7: Update event
      const updateData = {
        name: 'Annual Competition - Updated',
        status: 'published',
      };

      await request(server)
        .put(`/api/orgadmin/events/${eventId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Step 8: Delete event (cleanup)
      await request(server)
        .delete(`/api/orgadmin/events/${eventId}`)
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

      const formResponse = await request(server)
        .post('/api/orgadmin/application-forms')
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

      const membershipTypeResponse = await request(server)
        .post('/api/orgadmin/membership-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send(membershipTypeData)
        .expect(201);

      const membershipTypeId = membershipTypeResponse.body.id;
      expect(membershipTypeId).toBeDefined();

      /*
       * Step 3: Create member (simulating application).
       *
       * A member is created *from* a submitted form — the service refuses
       * without one, because the application is the record of what the member
       * agreed to. And `userId` is the person's membership row for this club,
       * not their Keycloak subject.
       */
      const submissionResult = await db.query(
        `INSERT INTO form_submissions
           (form_id, organisation_id, user_id, submission_type, context_id, submission_data, status)
         VALUES ($1, $2, $3, 'membership_application', $4, $5, 'approved')
         RETURNING id`,
        [
          formId,
          testOrganisationId,
          adminOrganisationUserId,
          membershipTypeId,
          JSON.stringify({ full_name: 'Jane Smith', date_of_birth: '1990-01-01' }),
        ]
      );

      const memberData = {
        organisationId: testOrganisationId,
        membershipTypeId,
        userId: adminOrganisationUserId,
        membershipNumber: 'MEM-2024-001',
        firstName: 'Jane',
        lastName: 'Smith',
        formSubmissionId: submissionResult.rows[0].id,
        dateLastRenewed: new Date().toISOString(),
        status: 'active',
        validUntil: '2024-12-31',
        labels: ['adult', 'active'],
        processed: false,
        paymentStatus: 'paid',
        paymentMethod: 'card',
      };

      const memberResponse = await request(server)
        .post('/api/orgadmin/members')
        .set('Authorization', `Bearer ${authToken}`)
        .send(memberData)
        .expect(201);

      const memberId = memberResponse.body.id;
      expect(memberId).toBeDefined();

      // Step 4: Retrieve member details
      const getMemberResponse = await request(server)
        .get(`/api/orgadmin/members/${memberId}`)
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

      await request(server)
        // A member is updated with PATCH: the club changes a status or a
        // label, it does not replace the person.
        .patch(`/api/orgadmin/members/${memberId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateMemberData)
        .expect(200);

      // Step 6: List members with filters
      const membersResponse = await request(server)
        .get(`/api/orgadmin/members?status=active`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(membersResponse.body)).toBe(true);

      // Step 7: Mark member as processed
      await request(server)
        .patch(`/api/orgadmin/members/${memberId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ processed: true })
        .expect(200);

      // Step 8: Delete membership type (cleanup)
      await request(server)
        .delete(`/api/orgadmin/membership-types/${membershipTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('Payment and Refund Workflow', () => {
    /**
     * A club does not create payments — members do, by paying. The org-admin
     * API therefore offers no way to make one, and this workflow starts where
     * an administrator's actually does: a payment that has already arrived,
     * which they look up and then refund.
     */
    it('should complete a payment lifecycle: look one up -> list it -> refund it', async () => {
      // A payment as checkout would have left it.
      const paymentResult = await db.query(
        `INSERT INTO payments
           (organisation_id, user_id, payment_type, context_id, amount, currency,
            payment_method, payment_status, payment_date, metadata)
         VALUES ($1, $2, 'event_entry', $3, 50.00, 'EUR', 'card', 'paid', NOW(), $4)
         RETURNING id`,
        [
          testOrganisationId,
          adminOrganisationUserId,
          testOrganisationId,
          JSON.stringify({
            eventName: 'Annual Competition',
            activityName: 'Under 18 Category',
          }),
        ]
      );
      const paymentId = paymentResult.rows[0].id;

      // Step 1: Retrieve payment details
      const getPaymentResponse = await request(server)
        .get(`/api/orgadmin/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getPaymentResponse.body.id).toBe(paymentId);
      expect(getPaymentResponse.body.paymentStatus).toBe('paid');

      // Step 2: The organisation's payment list includes it
      const paymentsResponse = await request(server)
        .get(`/api/orgadmin/organisations/${testOrganisationId}/payments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(paymentsResponse.body)).toBe(true);
      expect(paymentsResponse.body.some((p: { id: string }) => p.id === paymentId)).toBe(true);

      // Step 3: Request a refund
      const refundResponse = await request(server)
        .post(`/api/orgadmin/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organisationId: testOrganisationId,
          refundAmount: 50.0,
          refundReason: 'Event cancelled',
          requestedBy: adminOrganisationUserId,
        })
        .expect(201);

      expect(refundResponse.body.id).toBeDefined();

      // Step 4: The refund is recorded against the payment
      const refunds = await db.query('SELECT * FROM refunds WHERE payment_id = $1', [paymentId]);
      expect(refunds.rows.length).toBe(1);
      expect(Number(refunds.rows[0].refund_amount)).toBe(50);

      await db.query('DELETE FROM refunds WHERE payment_id = $1', [paymentId]);
      await db.query('DELETE FROM payments WHERE id = $1', [paymentId]);
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

      const formResponse = await request(server)
        .post('/api/orgadmin/application-forms')
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

      /*
       * A form does not own its fields — it references definitions from the
       * organisation's field library, so each one is created first and then
       * placed on the form. That indirection is the point of the builder: the
       * same "Email address" field can appear on every form.
       */
      for (const [index, field] of fields.entries()) {
        const definition = await request(server)
          .post('/api/orgadmin/application-fields')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            organisationId: testOrganisationId,
            name: field.name,
            label: field.label,
            datatype: field.datatype,
          })
          .expect(201);

        await request(server)
          .post(`/api/orgadmin/application-forms/${formId}/fields`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fieldId: definition.body.id,
            order: index + 1,
            required: field.required,
          })
          .expect(201);
      }

      /*
       * Step 3: Retrieve the form with its fields.
       *
       * `/application-forms/:id` returns the form alone; the fields it
       * references come back from `/with-fields`, which is the call the builder
       * makes when it opens one.
       */
      const getFormResponse = await request(server)
        .get(`/api/orgadmin/application-forms/${formId}/with-fields`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getFormResponse.body.id).toBe(formId);
      expect(getFormResponse.body.fields).toBeDefined();
      expect(getFormResponse.body.fields).toHaveLength(fields.length);

      // Step 4: Submit form (create submission)
      /*
       * `userId` is the person's membership row, `contextId` is the thing being
       * applied for (a uuid, not a label), and the answers are
       * `submissionData` — the shape the service reads.
       */
      const submissionData = {
        formId,
        organisationId: testOrganisationId,
        userId: adminOrganisationUserId,
        submissionType: 'event_entry',
        contextId: testOrganisationId,
        submissionData: {
          participant_name: 'Alice Johnson',
          email: 'alice@example.com',
          age_category: 'Under 18',
          emergency_contact: 'Bob Johnson - 555-1234',
        },
      };

      const submissionResponse = await request(server)
        .post('/api/orgadmin/form-submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submissionData)
        .expect(201);

      const submissionId = submissionResponse.body.id;
      expect(submissionId).toBeDefined();

      // Step 5: Retrieve submission
      const getSubmissionResponse = await request(server)
        .get(`/api/orgadmin/form-submissions/${submissionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getSubmissionResponse.body.id).toBe(submissionId);
      expect(getSubmissionResponse.body.submissionData.participant_name).toBe('Alice Johnson');

      // Step 6: List submissions for form
      const submissionsResponse = await request(server)
        // Submissions are listed per organisation, filtered by form — a club
        // reads its own post-bag, not a global one.
        .get(
          `/api/orgadmin/organisations/${testOrganisationId}/form-submissions?formId=${formId}`
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(submissionsResponse.body)).toBe(true);
      expect(submissionsResponse.body.length).toBeGreaterThan(0);

      // Step 7: Update form
      const updateFormData = {
        name: 'Event Registration Form - Updated',
        description: 'Updated comprehensive event registration form',
      };

      await request(server)
        .put(`/api/orgadmin/application-forms/${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateFormData)
        .expect(200);

      // Step 8: Delete form (cleanup)
      await request(server)
        .delete(`/api/orgadmin/application-forms/${formId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });
});
