# Monitoring and Observability Setup

This document provides a quick reference for the monitoring and observability features implemented in the AWS Web Application Framework.

## Quick Start

### Starting the Monitoring Stack

```bash
# Start all services including Prometheus and Grafana
docker-compose up -d

# View logs
docker-compose logs -f prometheus grafana
```

### Accessing the Monitoring Tools

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Metrics Endpoint**: http://localhost:3000/metrics

## What's Included

### 1. Prometheus Metrics Collection

The backend service automatically exposes metrics at `/metrics` endpoint. Prometheus scrapes these metrics every 10 seconds.

**Metrics Categories:**
- HTTP request metrics (rate, duration, errors)
- Database query metrics (duration, errors, connection pool)
- Business logic metrics (metadata operations, CRUD operations)
- Authentication metrics (attempts, validations)
- System metrics (CPU, memory, Node.js internals)

### 2. Grafana Dashboards

Three pre-configured dashboards are automatically provisioned:

1. **Application Health** - Overall system health and performance
2. **Error Rates** - HTTP errors, database errors, validation errors
3. **Business Metrics** - Metadata operations, instance operations, auth attempts

### 3. Alerting Rules

Prometheus includes alerting rules for:
- High error rates (>5% for 5 minutes)
- High response times (>2s p95 for 5 minutes)
- Database connection pool exhaustion
- Service downtime
- Authentication failures

## Key Metrics

### HTTP Metrics

```promql
# Request rate
rate(aws_framework_http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(aws_framework_http_request_duration_seconds_bucket[5m]))

# Error rate
sum(rate(aws_framework_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(aws_framework_http_requests_total[5m]))
```

### Database Metrics

```promql
# Query rate
rate(aws_framework_db_queries_total[5m])

# Connection pool utilization
aws_framework_db_connection_pool_size{state="total"} - aws_framework_db_connection_pool_size{state="idle"}

# Slow queries (>1s)
histogram_quantile(0.95, rate(aws_framework_db_query_duration_seconds_bucket[5m])) > 1
```

### Business Metrics

```promql
# Metadata operations
rate(aws_framework_metadata_operations_total[5m])

# Instance CRUD operations
rate(aws_framework_instance_operations_total[5m])

# Validation errors
rate(aws_framework_validation_errors_total[5m])
```

## Architecture

```
┌─────────────┐
│   Backend   │ ──── Exposes /metrics endpoint
│   Service   │
└─────────────┘
       │
       │ Scrapes every 10s
       ▼
┌─────────────┐
│ Prometheus  │ ──── Stores time-series data
│             │ ──── Evaluates alerting rules
└─────────────┘
       │
       │ Queries
       ▼
┌─────────────┐
│   Grafana   │ ──── Visualizes metrics
│             │ ──── Displays dashboards
└─────────────┘
```

## Customization

### Adding Custom Metrics

1. Define the metric in `packages/backend/src/config/metrics.ts`
2. Use the metric in your code
3. The metric will automatically appear in Prometheus

Example:

```typescript
// In config/metrics.ts
export const myCustomCounter = new Counter({
  name: 'aws_framework_my_metric_total',
  help: 'Description of my metric',
  labelNames: ['label1'],
  registers: [register],
});

// In your code
import { myCustomCounter } from '../config/metrics';
myCustomCounter.inc({ label1: 'value' });
```

### Creating Custom Dashboards

1. Create a new JSON file in `infrastructure/grafana/provisioning/dashboards/json/`
2. Restart Grafana: `docker-compose restart grafana`
3. The dashboard will be automatically provisioned

### Adding Alert Rules

1. Edit `infrastructure/prometheus/alerts/application-alerts.yml`
2. Restart Prometheus: `docker-compose restart prometheus`
3. View alerts at http://localhost:9090/alerts

## Troubleshooting

### Metrics not showing up

```bash
# Check if backend is exposing metrics
curl http://localhost:3000/metrics

# Check Prometheus targets
# Visit: http://localhost:9090/targets

# Check Prometheus logs
docker-compose logs prometheus
```

### Grafana dashboards not loading

```bash
# Check Grafana logs
docker-compose logs grafana

# Verify datasource
# Visit: http://localhost:3001/datasources

# Check dashboard provisioning
docker-compose exec grafana ls -la /etc/grafana/provisioning/dashboards/json/
```

## Production Considerations

For production deployments:

1. **Configure Alertmanager** for notifications (Slack, email, PagerDuty)
2. **Set up persistent storage** for Prometheus data
3. **Enable authentication** for Grafana (change default password)
4. **Configure retention policies** based on storage capacity
5. **Set up remote write** for long-term storage (Thanos, Cortex, etc.)
6. **Implement metric cardinality limits** to prevent memory issues
7. **Regular backup** of Grafana dashboards and Prometheus data

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client Library](https://github.com/siimon/prom-client)
- [Detailed Monitoring Guide](infrastructure/monitoring/README.md)
