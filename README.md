# AWS Web Application Framework

A comprehensive base framework for deploying web applications to AWS with a Metadata Repository System that enables generic CRUD operations and UI components based on object definitions.

## Project Structure

```
aws-web-app-framework/
├── packages/
│   ├── backend/          # Node.js/TypeScript backend service
│   ├── frontend/         # React/TypeScript frontend application
│   └── components/       # React component library
├── infrastructure/       # Docker, Nginx, Prometheus, Grafana configs
├── terraform/           # Infrastructure as Code (to be implemented)
└── .github/             # CI/CD workflows (to be implemented)
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker and Docker Compose

## Getting Started

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Start Local Development Environment

```bash
# Start all services (PostgreSQL, Keycloak, Nginx, Prometheus, Grafana)
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

### 3. Access Services

- **Application (via Nginx)**: http://localhost
  - Frontend: http://localhost/
  - Backend API: http://localhost/api
  - Keycloak: http://localhost/auth
- **Direct Service Access**:
  - Frontend Dev Server: http://localhost:5173 (Vite)
  - Backend API: http://localhost:3000
  - Keycloak Admin: http://localhost:8080 (admin/admin)
  - Prometheus: http://localhost:9090
  - Grafana: http://localhost:3001 (admin/admin)
  - PostgreSQL: localhost:5432 (framework_user/framework_password)

## Development

### Backend Development

```bash
npm run dev:backend
```

### Frontend Development

```bash
npm run dev:frontend
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run component library tests
npm run test:components
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Format code
npm run format
```

## Building for Production

```bash
# Build all packages
npm run build:all

# Build individual packages
npm run build:backend
npm run build:frontend
npm run build:components
```

## Architecture

The framework follows a three-tier architecture:

- **Presentation Layer**: React/TypeScript frontend with Material-UI components
- **Application Layer**: Node.js/TypeScript REST API service
- **Data Layer**: PostgreSQL database with metadata-driven schema generation

## Key Features

- **Metadata-Driven Development**: Define entities through metadata, automatically generating REST APIs and UI components
- **Infrastructure as Code**: All AWS resources defined in Terraform
- **Environment Parity**: Local development mirrors production using Docker
- **Type Safety**: TypeScript throughout the stack
- **Observability**: Built-in logging, metrics, and monitoring with Prometheus and Grafana
- **Security**: SSO authentication via Keycloak, secrets management
- **Reverse Proxy**: Nginx for routing, SSL/TLS termination, and rate limiting
- **Production Ready**: Docker-based deployment with SSL support

## Documentation

- [Setup Guide](SETUP.md) - Detailed setup instructions
- [Deployment Guide](DEPLOYMENT.md) - Deployment to staging and production
- [Nginx Configuration](infrastructure/nginx/README.md) - Reverse proxy documentation
- [Keycloak Setup](infrastructure/keycloak/README.md) - Authentication configuration

## License

Proprietary
