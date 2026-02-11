import { db } from '../database/pool';
import { logger } from '../config/logger';
import { Request } from 'express';

/**
 * Data Transfer Objects for Audit Log operations
 */
export interface LogAdminActionDto {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

/**
 * Service for managing audit logging operations
 * 
 * This service logs all administrative actions performed in the system
 * for compliance and security auditing purposes.
 * 
 * Key Features:
 * - Logs all admin actions with user ID, timestamp, and details
 * - Extracts user ID from authenticated request
 * - Extracts IP address from request headers
 * - Stores audit logs in PostgreSQL database
 */
export class AuditLogService {
  constructor(private database: typeof db = db) {}

  /**
   * Log an administrative action
   * 
   * Creates an audit log entry with:
   * - User ID of the admin performing the action
   * - Action type (create, update, delete, etc.)
   * - Resource type (tenant, user, role)
   * - Resource ID (if applicable)
   * - Changes made (for updates)
   * - IP address of the admin user
   * - Timestamp
   * 
   * @param data - Audit log data
   * @returns Created audit log entry
   * @throws Error if logging fails
   */
  async logAdminAction(data: LogAdminActionDto): Promise<AuditLogEntry> {
    try {
      logger.debug('Logging admin action', {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
      });

      const result = await this.database.query(
        `INSERT INTO admin_audit_log (user_id, action, resource, resource_id, changes, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, action, resource, resource_id, changes, ip_address, timestamp`,
        [
          data.userId || null,
          data.action,
          data.resource,
          data.resourceId || null,
          data.changes ? JSON.stringify(data.changes) : null,
          data.ipAddress || null,
        ]
      );

      const auditLog = this.mapDbRowToAuditLog(result.rows[0]);

      logger.info('Admin action logged', {
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resource: auditLog.resource,
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error instanceof Error ? error.message : String(error),
        userId: data.userId,
        action: data.action,
        resource: data.resource,
      });
      throw error;
    }
  }

  /**
   * Extract user ID from authenticated request
   * 
   * Extracts the user ID from the request object and looks up the corresponding
   * database user ID. If the user doesn't exist in the database, returns null.
   * 
   * @param req - Express request object
   * @returns Database user ID from the users table, or null if not found
   * @throws Error if user info is not found in request
   */
  async extractUserIdFromRequest(req: Request): Promise<string | null> {
    // The auth middleware should populate req.user with the authenticated user
    const user = (req as any).user;

    if (!user || !user.userId) {
      throw new Error('User ID not found in request');
    }

    // Look up the database user ID based on Keycloak user ID
    try {
      const result = await this.database.query(
        'SELECT id FROM users WHERE keycloak_user_id = $1',
        [user.userId]
      );

      if (result.rows.length === 0) {
        // User doesn't exist in database yet, return null
        logger.warn('User not found in database for audit logging', {
          keycloakUserId: user.userId,
        });
        return null;
      }

      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to look up user ID for audit logging', {
        error: error instanceof Error ? error.message : String(error),
        keycloakUserId: user.userId,
      });
      return null;
    }
  }

  /**
   * Extract IP address from request
   * 
   * Extracts the client IP address from the request, checking:
   * 1. X-Forwarded-For header (for proxied requests)
   * 2. X-Real-IP header (for nginx proxied requests)
   * 3. req.ip (direct connection)
   * 
   * @param req - Express request object
   * @returns IP address of the client
   */
  extractIpAddressFromRequest(req: Request): string {
    // Check X-Forwarded-For header (may contain multiple IPs, take the first)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to req.ip
    return req.ip || 'unknown';
  }

  /**
   * Log admin action from request
   * 
   * Convenience method that extracts user ID and IP address from the request
   * and logs the admin action.
   * 
   * @param req - Express request object
   * @param action - Action type
   * @param resource - Resource type
   * @param resourceId - Resource ID (optional)
   * @param changes - Changes made (optional)
   * @returns Created audit log entry
   */
  async logAdminActionFromRequest(
    req: Request,
    action: string,
    resource: string,
    resourceId?: string,
    changes?: Record<string, any>
  ): Promise<AuditLogEntry> {
    const userId = await this.extractUserIdFromRequest(req);
    const ipAddress = this.extractIpAddressFromRequest(req);

    return this.logAdminAction({
      userId: userId || undefined, // Use undefined if user not found (will be stored as NULL)
      action,
      resource,
      resourceId,
      changes,
      ipAddress,
    });
  }

  /**
   * Map database row to AuditLogEntry object
   * 
   * @param row - Database row
   * @returns AuditLogEntry object
   */
  private mapDbRowToAuditLog(row: any): AuditLogEntry {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      changes: row.changes,
      ipAddress: row.ip_address,
      timestamp: row.timestamp,
    };
  }
}
