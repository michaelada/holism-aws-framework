# Frontend Setup Guide

## Issue with Docker

The frontend cannot run properly in Docker because it's part of a monorepo and needs access to the `@aws-web-framework/components` package. Running it in Docker would require complex multi-stage builds or copying the entire monorepo.

## Recommended Approach: Run Frontend Locally

The best approach for local development is to run the frontend directly on your host machine while keeping the backend services in Docker.

### Prerequisites

1. Node.js 18+ installed
2. npm installed
3. Docker services running (backend, database, etc.)

### Steps to Run Frontend Locally

#### 1. Ensure Docker Services are Running

```bash
docker-compose ps
```

You should see these services running:
- aws-framework-postgres
- aws-framework-keycloak
- aws-framework-backend
- aws-framework-nginx
- aws-framework-prometheus
- aws-framework-grafana

If not running:
```bash
docker-compose up -d
```

#### 2. Install Dependencies (if not already done)

```bash
npm install
```

#### 3. Build the Components Package

The frontend depends on the components package, so it needs to be built first:

```bash
npm run build:components
```

**Note**: If you encounter TypeScript errors during build, you have two options:

**Option A**: Fix the TypeScript errors (recommended for production)
- Fix unused imports
- Fix type errors in VirtualizedMetadataTable.tsx

**Option B**: Skip type checking temporarily (for quick testing)
- Modify `packages/components/package.json` build script to skip tsc:
  ```json
  "build": "vite build"
  ```

#### 4. Start the Frontend Development Server

```bash
npm run dev:frontend
```

Or directly:
```bash
cd packages/frontend
npm run dev
```

The frontend will start on **http://localhost:5173**

### Environment Variables

The frontend needs these environment variables (already configured in `packages/frontend/.env`):

```env
VITE_API_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-client
VITE_DISABLE_AUTH=true  # Set to 'true' to disable authentication for development
```

#### Development Mode Without Authentication

For local development without setting up Keycloak, you can disable authentication by setting `VITE_DISABLE_AUTH=true` in `packages/frontend/.env`. This allows you to develop and test the UI without authentication. The app will run with a mock user ('dev-user').

**Note**: Remember to set `VITE_DISABLE_AUTH=false` when testing with real authentication.

### Accessing the Application

Once the frontend is running:

1. **Frontend**: http://localhost:5173
2. **Backend API**: http://localhost:3000
3. **API Docs**: http://localhost:3000/api-docs
4. **Keycloak**: http://localhost:8080

### Development Workflow

1. **Backend changes**: Edit files in `packages/backend/src` - hot reload is enabled in Docker
2. **Frontend changes**: Edit files in `packages/frontend/src` - Vite hot reload works automatically
3. **Components changes**: Edit files in `packages/components/src` - rebuild with `npm run build:components`

### Troubleshooting

#### Frontend won't start - "Cannot find module '@aws-web-framework/components'"

**Solution**: Build the components package first:
```bash
npm run build:components
```

#### TypeScript errors during components build

**Temporary Solution**: Skip TypeScript checking:
1. Edit `packages/components/package.json`
2. Change build script from `"build": "tsc && vite build"` to `"build": "vite build"`
3. Run `npm run build:components` again

**Proper Solution**: Fix the TypeScript errors:
- Remove unused React imports (they're not needed in React 17+)
- Fix the `FixedSizeList` import from react-window
- Remove unused variable declarations

#### Port 5173 already in use

**Solution**: Kill the process using that port:
```bash
# Find the process
lsof -ti:5173

# Kill it
kill -9 $(lsof -ti:5173)
```

Or change the port in `packages/frontend/vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 5174  // Change to different port
  }
})
```

#### Cannot connect to backend

**Solution**: Ensure Docker services are running:
```bash
docker-compose ps
docker-compose logs backend
```

Check backend health:
```bash
curl http://localhost:3000/health
```

### Alternative: Run Everything Locally (No Docker)

If you prefer to run everything locally without Docker:

1. **Install PostgreSQL** locally
2. **Install Keycloak** locally
3. **Update environment variables** to point to localhost services
4. **Run backend**: `npm run dev:backend`
5. **Run frontend**: `npm run dev:frontend`

This approach gives you more control but requires more setup.

### Why Not Docker for Frontend?

Docker is great for backend services, but for frontend development:

**Cons of Docker**:
- Slower hot reload
- Complex monorepo setup
- Need to rebuild on every change
- Harder to debug

**Pros of Local**:
- Instant hot reload
- Easy debugging
- Direct access to node_modules
- Better IDE integration

For production deployment, the frontend is built and served through Nginx (which runs in Docker), so this only affects local development.

## Summary

**Current Setup**:
- ✅ Backend, Database, Keycloak, Monitoring: Running in Docker
- ✅ Frontend: Run locally on host machine

This hybrid approach gives you the best of both worlds:
- Isolated backend services in Docker
- Fast frontend development on your host machine
