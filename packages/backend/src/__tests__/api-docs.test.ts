import request from 'supertest';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

describe('API Documentation Endpoint', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'AWS Web Framework API Documentation'
    }));
  });

  it('should serve Swagger UI at /api-docs', async () => {
    const response = await request(app).get('/api-docs/');
    
    // Swagger UI returns HTML
    expect(response.status).toBe(200);
    expect(response.type).toMatch(/html/);
    expect(response.text).toContain('swagger-ui');
  });

  it('should have OpenAPI spec accessible', () => {
    const spec = swaggerSpec as any;
    
    // Verify key endpoints are documented
    expect(spec.paths).toBeDefined();
    
    // Check for metadata endpoints
    expect(spec.paths['/api/metadata/fields']).toBeDefined();
    expect(spec.paths['/api/metadata/objects']).toBeDefined();
    
    // Check for generic CRUD endpoints
    expect(spec.paths['/api/objects/{objectType}/instances']).toBeDefined();
    expect(spec.paths['/api/objects/{objectType}/instances/{id}']).toBeDefined();
    
    // Check for health endpoint
    expect(spec.paths['/health']).toBeDefined();
  });

  it('should document authentication requirements', () => {
    const spec = swaggerSpec as any;
    
    // Check that security is defined globally
    expect(spec.security).toBeDefined();
    expect(spec.security[0].bearerAuth).toBeDefined();
    
    // Check that bearerAuth is defined in security schemes
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('should document all HTTP methods for metadata fields', () => {
    const spec = swaggerSpec as any;
    const fieldsPath = spec.paths['/api/metadata/fields'];
    
    expect(fieldsPath).toBeDefined();
    expect(fieldsPath.get).toBeDefined();
    expect(fieldsPath.post).toBeDefined();
  });

  it('should document all HTTP methods for metadata objects', () => {
    const spec = swaggerSpec as any;
    const objectsPath = spec.paths['/api/metadata/objects'];
    
    expect(objectsPath).toBeDefined();
    expect(objectsPath.get).toBeDefined();
    expect(objectsPath.post).toBeDefined();
  });

  it('should document request/response schemas', () => {
    const spec = swaggerSpec as any;
    const postFieldPath = spec.paths['/api/metadata/fields'].post;
    
    // Check request body schema
    expect(postFieldPath.requestBody).toBeDefined();
    expect(postFieldPath.requestBody.content['application/json'].schema).toBeDefined();
    
    // Check response schemas
    expect(postFieldPath.responses['201']).toBeDefined();
    expect(postFieldPath.responses['400']).toBeDefined();
    expect(postFieldPath.responses['401']).toBeDefined();
    expect(postFieldPath.responses['403']).toBeDefined();
  });
});
