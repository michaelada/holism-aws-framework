import { db } from '../database/pool';
import { logger } from '../config/logger';
import { organizationApplicationFeeService } from './organization-application-fee.service';
import {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationStats
} from '../types/organization.types';
import { capabilityService } from './capability.service';
import { organizationTypeService } from './organization-type.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import cacheService from './cache.service';
import { orgPaymentMethodDataService } from './org-payment-method-data.service';
import { ValidationError } from '../middleware/errors';
import {
  slugifyUrlCode,
  validateUrlCode,
  ensureUniqueUrlCode,
} from '../utils/url-code';

export class OrganizationService {
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(private kcAdmin: KeycloakAdminService) {}

  /**
   * Settle the URL code for an organisation.
   *
   * Supplied codes are validated and must be free — a collision is the
   * caller's to resolve, because silently altering a code the super admin
   * typed would put a different address in front of members than the one they
   * were shown. Generated codes are made unique automatically, since nobody
   * chose them.
   */
  private async resolveUrlCode(
    requested: string | undefined,
    fallbackSource: string,
    excludeOrganisationId?: string
  ): Promise<string> {
    const taken = await this.getUsedUrlCodes(excludeOrganisationId);

    if (requested !== undefined && requested !== null && requested !== '') {
      const validation = validateUrlCode(requested);
      if (!validation.valid) {
        throw new ValidationError(validation.message!);
      }
      if (taken.has(requested)) {
        throw new ValidationError(
          `The URL code "${requested}" is already used by another organisation`
        );
      }
      return requested;
    }

    return ensureUniqueUrlCode(slugifyUrlCode(fallbackSource), taken);
  }

  private async getUsedUrlCodes(excludeOrganisationId?: string): Promise<Set<string>> {
    const result = excludeOrganisationId
      ? await db.query(
          'SELECT url_code FROM organizations WHERE id <> $1',
          [excludeOrganisationId]
        )
      : await db.query('SELECT url_code FROM organizations');

    return new Set(
      result.rows
        .map((row: any) => row.url_code)
        .filter((code: string | null): code is string => Boolean(code))
    );
  }

  /**
   * Whether a URL code may be used, for the admin form's inline check.
   */
  async checkUrlCodeAvailability(
    code: string,
    excludeOrganisationId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    const validation = validateUrlCode(code);
    if (!validation.valid) {
      return { available: false, reason: validation.message };
    }

    const taken = await this.getUsedUrlCodes(excludeOrganisationId);
    return taken.has(code)
      ? { available: false, reason: 'That URL code is already in use' }
      : { available: true };
  }

