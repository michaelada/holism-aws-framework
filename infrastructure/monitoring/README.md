# Monitoring and Observability

This document describes the monitoring and observability setup for the AWS Web Application Framework.

## Overview

The framework includes comprehensive monitoring using Prometheus for metrics collection and Grafana for visualization. All metrics are automatically collected and exposed by the backend service.

## Components

### Prometheus

Prometheus is configured to scrape metrics from the backend service every 10 seconds. The configuration includes:

- **Metrics endpoint**: `http://backend:3000/metrics`
- **Scrape interval**: 10 seconds
- **Alerting rules**: Defined in `infrastructure/prometheus/alerts/`

#### Accessing Prometheus

- **Local development**: http://localhost:9090
- **Query interface**: Available at the root URL
- **Alerts**: http://localhost:9090/alerts

### Grafana

Grafana provides pre-configured dashboards for monitoring application health, error rates, and business metrics.

#### Accessing Grafana

- **Local development**: http://localhost:3001
- **Default credentials**: 
  - Username: `admin`
  - Password: `admin`

#### Pre-configured Dashboards

1. **Application Health** (`aws-framework-health`)
   - Active connections
   - Database connection pool metrics
   - Request rates
   - Response times (p95, p99)
   - Database query performance

2. **Error Rates** (`aws-framework-errors`)
   - HTTP error rates (4xx, 5xx)
   - HTTP errors by type
   - Database query errors
   - Validation errors
   - Authentication failures

3. **Business Metrics** (`aws-framework-business`)
   - Metadata operations rate
   - Instance CRUD operations rate
   - Dynamic table operations rate
   - Authentication attempts

## Metrics Collected

### HTTP Metrics

- `aws_framework_http_request_duration_seconds` - Request duration histogram
- `aws_framework_http_requests_total` - Total HTTP requests counter
- `aws_framework_http_request_errors_total` - HTTP errors counter
- `aws_framework_active_connections` - Active connections gauge

### Database Metrics

- `aws_framework_db_query_duration_seconds` - Query duration histogram
- `aws_framework_db_queries_total` - Total queries counter
- `aws_framework_db_connection_pool_size` - Connection pool size gauge
- `aws_framework_db_query_errors_total` - Query errors counter

### Business Logic Metrics

- `aws_framework_metadata_operations_total` - Metadata operations counter
- `aws_framework_instance_operations_total` - Instance CRUD operations counter
- `aws_framework_validation_errors_total` - Validation errors counter
- `aws_framework_dynamic_table_operations_total` - Dynamic table operations counter

### Authentication Metrics

- `aws_framework_auth_attempts_total` - Authentication attempts counter
- `aws_framework_auth_token_validations_total` - Token validations counter

## Alerting Rules

The following alerts are configured in Prometheus:

### Critical Alerts

- **HighErrorRate**: Triggers when 5xx error rate exceeds 5% for 5 minutes
- **HighDatabaseErrorRate**: Triggers when database errors exceed 1/second for 5 minutes
- **ServiceDown**: Triggers when backend service is unreachable for 1 minute

### Warning Alerts

- **HighResponseTime**: Triggers when p95 response time exceeds 2 seconds for 5 minutes
- **DatabasePoolExhaustion**: Triggers when idle connections drop below 2 for 2 minutes
- **SlowDatabaseQueries**: Triggers when p95 query time exceeds 1 second for 5 minutes
- **HighAuthFailureRate**: Triggers when auth failures exceed 5/second for 5 minutes

### Info Alerts

- **HighValidationErrorRate**: Triggers when validation errors exceed 10/second for 5 minutes

## Adding Custom Metrics

To add custom metrics to your application:

1. Import the metrics from `config/metrics.ts`:

```typescript
import { myCustomCounter } from '../config/metrics';
```

2. Define your metric in `config/metrics.ts`:

```typescript
export const myCustomCounter = new Counter({
  name: 'aws_framework_my_custom_metric_total',
  help: 'Description of my custom metric',
  labelNames: ['label1', 'label2'],
  registers: [register],
});
```

3. Increment the metric in your code:

```typescript
myCustomCounter.inc({ label1: 'value1', label2: 'value2' });
```

## Querying Metrics

### Example Prometheus Queries

**Request rate by endpoint:**
```promql
rate(aws_framework_http_requests_total[5m])
```

**95th percentile response time:**
```promql
histogram_quantile(0.95, rate(aws_framework_http_request_duration_seconds_bucket[5m]))
```

**Error rate percentage:**
```promql
sum(rate(aws_framework_http_requests_total{status_code=~"5.."}[5m])) 
/ 
sum(rate(aws_framework_http_requests_total[5m]))
```

**Database connection pool utilization:**
```promql
aws_framework_db_connection_pool_size{state="total"} - aws_framework_db_connection_pool_size{state="idle"}
```

## Production Deployment

For production deployments:

1. **Configure Alertmanager** to send notifications (email, Slack, PagerDuty)
2. **Set up persistent storage** for Prometheus data
3. **Configure retention policies** based on your requirements
4. **Enable authentication** for Grafana
5. **Set up backup** for Grafana dashboards and Prometheus data
6. **Configure remote write** for long-term storage (e.g., Thanos, Cortex)

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check that the backend service is running: `docker ps`
2. Verify the metrics endpoint is accessible: `curl http://localhost:3000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets
4. Review Prometheus logs: `docker logs aws-framework-prometheus`

### Grafana dashboards not loading

1. Check Grafana logs: `docker logs aws-framework-grafana`
2. Verify datasource configuration: Grafana > Configuration > Data Sources
3. Ensure dashboard provisioning directory is mounted correctly
4. Check file permissions on dashboard JSON files

### High memory usage

1. Adjust Prometheus retention period in `prometheus.yml`
2. Reduce scrape frequency for non-critical metrics
3. Use recording rules for frequently queried metrics
4. Consider implementing metric cardinality limits

## Best Practices

1. **Use labels wisely**: Avoid high-cardinality labels (e.g., user IDs, timestamps)
2. **Set appropriate buckets**: Configure histogram buckets based on expected values
3. **Monitor the monitors**: Set up alerts for Prometheus and Grafana health
4. **Regular review**: Periodically review and optimize queries and dashboards
5. **Document custom metrics**: Maintain documentation for all custom metrics
6. **Test alerts**: Regularly test alerting rules to ensure they work as expected
