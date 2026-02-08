import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * User information extracted from JWT token
 */
export interface UserInfo {
  userId: string;
  email: string;
  roles: string[];
  groups: string[];
  username: string;
}

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: UserInfo;
}

/**
 * Keycloak configuration
 */
interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

/**
 * Get Keycloak configuration from environment variables
 */
function getKeycloakConfig(): KeycloakConfig {
  const url = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;

  if (!url || !realm || !clientId) {
    throw new Error('Keycloak configuration is incomplete. Check KEYCLOAK_URL, KEYCLOAK_REALM, and KEYCLOAK_CLIENT_ID environment variables.');
  }

  return { url, realm, clientId };
}

/**
 * Create JWKS client for fetching public keys from Keycloak
 */
function createJwksClient(keycloakUrl: string, realm: string) {
  const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;
  
  return jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: 86400000, // 24 hours
    rateLimit: true,
    jwksRequestsPerMinute: 10
  });
}

/**
 * Get signing key from JWKS
 */
function getKey(client: jwksClient.JwksClient) {
  return (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  };
}

/**
 * Extract user information from decoded JWT token
 */
function extractUserInfo(decoded: any): UserInfo {
  return {
    userId: decoded.sub || '',
    email: decoded.email || '',
    username: decoded.preferred_username || decoded.email || '',
    roles: decoded.realm_access?.roles || [],
    groups: decoded.groups || []
  };
}

/**
 * Authentication middleware that validates JWT tokens from Keycloak
 * 
 * This middleware:
 * 1. Extracts the JWT token from the Authorization header
 * 2. Validates the token signature using Keycloak's public key
 * 3. Verifies token claims (issuer, audience, expiration)
 * 4. Extracts user information and attaches it to the request
 * 
 * Development Mode:
 * - Set DISABLE_AUTH=true to bypass authentication (for testing only)
 * - A mock admin user will be attached to all requests
 * 
 * @returns Express middleware function
 */
export function authenticateToken() {
  // Development bypass: skip authentication if DISABLE_AUTH is set
  if (process.env.DISABLE_AUTH === 'true') {
    console.warn('⚠️  WARNING: Authentication is DISABLED. This should only be used in development!');
    
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
      // Set a mock admin user for development
      req.user = {
        userId: 'dev-user-123',
        email: 'dev@example.com',
        username: 'dev-user',
        roles: ['admin', 'user'],
        groups: []
      };
      next();
    };
  }

  const config = getKeycloakConfig();
  const client = createJwksClient(config.url, config.realm);
  const issuer = `${config.url}/realms/${config.realm}`;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'No authorization header provided'
          }
        });
        return;
      }

      const parts = authHeader.split(' ');
      
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization header format. Expected: Bearer <token>'
          }
        });
        return;
      }

      const token = parts[1];

      // Verify and decode token
      jwt.verify(
        token,
        getKey(client),
        {
          issuer,
          audience: config.clientId,
          algorithms: ['RS256']
        },
        (err, decoded): void => {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              res.status(401).json({
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Token has expired'
                }
              });
              return;
            }
            
            if (err.name === 'JsonWebTokenError') {
              res.status(401).json({
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid token'
                }
              });
              return;
            }

            res.status(401).json({
              error: {
                code: 'UNAUTHORIZED',
                message: 'Token validation failed'
              }
            });
            return;
          }

          // Extract user information and attach to request
          req.user = extractUserInfo(decoded);
          next();
        }
      );
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication service error'
        }
      });
    }
  };
}

/**
 * Middleware to require specific role(s)
 * Must be used after authenticateToken middleware
 * 
 * @param roles - Single role or array of roles (user must have at least one)
 * @returns Express middleware function
 */
export function requireRole(roles: string | string[]) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasRole = requiredRoles.some(role => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${requiredRoles.join(' or ')}`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require all specified roles
 * Must be used after authenticateToken middleware
 * 
 * @param roles - Array of roles (user must have all of them)
 * @returns Express middleware function
 */
export function requireAllRoles(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasAllRoles = roles.every(role => req.user!.roles.includes(role));

    if (!hasAllRoles) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required roles: ${roles.join(', ')}`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present and valid, but doesn't require it
 * 
 * @returns Express middleware function
 */
export function optionalAuth() {
  const config = getKeycloakConfig();
  const client = createJwksClient(config.url, config.realm);
  const issuer = `${config.url}/realms/${config.realm}`;

  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        // No token provided, continue without user info
        next();
        return;
      }

      const parts = authHeader.split(' ');
      
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        // Invalid format, continue without user info
        next();
        return;
      }

      const token = parts[1];

      // Try to verify token, but don't fail if invalid
      jwt.verify(
        token,
        getKey(client),
        {
          issuer,
          audience: config.clientId,
          algorithms: ['RS256']
        },
        (err, decoded): void => {
          if (!err && decoded) {
            req.user = extractUserInfo(decoded);
          }
          next();
        }
      );
    } catch (error) {
      // Continue without user info on any error
      next();
    }
  };
}