  /**
   * Convert database row to Organization object
   */
  private rowToOrganization(row: any): Organization {
    return {
      id: row.id,
      organizationTypeId: row.organization_type_id,
      keycloakGroupId: row.keycloak_group_id,
      name: row.name,
      displayName: row.display_name,
      urlCode: row.url_code,
      domain: row.domain,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactMobile: row.contact_mobile,
      status: row.status,
      currency: row.currency,
      language: row.language,
      enabledCapabilities: row.enabled_capabilities || [],
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  /**
   * Get all organizations with optional type filter
   */
  async getAllOrganizations(organizationTypeId?: string): Promise<Organization[]> {
    try {
      let query = `
        SELECT o.*, 
               ot.name as org_type_name, 
               ot.display_name as org_type_display_name,
               ot.default_locale as org_type_default_locale
        FROM organizations o
        LEFT JOIN organization_types ot ON o.organization_type_id = ot.id
      `;
      const params: any[] = [];

      if (organizationTypeId) {
        query += ' WHERE o.organization_type_id = $1';
        params.push(organizationTypeId);
      }

      query += ' ORDER BY o.display_name';

      const result = await db.query(query, params);
      
      // Get user counts for each organization
      const organizations = await Promise.all(
        result.rows.map(async (row: any) => {
          const org = this.rowToOrganization(row);
          const stats = await this.getOrganizationStats(org.id);
          return {
            ...org,
            organizationType: row.org_type_name ? {
              id: org.organizationTypeId,
              name: row.org_type_name,
              displayName: row.org_type_display_name,
              defaultLocale: row.org_type_default_locale || 'en-GB'
            } : undefined,
            adminUserCount: stats.adminUserCount,
            accountUserCount: stats.accountUserCount
          };
        })
      );

      return organizations;
    } catch (error) {
      logger.error('Error getting organizations:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      // Check cache first
      const cacheKey = `org:${id}`;
      const cached = cacheService.get<Organization>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for organization ${id}`);
        return cached;
      }

      const result = await db.query(
        `SELECT o.*, 
                ot.name as org_type_name, 
                ot.display_name as org_type_display_name,
                ot.default_locale as org_type_default_locale
         FROM organizations o
         LEFT JOIN organization_types ot ON o.organization_type_id = ot.id
         WHERE o.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const org = this.rowToOrganization(result.rows[0]);
      const stats = await this.getOrganizationStats(id);
      
      // Get payment methods for the organization
      let paymentMethods: any[] = [];
      try {
        paymentMethods = await orgPaymentMethodDataService.getOrgPaymentMethods(id);
      } catch (paymentError) {
        logger.error(`Error fetching payment methods for organization ${id}:`, paymentError);
        // Continue without payment methods if fetch fails
      }
      
      const fullOrg = {
        ...org,
        organizationType: result.rows[0].org_type_name ? {
          id: org.organizationTypeId,
          name: result.rows[0].org_type_name,
          displayName: result.rows[0].org_type_display_name,
          defaultLocale: result.rows[0].org_type_default_locale || 'en-GB'
        } : undefined,
        adminUserCount: stats.adminUserCount,
        accountUserCount: stats.accountUserCount,
        paymentMethods
      };

      // Cache the result
      cacheService.set(cacheKey, fullOrg, this.CACHE_TTL);

      return fullOrg;
    } catch (error) {
      logger.error('Error getting organization by ID:', error);
      throw error;
    }
  }

  /**
   * Get organization by name
   */
  async getOrganizationByName(name: string): Promise<Organization | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organizations WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganization(result.rows[0]);
    } catch (error) {
      logger.error('Error getting organization by name:', error);
      throw error;
    }
  }

  /**
   * Create organization with Keycloak group
   */
  async createOrganization(
    data: CreateOrganizationDto,
    userId?: string
  ): Promise<Organization> {
    try {
      // Validate organization type exists
      const orgType = await organizationTypeService.getOrganizationTypeById(
        data.organizationTypeId
      );
      
      if (!orgType) {
        throw new Error('Organization type not found');
      }

      // Validate capabilities
      if (data.enabledCapabilities.length > 0) {
        const unknown = await capabilityService.unknownCapabilities(data.enabledCapabilities);
        if (unknown.length > 0) {
          throw new ValidationError(
            `Unknown ${unknown.length === 1 ? 'capability' : 'capabilities'}: ${unknown.join(', ')}`
          );
        }

        // Ensure capabilities are subset of org type defaults
        const invalidCaps = data.enabledCapabilities.filter(
          cap => !orgType.defaultCapabilities.includes(cap)
        );
        if (invalidCaps.length > 0) {
          throw new Error(
            `Capabilities not in organization type defaults: ${invalidCaps.join(', ')}`
          );
        }
      }

      // Settle the URL code before touching Keycloak — a rejected code should
      // not leave an orphaned group behind.
      const urlCode = await this.resolveUrlCode(
        data.urlCode,
        data.displayName || data.name
      );

      // Create Keycloak group hierarchy
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();
      
      // Find or create organization type group
      const groups = await client.groups.find({ search: orgType.name });
      let orgTypeGroup = groups.find((g: any) => g.name === orgType.name);
      
      if (!orgTypeGroup) {
        // Create organization type group
        const { id: orgTypeGroupId } = await client.groups.create({ name: orgType.name });
        orgTypeGroup = await client.groups.findOne({ id: orgTypeGroupId! });
      }

      // Create organization group under type group
      const { id: orgGroupId } = await client.groups.createChildGroup(
        { id: orgTypeGroup!.id! },
        { name: data.name }
      );

      // Fetch the created organization group
      const orgGroup = await client.groups.findOne({ id: orgGroupId! });

      // Create admin and member subgroups
      await client.groups.createChildGroup(
        { id: orgGroupId! },
        { name: 'admins' }
      );
      
      await client.groups.createChildGroup(
        { id: orgGroupId! },
        { name: 'members' }
      );

      // Insert into database
      const result = await db.query(
        `INSERT INTO organizations
         (organization_type_id, keycloak_group_id, name, display_name, url_code, domain,
          contact_name, contact_email, contact_mobile, status,
          currency, language, enabled_capabilities, settings, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          data.organizationTypeId,
          orgGroup!.id,
          data.name,
          data.displayName,
          urlCode,
          data.domain,
          data.contactName,
          data.contactEmail,
          data.contactMobile,
          data.status || 'active',
          // Always the organisation type's currency: the type's fixed handling
          // fee is a cash amount in it, so the two cannot diverge. Any currency
          // sent by the client is ignored rather than rejected, so existing
          // callers keep working.
          orgType.currency,
          data.language || orgType.language,
          JSON.stringify(data.enabledCapabilities),
          JSON.stringify(data.settings || {}),
          userId,
          userId
        ]
      );

      logger.info(`Organization created: ${data.name} with Keycloak group: ${orgGroup!.id}`);
      
      const createdOrg = this.rowToOrganization(result.rows[0]);
      
      // Initialize default payment methods
      try {
        await orgPaymentMethodDataService.initializeDefaultPaymentMethods(createdOrg.id);
        
        // Sync additional payment methods if provided
        if (data.enabledPaymentMethods && data.enabledPaymentMethods.length > 0) {
          await orgPaymentMethodDataService.syncOrgPaymentMethods(
            createdOrg.id,
            data.enabledPaymentMethods
          );
        }
      } catch (paymentError) {
        logger.error(`Error initializing payment methods for organization ${createdOrg.id}:`, paymentError);
        // Don't fail organization creation if payment method initialization fails
        // The organization is still created, but payment methods may need to be configured manually
      }

      /*
       * Copy the type's Stripe Connect application fee onto the new
       * organisation.
       *
       * This is the "copy" in copy-on-create: from here the organisation
       * carries its own split and a later edit to the type will not reach it.
       * Only the application fee is copied — the handling fee stays on the type
       * and is read from there, because it decides what the member pays.
       *
       * Non-fatal for the same reason payment-method initialisation above is:
       * an organisation with no row falls back to its type's value, which is
       * the same arrangement this copy would have produced, so the failure mode
       * is benign and does not justify discarding a created organisation.
       */
      try {
        await organizationApplicationFeeService.copyFromType(
          createdOrg.id,
          data.organizationTypeId
        );
      } catch (feeError) {
        logger.error(
          `Error copying application fees for organization ${createdOrg.id}:`,
          feeError
        );
      }

      /*
       * Every organisation gets a "Full Administrator" role.
       *
       * Unlike the payment-method step above, a failure here is **not**
       * swallowed. An organisation with no administrator role cannot have
       * anyone granted access to it, so it is unusable — and an unusable
       * organisation that reports itself as created successfully is worse than
       * a visible failure, because it looks fine until someone tries to invite
       * an administrator and cannot.
       *
       * The insert is idempotent, so a caller retrying after some other failure
       * will not end up with duplicates.
       */
      /*
       * Imported lazily to avoid a cycle: `organization-admin-role.service`
       * already imports this module, and a static import both ways leaves one
       * of them `undefined` at module-initialisation time depending on which
       * loads first. The same pattern is used elsewhere in this codebase for
       * the same reason.
       */
      const { organizationAdminRoleService } = await import('./organization-admin-role.service');
      await organizationAdminRoleService.ensureFullAdministratorRole(createdOrg.id);

      return createdOrg;
    } catch (error) {
      logger.error('Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
      id: string,
      data: UpdateOrganizationDto,
      userId?: string
    ): Promise<Organization> {
      try {
        // Validate capabilities if provided
        if (data.enabledCapabilities) {
          const org = await this.getOrganizationById(id);
          if (!org) {
            throw new Error('Organization not found');
          }

          const orgType = await organizationTypeService.getOrganizationTypeById(
            org.organizationTypeId
          );

          if (data.enabledCapabilities.length > 0) {
            const unknown = await capabilityService.unknownCapabilities(data.enabledCapabilities);
            if (unknown.length > 0) {
              throw new ValidationError(
                `Unknown ${unknown.length === 1 ? 'capability' : 'capabilities'}: ${unknown.join(', ')}`
              );
            }

            // Ensure capabilities are subset of org type defaults
            const invalidCaps = data.enabledCapabilities.filter(
              cap => !orgType!.defaultCapabilities.includes(cap)
            );
            if (invalidCaps.length > 0) {
              throw new Error(
                `Capabilities not in organization type defaults: ${invalidCaps.join(', ')}`
              );
            }
          }
        }

        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramCount = 1;

        if (data.name !== undefined) {
          updates.push(`name = $${paramCount++}`);
          values.push(data.name);
        }
        if (data.displayName !== undefined) {
          updates.push(`display_name = $${paramCount++}`);
          values.push(data.displayName);
        }
        if (data.urlCode !== undefined) {
          // Changing a code breaks every link members already have, but that is
          // the super admin's call to make — it is validated, not prevented.
          const urlCode = await this.resolveUrlCode(data.urlCode, data.urlCode, id);
          updates.push(`url_code = $${paramCount++}`);
          values.push(urlCode);
        }
        if (data.domain !== undefined) {
          updates.push(`domain = $${paramCount++}`);
          values.push(data.domain);
        }
        if (data.contactName !== undefined) {
          updates.push(`contact_name = $${paramCount++}`);
          values.push(data.contactName);
        }
        if (data.contactEmail !== undefined) {
          updates.push(`contact_email = $${paramCount++}`);
          values.push(data.contactEmail);
        }
        if (data.contactMobile !== undefined) {
          updates.push(`contact_mobile = $${paramCount++}`);
          values.push(data.contactMobile);
        }
        if (data.status !== undefined) {
          updates.push(`status = $${paramCount++}`);
          values.push(data.status);
        }
        // data.currency is deliberately ignored. An organisation trades in its
        // organisation type's currency, because the type's fixed handling fee
        // is a cash amount in that currency (see G12 in
        // docs/ACCOUNT_USER_APP_WIREFRAMES.md). The value is dropped rather
        // than rejected so existing callers that still send it keep working.
        if (data.language !== undefined) {
          updates.push(`language = $${paramCount++}`);
          values.push(data.language);
        }
        if (data.enabledCapabilities !== undefined) {
          updates.push(`enabled_capabilities = $${paramCount++}`);
          values.push(JSON.stringify(data.enabledCapabilities));
        }
        if (data.settings !== undefined) {
          // Merge into the existing settings JSONB rather than replacing it,
          // so updating one group of settings (e.g. address) does not wipe
          // others stored under the same column (e.g. paymentSettings, which
          // is managed by the org admin's payment settings screen).
          updates.push(`settings = COALESCE(settings, '{}'::jsonb) || $${paramCount++}::jsonb`);
          values.push(JSON.stringify(data.settings));
        }

        if (userId) {
          updates.push(`updated_by = $${paramCount++}`);
          values.push(userId);
        }

        values.push(id);

        const result = await db.query(
          `UPDATE organizations 
           SET ${updates.join(', ')}
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          throw new Error('Organization not found');
        }

        const updatedOrg = this.rowToOrganization(result.rows[0]);

        // Sync payment methods if provided
        if (data.enabledPaymentMethods !== undefined) {
          try {
            await orgPaymentMethodDataService.syncOrgPaymentMethods(
              id,
              data.enabledPaymentMethods
            );
          } catch (paymentError) {
            logger.error(`Error syncing payment methods for organization ${id}:`, paymentError);
            // Don't fail organization update if payment method sync fails
          }
        }

        // Invalidate cache
        cacheService.delete(`org:${id}`);

        logger.info(`Organization updated: ${id}`);
        return updatedOrg;
      } catch (error) {
        logger.error('Error updating organization:', error);
        throw error;
      }
    }

  /**
   * Delete organization and Keycloak group
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      const org = await this.getOrganizationById(id);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Check if organization has users
      const stats = await this.getOrganizationStats(id);
      if (stats.adminUserCount > 0 || stats.accountUserCount > 0) {
        throw new Error('Cannot delete organization with existing users');
      }

      // Delete Keycloak group
      try {
        await this.kcAdmin.ensureAuthenticated();
        const client = this.kcAdmin.getClient();
        await client.groups.del({ id: org.keycloakGroupId });
      } catch (kcError) {
        logger.warn(`Failed to delete Keycloak group: ${org.keycloakGroupId}`, kcError);
        // Continue with database deletion even if Keycloak fails
      }

      // Delete from database
      const result = await db.query(
        'DELETE FROM organizations WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Organization not found');
      }

      // Invalidate cache
      cacheService.delete(`org:${id}`);

      logger.info(`Organization deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting organization:', error);
      throw error;
    }
  }

  /**
   * Update organization capabilities
   */
  async updateOrganizationCapabilities(
    id: string,
    capabilities: string[],
    userId?: string
  ): Promise<Organization> {
    try {
      return await this.updateOrganization(
        id,
        { enabledCapabilities: capabilities },
        userId
      );
    } catch (error) {
      logger.error('Error updating organization capabilities:', error);
      throw error;
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(id: string): Promise<OrganizationStats> {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(CASE WHEN user_type = 'org-admin' THEN 1 END) as admin_user_count,
          COUNT(CASE WHEN user_type = 'account-user' THEN 1 END) as account_user_count
         FROM organization_users
         WHERE organization_id = $1 AND status = 'active'`,
        [id]
      );

      return {
        adminUserCount: parseInt(result.rows[0].admin_user_count) || 0,
        accountUserCount: parseInt(result.rows[0].account_user_count) || 0
      };
    } catch (error) {
      logger.error('Error getting organization stats:', error);
      throw error;
    }
  }

  /**
   * Get organizations by type
   */
  async getOrganizationsByType(typeId: string): Promise<Organization[]> {
    return this.getAllOrganizations(typeId);
  }
}

// Create singleton instance
// Note: KeycloakAdminService will be initialized with config from environment
const kcAdminConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: process.env.KEYCLOAK_REALM || 'master',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
};

const kcAdmin = KeycloakAdminService.getInstance(kcAdminConfig);
export const organizationService = new OrganizationService(kcAdmin);
