import { swaggerSpec } from '../config/swagger';

describe('Swagger Documentation', () => {
  it('should have valid OpenAPI specification', () => {
    expect(swaggerSpec).toBeDefined();
    expect((swaggerSpec as any).openapi).toBe('3.0.0');
    expect((swaggerSpec as any).info).toBeDefined();
    expect((swaggerSpec as any).info.title).toBe('AWS Web Application Framework API');
    expect((swaggerSpec as any).info.version).toBe('1.0.0');
  });

  it('should define security schemes', () => {
    const spec = swaggerSpec as any;
    expect(spec.components).toBeDefined();
    expect(spec.components.securitySchemes).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('should define all required schemas', () => {
    const spec = swaggerSpec as any;
    const schemas = spec.components.schemas;
    expect(schemas).toBeDefined();
    
    // Check metadata schemas
    expect(schemas.FieldDefinition).toBeDefined();
    expect(schemas.ObjectDefinition).toBeDefined();
    expect(schemas.FieldDatatype).toBeDefined();
    expect(schemas.ValidationType).toBeDefined();
    expect(schemas.ValidationRule).toBeDefined();
    
    // Check response schemas
    expect(schemas.ErrorResponse).toBeDefined();
    expect(schemas.ListResponse).toBeDefined();
    expect(schemas.FieldError).toBeDefined();
  });

  it('should define server URLs', () => {
    const spec = swaggerSpec as any;
    expect(spec.servers).toBeDefined();
    expect(spec.servers.length).toBeGreaterThan(0);
    
    const localServer = spec.servers.find((s: any) => s.url.includes('localhost'));
    expect(localServer).toBeDefined();
  });

  it('should have paths defined from route annotations', () => {
    const spec = swaggerSpec as any;
    expect(spec.paths).toBeDefined();
    
    // The paths should be populated from JSDoc comments in route files
    // This verifies that swagger-jsdoc is correctly parsing the route files
    const pathKeys = Object.keys(spec.paths);
    expect(pathKeys.length).toBeGreaterThan(0);
  });
});
