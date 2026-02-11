# Local Development Environment - Status

## ✅ System is Running!

All Docker containers have been successfully started and are running.

## Services Status

| Service | Status | Port | URL | Location |
|---------|--------|------|-----|----------|
| **PostgreSQL** | ✅ Healthy | 5432 | localhost:5432 | Docker |
| **Keycloak** | ✅ Healthy | 8080 | http://localhost:8080 | Docker |
| **Backend API** | ✅ Healthy | 3000 | http://localhost:3000 | Docker |
| **Frontend** | ⚠️ Run Locally | 5173 | http://localhost:5173 | Host Machine |
| **Nginx** | ✅ Running | 80, 443 | http://localhost | Docker |
| **Prometheus** | ✅ Healthy | 9090 | http://localhost:9090 | Docker |
| **Grafana** | ✅ Healthy | 3001 | http://localhost:3001 | Docker |

**Note**: The frontend should be run locally on your host machine, not in Docker. See [FRONTEND_SETUP.md](FRONTEND_SETUP.md) for instructions.

## Access Information

### Frontend Application
- **URL**: http://localhost:5173
- **Description**: React development server with hot reload

### Backend API
- **URL**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

### Keycloak (Authentication)
- **URL**: http://localhost:8080
- **Admin Console**: http://localhost:8080/admin
- **Admin Username**: admin
- **Admin Password**: admin

### Grafana (Monitoring)
- **URL**: http://localhost:3001
- **Username**: admin
- **Password**: admin

### Prometheus (Metrics)
- **URL**: http://localhost:9090

### Nginx (Reverse Proxy)
- **URL**: http://localhost
- Routes API requests to backend
- Serves frontend static assets

### PostgreSQL Database
- **Host**: localhost
- **Port**: 5432
- **Database**: aws_framework
- **Username**: framework_user
- **Password**: framework_password

## Quick Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f keycloak
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild and Restart
```bash
docker-compose down
docker-compose up -d --build
```

### Check Status
```bash
docker-compose ps
```

## Next Steps

1. **Run the Frontend Locally**: 
   - See [FRONTEND_SETUP.md](FRONTEND_SETUP.md) for detailed instructions
   - Quick start: `npm run build:components && npm run dev:frontend`
   - Access at http://localhost:5173

2. **Configure Keycloak**:
   - Go to http://localhost:8080/admin
   - Login with admin/admin
   - Create a realm named "aws-framework"
   - Create a client named "aws-framework-client"

3. **Test the Backend API**:
   - Visit http://localhost:3000/api-docs for Swagger documentation
   - Test endpoints using the Swagger UI

4. **View Metrics**:
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (login: admin/admin)

5. **Run Database Migrations**:
   ```bash
   docker-compose exec backend npm run migrate:up
   ```

## Troubleshooting

### Container Not Starting
```bash
# Check logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Port Already in Use
If you get port conflicts, you can modify the ports in `docker-compose.yml`

### Database Connection Issues
```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Connect to database
docker-compose exec postgres psql -U framework_user -d aws_framework
```

### Clear Everything and Start Fresh
```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

## Development Workflow

1. **Code Changes**: Edit files in `packages/backend/src` or `packages/frontend/src`
2. **Hot Reload**: Both frontend and backend support hot reload
3. **View Logs**: Use `docker-compose logs -f` to see real-time logs
4. **Test Changes**: Access the services via the URLs above

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────► http://localhost:5173 (Frontend)
             │
             ├─────────────► http://localhost (Nginx)
             │                      │
             │                      ├──► Backend API
             │                      └──► Frontend Static
             │
             ├─────────────► http://localhost:8080 (Keycloak)
             │
             ├─────────────► http://localhost:3001 (Grafana)
             │
             └─────────────► http://localhost:9090 (Prometheus)

┌──────────────────────────────────────────────────────────────┐
│                    Docker Network                             │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Frontend │  │ Backend  │  │ Keycloak │  │ Postgres │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Nginx   │  │Prometheus│  │ Grafana  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

## System is Ready! 🎉

Your local development environment is now running and ready for development!
