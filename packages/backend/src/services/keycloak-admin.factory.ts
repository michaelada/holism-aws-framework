import { KeycloakAdminService } from './keycloak-admin.service';
import { KeycloakAdminConfig } from '../types/keycloak-admin.types';
import { logger } from '../config/logger';

/**
 * Factory function to create KeycloakAdminService from environment variables
 * 
 * Reads configuration from environment variables and creates a singleton
 * instance of KeycloakAdminService.
 * 
 * Required environment variables:
 * - KEYCLOAK_ADMIN_BASE_URL: Base URL of Keycloak server
 * - KEYCLOAK_ADMIN_REALM: Realm name
 * - KEYCLOAK_ADMIN_CLIENT_ID: Service account client ID
 * - KEYCLOAK_ADMIN_CLIENT_SECRET: Service account client secret
 * 
 * @returns KeycloakAdminService instance
 * @throws Error if required environment variables are missing
 */
export function createKeycloakAdminService(): KeycloakAdminService {
  const baseUrl = process.env.KEYCLOAK_ADMIN_BASE_URL;
  const realmName = process.env.KEYCLOAK_ADMIN_REALM;
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;

  // Validate required environment variables
  const missingVars: string[] = [];
  if (!baseUrl) missingVars.push('KEYCLOAK_ADMIN_BASE_URL');
  if (!realmName) missingVars.push('KEYCLOAK_ADMIN_REALM');
  if (!clientId) missingVars.push('KEYCLOAK_ADMIN_CLIENT_ID');
  if (!clientSecret) missingVars.push('KEYCLOAK_ADMIN_CLIENT_SECRET');

  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const config: KeycloakAdminConfig = {
    baseUrl: baseUrl!,
    realmName: realmName!,
    clientId: clientId!,
    clientSecret: clientSecret!,
  };

  logger.info('Creating KeycloakAdminService from environment configuration');
  return KeycloakAdminService.getInstance(config);
}
