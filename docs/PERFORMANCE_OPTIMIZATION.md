# Performance Optimization Guide

This document describes the performance optimizations implemented in the ItsPlainSailing Organisation Admin system.

## Overview

The system has been optimized to meet the following performance targets:
- **Shell bundle size**: < 200KB (gzipped)
- **Module bundle sizes**: < 150KB each (gzipped)
- **API response time**: < 500ms
- **Initial page load**: < 3 seconds

## Bundle Size Optimizations

### 1. Code Splitting

The application uses aggressive code splitting to minimize initial bundle size:

- **Vendor chunks**: React, Material-UI, and utilities are split into separate chunks
- **Module chunks**: Each capability module (events, memberships, etc.) is a separate chunk
- **Lazy loading**: All modules are lazy-loaded using React.lazy() and Suspense

### 2. Tree Shaking

All modules are built with:
- `preserveModules: true` - Maintains module structure for better tree-shaking
- ES modules format only - Enables optimal tree-shaking
- External dependencies properly marked - Prevents bundling of shared libraries

### 3. Minification

Production builds use Terser with aggressive settings:
- `drop_console: true` - Removes all console.log statements
- `passes: 2` - Multiple compression passes
- `comments: false` - Removes all comments

### 4. Bundle Analysis

Use the following command to analyze bundle sizes:

```bash
npm run build:analyze --workspace=packages/orgadmin-shell
```

This generates a `dist/stats.html` file with visual bundle analysis.

## API Performance Optimizations

### 1. Database Indexes

Comprehensive indexes have been added for frequently queried fields:

- **Organization queries**: `organization_id`, `status`, `created_at`
- **Event queries**: `event_id`, `payment_status`, `entry_date`
- **Member queries**: `membership_type_id`, `status`, `valid_until`
- **JSONB indexes**: GIN indexes for `enabled_capabilities` and `capability_permissions`

See `packages/backend/migrations/1707000000015_add-performance-indexes.js` for details.

### 2. Caching

In-memory caching is implemented for frequently accessed data:

- **Organization data**: 5-minute TTL
- **Capability data**: 10-minute TTL (changes rarely)
- **Cache invalidation**: Automatic on updates and deletes

The cache service (`packages/backend/src/services/cache.service.ts`) provides:
- Automatic expiration
- Pattern-based deletion
- Periodic cleanup

### 3. Pagination

All list endpoints support pagination to limit data transfer:

```typescript
GET /api/events?page=1&limit=20
GET /api/members?page=1&limit=50
```

Default limits are set to reasonable values (20-50 items per page).

## Initial Load Time Optimizations

### 1. Resource Preloading

The `index.html` includes:
- **Preconnect**: To external font and API domains
- **DNS prefetch**: For API and Keycloak servers
- **Module preload**: For critical JavaScript modules
- **Font optimization**: Async font loading with fallback

### 2. Lazy Loading

All capability modules are lazy-loaded:
- Modules only load when accessed
- Suspense boundaries show loading indicators
- No blocking on initial render

### 3. Performance Monitoring

The application includes performance monitoring utilities:

```typescript
import { measurePageLoad, measureRender } from './utils/performance';

// Measure page load time
measurePageLoad();

// Measure component render time
const startTime = performance.now();
// ... render component
measureRender('ComponentName', startTime);
```

## Verification

### Bundle Size Verification

```bash
# Build the shell
npm run build --workspace=packages/orgadmin-shell

# Check bundle sizes
ls -lh packages/orgadmin-shell/dist/assets/js/

# Expected output:
# - vendor-react-*.js: ~40-50KB (gzipped)
# - vendor-mui-core-*.js: ~80-100KB (gzipped)
# - vendor-mui-icons-*.js: ~30-40KB (gzipped)
# - main-*.js: ~30-40KB (gzipped)
# Total initial load: ~180-230KB (gzipped)
```

### API Performance Verification

```bash
# Test API response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/organizations"

# Expected: < 500ms
```

Create `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_redirect:  %{time_redirect}\n
time_starttransfer:  %{time_starttransfer}\n
----------\n
time_total:  %{time_total}\n
```

### Initial Load Time Verification

1. Open Chrome DevTools
2. Go to Network tab
3. Enable "Disable cache"
4. Reload the page
5. Check the "Load" time in the bottom status bar
6. Expected: < 3 seconds

## Best Practices

### For Frontend Development

1. **Use lazy loading**: Always use `React.lazy()` for route components
2. **Avoid large dependencies**: Check bundle impact before adding new dependencies
3. **Optimize images**: Use WebP format and lazy loading for images
4. **Use debounce/throttle**: For expensive operations like search and filtering

### For Backend Development

1. **Use indexes**: Always add indexes for frequently queried fields
2. **Implement pagination**: Never return unbounded result sets
3. **Use caching**: Cache frequently accessed, rarely changing data
4. **Optimize queries**: Use EXPLAIN ANALYZE to identify slow queries

### For Database

1. **Regular maintenance**: Run VACUUM and ANALYZE periodically
2. **Monitor slow queries**: Enable slow query logging
3. **Index usage**: Monitor index usage with pg_stat_user_indexes
4. **Connection pooling**: Use connection pooling to reduce overhead

## Monitoring

### Production Monitoring

In production, monitor these metrics:

1. **Bundle sizes**: Track over time to detect regressions
2. **API response times**: Set up alerts for > 500ms responses
3. **Page load times**: Use Real User Monitoring (RUM)
4. **Database performance**: Monitor query times and index usage

### Tools

- **Lighthouse**: For page load performance audits
- **Chrome DevTools**: For bundle analysis and network timing
- **PostgreSQL pg_stat_statements**: For query performance analysis
- **Application Performance Monitoring (APM)**: For production monitoring

## Troubleshooting

### Slow Bundle Builds

If builds are slow:
1. Check for circular dependencies
2. Ensure proper external dependencies configuration
3. Use `vite build --debug` to identify bottlenecks

### Slow API Responses

If API responses are slow:
1. Check database query performance with EXPLAIN ANALYZE
2. Verify indexes are being used
3. Check cache hit rates
4. Monitor database connection pool usage

### Slow Page Loads

If page loads are slow:
1. Check bundle sizes with bundle analyzer
2. Verify lazy loading is working
3. Check network waterfall in DevTools
4. Verify CDN is serving static assets

## Future Optimizations

Potential future optimizations:

1. **Service Worker**: For offline support and faster repeat visits
2. **HTTP/2 Server Push**: For critical resources
3. **Image CDN**: For optimized image delivery
4. **Redis caching**: For distributed caching in multi-server deployments
5. **GraphQL**: For more efficient data fetching
6. **WebAssembly**: For compute-intensive operations
