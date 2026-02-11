/**
 * Configuration interface for Keycloak Admin Client
 * 
 * This interface defines the configuration required to initialize
 * and authenticate with the Keycloak Admin REST API.
 */
export interface KeycloakAdminConfig {
  /**
   * Base URL of the Keycloak server
   * @example 'http://localhost:8080'
   */
  baseUrl: string;

  /**
   * Name of the Keycloak realm to manage
   * @example 'aws-framework'
   */
  realmName: string;

  /**
   * Client ID for the service account used for admin operations
   * @example 'admin-cli'
   */
  clientId: string;

  /**
   * Client secret for the service account
   */
  clientSecret: string;
}
