import request from 'supertest';
import { app } from '../index';
import { register } from '../config/metrics';

describe('Metrics Endpoint', () => {
  describe('GET /metrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should include default Node.js metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      // Check for some default metrics
      expect(response.text).toContain('aws_framework_nodejs_');
      expect(response.text).toContain('process_cpu_');
      expect(response.text).toContain('nodejs_heap_');
    });

    it('should include custom HTTP metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('aws_framework_http_request_duration_seconds');
      expect(response.text).toContain('aws_framework_http_requests_total');
      expect(response.text).toContain('aws_framework_active_connections');
    });

    it('should include custom database metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('aws_framework_db_query_duration_seconds');
      expect(response.text).toContain('aws_framework_db_queries_total');
      expect(response.text).toContain('aws_framework_db_connection_pool_size');
    });

    it('should include business logic metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('aws_framework_metadata_operations_total');
      expect(response.text).toContain('aws_framework_instance_operations_total');
      expect(response.text).toContain('aws_framework_validation_errors_total');
    });
  });

  describe('Metrics Registry', () => {
    it('should have metrics registered', async () => {
      const metrics = await register.getMetricsAsJSON();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include all custom metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      const metricNames = metrics.map((m: any) => m.name);
      
      // HTTP metrics
      expect(metricNames).toContain('aws_framework_http_request_duration_seconds');
      expect(metricNames).toContain('aws_framework_http_requests_total');
      expect(metricNames).toContain('aws_framework_http_request_errors_total');
      expect(metricNames).toContain('aws_framework_active_connections');
      
      // Database metrics
      expect(metricNames).toContain('aws_framework_db_query_duration_seconds');
      expect(metricNames).toContain('aws_framework_db_queries_total');
      expect(metricNames).toContain('aws_framework_db_connection_pool_size');
      expect(metricNames).toContain('aws_framework_db_query_errors_total');
      
      // Business metrics
      expect(metricNames).toContain('aws_framework_metadata_operations_total');
      expect(metricNames).toContain('aws_framework_instance_operations_total');
      expect(metricNames).toContain('aws_framework_validation_errors_total');
      expect(metricNames).toContain('aws_framework_dynamic_table_operations_total');
      
      // Auth metrics
      expect(metricNames).toContain('aws_framework_auth_attempts_total');
      expect(metricNames).toContain('aws_framework_auth_token_validations_total');
    });
  });
});
