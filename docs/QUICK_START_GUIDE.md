# ItsPlainSailing Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ running
- Keycloak instance configured
- Docker (optional, for containerized deployment)

---

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd aws-web-app-framework

# Install dependencies
npm install

# Set up environment variables
cp packages/backend/.env.example packages/backend/.env
cp packages/orgadmin-shell/.env.example packages/orgadmin-shell/.env

# Edit .env files with your configuration
```

---

## 🗄️ Database Setup

```bash
# Create database
createdb orgadmin_dev

# Run migrations
cd packages/backend
npm run migrate

# Seed initial data (optional)
npm run seed
```

---

## 🔑 Keycloak Configuration

1. Create a new realm: `orgadmin`
2. Create a client: `orgadmin-app`
3. Configure redirect URIs: `http://localhost:5173/*`
4. Enable Direct Access Grants
5. Create roles: `org-admin`, `account-user`
6. Create test users and assign roles

See `docs/KEYCLOAK_SETUP.md` for detailed instructions.

---

## 🏃 Running the Application

### Development Mode

```bash
# Terminal 1: Start backend
cd packages/backend
npm run dev

# Terminal 2: Start shell
cd packages/orgadmin-shell
npm run dev

# Access the application
# http://localhost:5173/orgadmin
```

### Docker Mode

```bash
# Start all services
docker-compose up

# Access the application
# http://localhost/orgadmin
```

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/backend
npm test --workspace=packages/orgadmin-shell
npm test --workspace=packages/orgadmin-core

# Run with coverage
npm test -- --coverage
```

---

## 🏗️ Building for Production

```bash
# Build all packages
npm run build --workspaces

# Build specific package
npm run build --workspace=packages/orgadmin-shell

# The built files will be in each package's dist/ folder
```

---

## 📊 Key URLs

| Service | URL | Description |
|---------|-----|-------------|
| **OrgAdmin UI** | http://localhost:5173/orgadmin | Main application |
| **Backend API** | http://localhost:3000/api | REST API |
| **API Docs** | http://localhost:3000/api-docs | Swagger documentation |
| **Keycloak** | http://localhost:8080 | Authentication server |
| **Grafana** | http://localhost:3001 | Monitoring dashboards |
| **Prometheus** | http://localhost:9090 | Metrics server |

---

## 🔐 Default Credentials

### Keycloak Admin
- Username: `admin`
- Password: `admin`

### Test Org Admin User
- Username: `orgadmin@example.com`
- Password: `password123`

**⚠️ Change these in production!**

---

## 📁 Project Structure

```
aws-web-app-framework/
├── packages/
│   ├── backend/              # Node.js/Express API
│   ├── orgadmin-shell/       # Shell application
│   ├── orgadmin-core/        # Core modules
│   ├── orgadmin-events/      # Events module
│   ├── orgadmin-memberships/ # Memberships module
│   ├── orgadmin-merchandise/ # Merchandise module
│   ├── orgadmin-calendar/    # Calendar module
│   ├── orgadmin-registrations/ # Registrations module
│   ├── orgadmin-ticketing/   # Ticketing module
│   └── components/           # Shared components
├── docs/                     # Documentation
├── infrastructure/           # Docker, Nginx, monitoring
└── terraform/                # Infrastructure as code
```

---

## 🎯 Common Tasks

### Create a New Organisation

```bash
# Via API
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Organisation",
    "displayName": "My Org",
    "enabledCapabilities": ["event-management", "memberships"]
  }'
```

### Enable a Capability

```bash
# Via API
curl -X PUT http://localhost:3000/api/organizations/<org-id>/capabilities \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledCapabilities": ["event-management", "memberships", "merchandise"]
  }'
```

### Create an Event

1. Log in to OrgAdmin UI
2. Navigate to Events module
3. Click "Create Event"
4. Fill in event details
5. Add activities
6. Publish event

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check database connection
psql -U postgres -d orgadmin_dev

# Check environment variables
cat packages/backend/.env

# Check logs
npm run dev --workspace=packages/backend
```

### Frontend won't load
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check Keycloak connection
curl http://localhost:8080

# Clear browser cache and reload
```

### Tests failing
```bash
# Install dependencies
npm install

# Run tests with verbose output
npm test -- --verbose

# Check test database
psql -U postgres -d orgadmin_test
```

See `docs/TROUBLESHOOTING.md` for more solutions.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `SYSTEM_COMPLETION_SUMMARY.md` | Overall system status |
| `FINAL_SYSTEM_VERIFICATION.md` | Detailed verification report |
| `docs/ORGADMIN_DEPLOYMENT_GUIDE.md` | Production deployment |
| `docs/ORGADMIN_USER_GUIDE.md` | End-user documentation |
| `docs/SECURITY.md` | Security implementation |
| `docs/PERFORMANCE_OPTIMIZATION.md` | Performance tuning |
| `docs/TROUBLESHOOTING.md` | Common issues and solutions |

---

## 🎓 Learning Resources

### For Developers
1. Read `docs/ORGADMIN_IMPLEMENTATION_GUIDE.md`
2. Review module structure in `packages/orgadmin-core/`
3. Check test examples in `__tests__/` folders
4. Review API documentation at `/api-docs`

### For Administrators
1. Read `docs/ORGADMIN_USER_GUIDE.md`
2. Review `docs/KEYCLOAK_SETUP.md`
3. Check `docs/DEPLOYMENT.md`
4. Review monitoring setup in `docs/MONITORING.md`

---

## 🆘 Getting Help

1. **Check Documentation**: Most questions are answered in the docs
2. **Search Issues**: Check if someone else had the same problem
3. **Ask the Team**: Reach out to the development team
4. **Review Logs**: Check application and server logs

---

## ✅ Verification Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Keycloak realm and clients configured
- [ ] Test users created and can log in
- [ ] All modules load correctly
- [ ] File uploads work (S3 configured)
- [ ] Email notifications work
- [ ] Monitoring dashboards accessible
- [ ] Backups configured
- [ ] SSL/TLS certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Error tracking configured

---

## 🎉 You're Ready!

The ItsPlainSailing Organisation Admin System is now running. Start exploring the features and building your organisation management solution!

**Happy coding! 🚀**

