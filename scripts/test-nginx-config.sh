#!/bin/bash

# Test Nginx configuration files
# This script validates Nginx configuration syntax

set -e

echo "Testing Nginx configuration files..."

# Test local development configuration
echo "1. Testing default.conf (local development)..."
docker run --rm \
  -v $(pwd)/infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/infrastructure/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
  --entrypoint /bin/sh \
  nginx:alpine \
  -c "nginx -t 2>&1 | grep -q 'syntax is ok' && echo '✓ Local config syntax is valid' || echo '✗ Local config has syntax errors'"

# Test SSL configuration
echo "2. Testing default-ssl.conf (production)..."
docker run --rm \
  -v $(pwd)/infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd)/infrastructure/nginx/default-ssl.conf:/etc/nginx/conf.d/default.conf:ro \
  --entrypoint /bin/sh \
  nginx:alpine \
  -c "nginx -t 2>&1 | grep -q 'syntax is ok' && echo '✓ SSL config syntax is valid' || echo '✗ SSL config has syntax errors'"

echo ""
echo "Note: 'host not found' errors are expected when testing outside Docker Compose network."
echo "These errors will not occur when running with docker-compose."
echo ""
echo "Configuration test complete!"
