import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  requireRole,
  requireAllRoles,
  optionalAuth,
  AuthenticatedRequest
} from '../auth.middleware';

// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getSigningKey: jest.fn((_kid: string, callback: any) => {
      // Return a mock signing key
      callback(null, {
        getPublicKey: () => 'mock-public-key'
      });
    })
  }))
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();

    // Set up environment variables
    process.env.KEYCLOAK_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_REALM = 'test-realm';
    process.env.KEYCLOAK_CLIENT_ID = 'test-client';
    // Ensure auth is not disabled for these tests
    delete process.env.DISABLE_AUTH;
    // Not set by default: most deployments reach Keycloak at the same address
    // the browser does. Left over from another test it would mask a regression.
    delete process.env.KEYCLOAK_ISSUER_URL;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /*
   * Behind a reverse proxy the address we use to reach Keycloak is not the
   * address Keycloak puts in the token. Getting this wrong is silent and total:
   * sign-in succeeds, then every single API call returns 401, which reads as a
   * broken application rather than a misconfigured one. It is what took the
   * whole of itsps.org down after the first deployment.
   */
  describe('which issuer a token must claim', () => {
    const verifyOptionsFor = async (): Promise<jwt.VerifyOptions> => {
      let options: jwt.VerifyOptions = {};
      (jwt.verify as jest.Mock).mockImplementation((_t, _k, opts, callback) => {
        options = opts;
        callback(null, { sub: 'user-1', preferred_username: 'someone' });
      });

      mockRequest.headers = { authorization: 'Bearer a.b.c' };
      await authenticateToken()(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );
      return options;
    };

    it('defaults to KEYCLOAK_URL when no separate issuer is configured', async () => {
      const options = await verifyOptionsFor();

      expect(options.issuer).toBe('http://localhost:8080/realms/test-realm');
    });

    it('uses KEYCLOAK_ISSUER_URL when Keycloak is reached through a proxy', async () => {
      // The shape of the single-instance deployment: internal address for us,
      // public address in the token.
      process.env.KEYCLOAK_URL = 'http://keycloak:8080/auth';
      process.env.KEYCLOAK_ISSUER_URL = 'https://itsps.org/auth';

      const options = await verifyOptionsFor();

      expect(options.issuer).toBe('https://itsps.org/auth/realms/test-realm');
      expect(options.issuer).not.toContain('keycloak:8080');
    });

    it('applies the same issuer to optionally-authenticated requests', async () => {
      process.env.KEYCLOAK_URL = 'http://keycloak:8080/auth';
      process.env.KEYCLOAK_ISSUER_URL = 'https://itsps.org/auth';

      let options: jwt.VerifyOptions = {};
      (jwt.verify as jest.Mock).mockImplementation((_t, _k, opts, callback) => {
        options = opts;
        callback(null, { sub: 'user-1' });
      });

      mockRequest.headers = { authorization: 'Bearer a.b.c' };
      await optionalAuth()(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(options.issuer).toBe('https://itsps.org/auth/realms/test-realm');
    });
  });

  describe('authenticateToken', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authorization header provided'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header format is invalid', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123'
      };

      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authorization header format. Expected: Bearer <token>'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-token'
      };

      // Mock jwt.verify to call callback with TokenExpiredError
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        callback(error, null);
      });

      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token has expired'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      // Mock jwt.verify to call callback with JsonWebTokenError
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        callback(error, null);
      });

      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should attach user info to request when token is valid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecodedToken = {
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        realm_access: {
          roles: ['user', 'admin']
        },
        groups: ['developers']
      };

      // Mock jwt.verify to call callback with decoded token
      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, mockDecodedToken);
      });

      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: ['user', 'admin'],
        groups: ['developers'],
        firstName: '',
        lastName: '',
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    /*
     * The name is what a member registering with a second club is identified
     * by. Read from the token rather than the request body, which is what a
     * "connect to this club" button — a single button, sending nothing — can
     * actually supply.
     */
    it('takes the name from the token’s profile claims', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockImplementation((_t, _k, _o, callback) => {
        callback(null, {
          sub: 'user-123',
          email: 'darragh.otoole@example.test',
          given_name: 'Darragh',
          family_name: "O'Toole",
          name: "Darragh O'Toole",
        });
      });

      await authenticateToken()(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toMatchObject({
        firstName: 'Darragh',
        lastName: "O'Toole",
      });
    });

    it('falls back to splitting the full name when only that is released', async () => {
      // A realm configured without given_name/family_name would otherwise leave
      // the platform unable to name somebody it can perfectly well identify.
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockImplementation((_t, _k, _o, callback) => {
        callback(null, { sub: 'user-123', email: 'm@example.test', name: 'Máire Ní Fhloinn' });
      });

      await authenticateToken()(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      // Everything after the first space is the surname, so a two-word surname
      // survives intact.
      expect(mockRequest.user).toMatchObject({
        firstName: 'Máire',
        lastName: 'Ní Fhloinn',
      });
    });

    it('leaves the name empty when the token carries none', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockImplementation((_t, _k, _o, callback) => {
        callback(null, { sub: 'user-123', email: 'm@example.test' });
      });

      await authenticateToken()(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      // Empty rather than undefined, so callers cope with absence explicitly.
      expect(mockRequest.user).toMatchObject({ firstName: '', lastName: '' });
    });

    it('should handle token without realm_access', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecodedToken = {
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser'
      };

      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, mockDecodedToken);
      });

      const middleware = authenticateToken();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: [],
        groups: [],
        firstName: '',
        lastName: '',
      });
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: ['user'],
        groups: [],
        firstName: '',
        lastName: '',
      };
    });

    it('should return 401 when user is not authenticated', () => {
      delete mockRequest.user;

      const middleware = requireRole('user');
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      const middleware = requireRole('admin');
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Required role: admin'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next when user has required role', () => {
      const middleware = requireRole('user');
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should accept array of roles and pass if user has any', () => {
      const middleware = requireRole(['admin', 'user']);
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user has none of the required roles', () => {
      const middleware = requireRole(['admin', 'superuser']);
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Required role: admin or superuser'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireAllRoles', () => {
    beforeEach(() => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: ['user', 'editor'],
        groups: [],
        firstName: '',
        lastName: '',
      };
    });

    it('should return 401 when user is not authenticated', () => {
      delete mockRequest.user;

      const middleware = requireAllRoles(['user', 'editor']);
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have all required roles', () => {
      const middleware = requireAllRoles(['user', 'admin']);
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Required roles: user, admin'
        }
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next when user has all required roles', () => {
      const middleware = requireAllRoles(['user', 'editor']);
      
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next without user when no authorization header', async () => {
      const middleware = optionalAuth();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next without user when authorization header is invalid', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123'
      };

      const middleware = optionalAuth();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should attach user info when token is valid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecodedToken = {
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        realm_access: {
          roles: ['user']
        },
        groups: []
      };

      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        callback(null, mockDecodedToken);
      });

      const middleware = optionalAuth();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        roles: ['user'],
        groups: [],
        firstName: '',
        lastName: '',
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next without user when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      (jwt.verify as jest.Mock).mockImplementation((_token, _getKey, _options, callback) => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        callback(error, null);
      });

      const middleware = optionalAuth();
      
      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.user).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Environment Configuration', () => {
    it('should throw error when KEYCLOAK_URL is missing', () => {
      delete process.env.KEYCLOAK_URL;

      expect(() => {
        authenticateToken();
      }).toThrow('Keycloak configuration is incomplete');
    });

    it('should throw error when KEYCLOAK_REALM is missing', () => {
      delete process.env.KEYCLOAK_REALM;

      expect(() => {
        authenticateToken();
      }).toThrow('Keycloak configuration is incomplete');
    });

    it('should throw error when KEYCLOAK_CLIENT_ID is missing', () => {
      delete process.env.KEYCLOAK_CLIENT_ID;

      expect(() => {
        authenticateToken();
      }).toThrow('Keycloak configuration is incomplete');
    });
  });
});
