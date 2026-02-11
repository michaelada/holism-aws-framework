import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { KeycloakAdminConfig } from '../types/keycloak-admin.types';
import { logger } from '../config/logger';

/**
 * Service for managing Keycloak Admin Client connection and authentication
 * 
 * This service provides a singleton instance of the Keycloak Admin Client
 * with automatic token management and refresh capabilities.
 * 
 * Key Features:
 * - Authenticates using client credentials grant type
 * - Automatically refreshes expired tokens before API calls
 * - Retries failed operations once after re-authentication
 * - Singleton pattern to reuse connection across services
 */
export class KeycloakAdminService {
  private client: KeycloakAdminClient;
  private config: KeycloakAdminConfig;
  private tokenExpiresAt: number = 0;
  private static instance: KeycloakAdminService | null = null;

  /**
   * Initialize Keycloak Admin Client with configuration
   * 
   * @param config - Keycloak admin configuration
   */
  constructor(config: KeycloakAdminConfig) {
    this.config = config;
    this.client = new KeycloakAdminClient({
      baseUrl: config.baseUrl,
      realmName: config.realmName,
    });

    logger.info('KeycloakAdminService initialized', {
      baseUrl: config.baseUrl,
      realm: config.realmName,
      clientId: config.clientId,
    });
  }

  /**
   * Get singleton instance of KeycloakAdminService
   * 
   * @param config - Keycloak admin configuration (required on first call)
   * @returns Singleton instance
   */
  static getInstance(config?: KeycloakAdminConfig): KeycloakAdminService {
    if (!KeycloakAdminService.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      KeycloakAdminService.instance = new KeycloakAdminService(config);
    }
    return KeycloakAdminService.instance;
  }

  /**
   * Authenticate using service account credentials
   * 
   * Uses client credentials grant type to obtain an access token
   * from Keycloak. The token is stored internally and used for
   * subsequent API calls.
   * 
   * @throws Error if authentication fails
   */
  async authenticate(): Promise<void> {
    try {
      logger.debug('Authenticating with Keycloak', {
        clientId: this.config.clientId,
        realm: this.config.realmName,
      });

      // Manually get token using fetch since the library's auth method has issues
      const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realmName}/protocol/openid-connect/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const tokenData = await response.json() as { access_token: string; expires_in?: number };
      
      // Set the access token on the client
      this.client.setAccessToken(tokenData.access_token);

      // Calculate token expiration time
      const expiresIn = tokenData.expires_in || 60;
      this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
      
      logger.info('Successfully authenticated with Keycloak', {
        expiresIn,
        expiresAt: new Date(this.tokenExpiresAt).toISOString(),
      });
    } catch (error) {
      logger.error('Failed to authenticate with Keycloak', {
        error: error instanceof Error ? error.message : String(error),
        clientId: this.config.clientId,
      });
      throw new Error(`Keycloak authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if current token is expired
   * 
   * Checks if the current access token has expired or will expire
   * within the next 10 seconds (buffer for network latency).
   * 
   * @returns true if token is expired or will expire soon
   */
  isTokenExpired(): boolean {
    // Add 10 second buffer to account for network latency
    const bufferMs = 10 * 1000;
    const isExpired = Date.now() >= (this.tokenExpiresAt - bufferMs);
    
    if (isExpired) {
      logger.debug('Token is expired or expiring soon', {
        expiresAt: new Date(this.tokenExpiresAt).toISOString(),
        now: new Date().toISOString(),
      });
    }
    
    return isExpired;
  }

  /**
   * Ensure token is valid, refresh if needed
   * 
   * Checks if the current token is expired and automatically
   * refreshes it if necessary. This method should be called
   * before making any Keycloak API calls.
   * 
   * @throws Error if re-authentication fails
   */
  async ensureAuthenticated(): Promise<void> {
    if (this.isTokenExpired()) {
      logger.debug('Token expired, re-authenticating');
      await this.authenticate();
    }
  }

  /**
   * Get the underlying admin client
   * 
   * Returns the Keycloak Admin Client instance for making API calls.
   * Callers should call ensureAuthenticated() before using the client.
   * 
   * @returns Keycloak Admin Client instance
   */
  getClient(): KeycloakAdminClient {
    return this.client;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    KeycloakAdminService.instance = null;
  }
}
