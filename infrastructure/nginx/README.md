# Nginx Reverse Proxy Configuration

This directory contains Nginx configuration files for the AWS Web Application Framework.

## Configuration Files

### `nginx.conf`
Main Nginx configuration file that defines global settings:
- Worker processes and connections
- Logging configuration
- Gzip compression
- MIME types

### `default.conf`
HTTP-only configuration for local development:
- Rate limiting for API and authentication endpoints
- Proxy configuration for backend API
- Proxy configuration for Keycloak authentication
- Static file serving for frontend
- Health check endpoint

### `default-ssl.conf`
HTTPS configuration for staging and production environments:
- SSL/TLS termination with modern cipher suites
- HTTP to HTTPS redirect
- Enhanced security headers (HSTS, CSP, etc.)
- Same proxy and rate limiting as default.conf

## Local Development

For local development, the `default.conf` file is used. This configuration:
- Listens on port 80 (HTTP only)
- Proxies API requests to `host.docker.internal:3000` (backend service)
- Proxies auth requests to `keycloak:8080` (Keycloak service)
- Serves frontend static files from `/usr/share/nginx/html`

### Starting Nginx Locally

```bash
docker-compose up nginx
```

The Nginx service will be available at `http://localhost`.

## Deployed Environments (Staging/Production)

For deployed environments, use the `default-ssl.conf` file. This configuration:
- Listens on port 443 (HTTPS)
- Redirects HTTP (port 80) to HTTPS
- Requires SSL certificates at `/etc/nginx/ssl/cert.pem` and `/etc/nginx/ssl/key.pem`
- Includes enhanced security headers

### SSL Certificate Setup

For staging and production, you need to provide SSL certificates. You can:

1. **Use AWS Certificate Manager (ACM)** with Application Load Balancer
2. **Use Let's Encrypt** with certbot
3. **Use your organization's certificates**

#### Example: Using Let's Encrypt

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --nginx -d yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Docker Volume Mount for SSL

Update your docker-compose or deployment configuration to mount certificates:

```yaml
volumes:
  - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/ssl/cert.pem:ro
  - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/ssl/key.pem:ro
  - ./infrastructure/nginx/default-ssl.conf:/etc/nginx/conf.d/default.conf:ro
```

## Rate Limiting

The configuration implements three rate limiting zones:

1. **API Limit**: 10 requests/second with burst of 20
   - Applied to `/api/*` endpoints
   - Protects backend from overload

2. **Auth Limit**: 5 requests/second with burst of 10
   - Applied to `/auth/*` endpoints
   - Prevents brute force attacks

3. **General Limit**: 100 requests/second with burst of 200
   - Applied to frontend static files
   - Prevents abuse while allowing normal usage

When rate limits are exceeded, Nginx returns a 429 (Too Many Requests) response.

## Proxy Configuration

### Backend API Proxy

- **Upstream**: `backend:3000` (production) or `host.docker.internal:3000` (local)
- **Path**: `/api/*`
- **Timeouts**: 60 seconds for connect, send, and read
- **Headers**: Forwards real IP, protocol, and host information

### Keycloak Auth Proxy

- **Upstream**: `keycloak:8080`
- **Path**: `/auth/*`
- **Timeouts**: 30 seconds for connect, send, and read
- **Headers**: Forwards real IP, protocol, and host information

## Static File Serving

Frontend static files are served from `/usr/share/nginx/html` with:

- **HTML files**: No caching (always fetch latest)
- **Static assets** (JS, CSS, images, fonts): 1 year cache with immutable flag
- **SPA routing**: All routes fall back to `index.html` for client-side routing

## Security Headers

The configuration includes security headers:

- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables XSS filter
- **Referrer-Policy**: Controls referrer information
- **Strict-Transport-Security** (HTTPS only): Enforces HTTPS
- **Content-Security-Policy** (HTTPS only): Restricts resource loading

## Health Check

A health check endpoint is available at `/health`:

```bash
curl http://localhost/health
# Returns: healthy
```

This endpoint:
- Returns 200 OK with "healthy" text
- Has no rate limiting
- Has no access logging
- Can be used by load balancers and monitoring systems

## Monitoring

Nginx access and error logs are available at:
- Access log: `/var/log/nginx/access.log`
- Error log: `/var/log/nginx/error.log`

These logs can be forwarded to your monitoring system (Prometheus, CloudWatch, etc.).

## Troubleshooting

### Backend Connection Refused

If you see "connection refused" errors for the backend:

1. Check that the backend service is running
2. Verify the upstream address in the configuration
3. For local development, ensure `host.docker.internal` resolves correctly

### SSL Certificate Errors

If you see SSL certificate errors:

1. Verify certificates exist at `/etc/nginx/ssl/cert.pem` and `/etc/nginx/ssl/key.pem`
2. Check certificate permissions (should be readable by nginx user)
3. Verify certificate validity: `openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout`

### Rate Limiting Issues

If legitimate traffic is being rate limited:

1. Adjust rate limits in the configuration
2. Increase burst values
3. Consider using `limit_req_zone` with `$http_x_forwarded_for` if behind a load balancer

## Configuration Testing

Before deploying configuration changes, test them:

```bash
# Test configuration syntax
docker-compose exec nginx nginx -t

# Reload configuration without downtime
docker-compose exec nginx nginx -s reload
```
