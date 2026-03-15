import request from 'supertest';
import express from 'express';
import organizationTypeRoutes from '../../routes/organization-type.routes';
import { organizationTypeService } from '../../services/organization-type.service';

// Mock the service
jest.mock('../../services/organization-type.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { sub: 'test-user-id' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/admin/organization-types', organizationTypeRoutes);

describe('POST /api/admin/organization-types', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept membershipNumbering, membershipNumberUniqueness, and initialMembershipNumber fields', async () => {
    const mockOrgType = {
      id: 'test-id',
      name: 'test-org-type',
      displayName: 'Test Org Type',
      currency: 'GBP',
      language: 'en',
      defaultLocale: 'en-GB',
      defaultCapabilities: [],
      membershipNumbering: 'internal' as const,
      membershipNumberUniqueness: 'organization_type' as const,
      initialMembershipNumber: 2000000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (organizationTypeService.createOrganizationType as jest.Mock).mockResolvedValue(mockOrgType);

    const response = await request(app)
      .post('/api/admin/organization-types')
      .send({
        name: 'test-org-type',
        displayName: 'Test Org Type',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 2000000
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      membershipNumbering: 'internal',
      membershipNumberUniqueness: 'organization_type',
      initialMembershipNumber: 2000000
    });
    expect(organizationTypeService.createOrganizationType).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 2000000
      }),
      'test-user-id'
    );
  });

  it('should accept external mode without uniqueness and initial number', async () => {
    const mockOrgType = {
      id: 'test-id',
      name: 'test-org-type',
      displayName: 'Test Org Type',
      currency: 'GBP',
      language: 'en',
      defaultLocale: 'en-GB',
      defaultCapabilities: [],
      membershipNumbering: 'external' as const,
      membershipNumberUniqueness: 'organization' as const,
      initialMembershipNumber: 1000000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (organizationTypeService.createOrganizationType as jest.Mock).mockResolvedValue(mockOrgType);

    const response = await request(app)
      .post('/api/admin/organization-types')
      .send({
        name: 'test-org-type',
        displayName: 'Test Org Type',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external'
      });

    expect(response.status).toBe(201);
    expect(organizationTypeService.createOrganizationType).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipNumbering: 'external'
      }),
      'test-user-id'
    );
  });

  it('should return 400 for validation errors', async () => {
    (organizationTypeService.createOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Membership number uniqueness can only be set for internal numbering mode')
    );

    const response = await request(app)
      .post('/api/admin/organization-types')
      .send({
        name: 'test-org-type',
        displayName: 'Test Org Type',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external',
        membershipNumberUniqueness: 'organization_type'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Membership number uniqueness');
  });

  it('should return 400 for invalid initial membership number', async () => {
    (organizationTypeService.createOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Initial membership number must be a positive integer')
    );

    const response = await request(app)
      .post('/api/admin/organization-types')
      .send({
        name: 'test-org-type',
        displayName: 'Test Org Type',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal',
        initialMembershipNumber: -100
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Initial membership number');
  });
});

describe('PUT /api/admin/organization-types/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept membershipNumbering, membershipNumberUniqueness, and initialMembershipNumber fields', async () => {
    const mockOrgType = {
      id: 'test-id',
      name: 'test-org-type',
      displayName: 'Updated Org Type',
      currency: 'GBP',
      language: 'en',
      defaultLocale: 'en-GB',
      defaultCapabilities: [],
      membershipNumbering: 'internal' as const,
      membershipNumberUniqueness: 'organization_type' as const,
      initialMembershipNumber: 2000000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (organizationTypeService.updateOrganizationType as jest.Mock).mockResolvedValue(mockOrgType);

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        displayName: 'Updated Org Type',
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 2000000
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      membershipNumbering: 'internal',
      membershipNumberUniqueness: 'organization_type',
      initialMembershipNumber: 2000000
    });
    expect(organizationTypeService.updateOrganizationType).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 2000000
      }),
      'test-user-id'
    );
  });

  it('should accept external mode without uniqueness and initial number', async () => {
    const mockOrgType = {
      id: 'test-id',
      name: 'test-org-type',
      displayName: 'Test Org Type',
      currency: 'GBP',
      language: 'en',
      defaultLocale: 'en-GB',
      defaultCapabilities: [],
      membershipNumbering: 'external' as const,
      membershipNumberUniqueness: 'organization' as const,
      initialMembershipNumber: 1000000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (organizationTypeService.updateOrganizationType as jest.Mock).mockResolvedValue(mockOrgType);

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        membershipNumbering: 'external'
      });

    expect(response.status).toBe(200);
    expect(organizationTypeService.updateOrganizationType).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        membershipNumbering: 'external'
      }),
      'test-user-id'
    );
  });

  it('should return 400 for validation errors', async () => {
    (organizationTypeService.updateOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Membership number uniqueness can only be set for internal numbering mode')
    );

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        membershipNumbering: 'external',
        membershipNumberUniqueness: 'organization_type'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Membership number uniqueness');
  });

  it('should return 400 for invalid initial membership number', async () => {
    (organizationTypeService.updateOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Initial membership number must be a positive integer')
    );

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        membershipNumbering: 'internal',
        initialMembershipNumber: -100
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Initial membership number');
  });

  it('should return 400 when trying to change numbering mode with existing members', async () => {
    (organizationTypeService.updateOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Cannot change membership numbering mode when members already exist for this organization type')
    );

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        membershipNumbering: 'external'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Cannot change');
  });

  it('should return 400 when changing uniqueness scope would create duplicates', async () => {
    (organizationTypeService.updateOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Cannot change to organization type-level uniqueness: duplicate membership numbers exist across organizations (12345, 67890)')
    );

    const response = await request(app)
      .put('/api/admin/organization-types/test-id')
      .send({
        membershipNumberUniqueness: 'organization_type'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('duplicate membership numbers');
  });

  it('should return 404 when organization type not found', async () => {
    (organizationTypeService.updateOrganizationType as jest.Mock).mockRejectedValue(
      new Error('Organization type not found')
    );

    const response = await request(app)
      .put('/api/admin/organization-types/non-existent-id')
      .send({
        displayName: 'Updated Name'
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('not found');
  });
});
