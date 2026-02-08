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
  });

  afterEach(() => {
    jest.clearAllMocks();
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
        groups: ['developers']
      });
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
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
        groups: []
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
        groups: []
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
        groups: []
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
        groups: []
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
