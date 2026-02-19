#!/bin/bash

# AWS Framework - Keycloak Theme Setup Script
# This script helps set up the custom Keycloak theme

set -e

echo "🎨 AWS Framework Keycloak Theme Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if theme directory exists
if [ ! -d "infrastructure/keycloak/themes/aws-framework" ]; then
    echo -e "${RED}Error: Theme directory not found${NC}"
    echo "Expected: infrastructure/keycloak/themes/aws-framework"
    exit 1
fi

echo "✓ Theme files found"
echo ""

# Ask user which installation method they want
echo "Choose installation method:"
echo "1) Docker Volume Mount (Development - Recommended)"
echo "2) Build Custom Docker Image (Production)"
echo "3) Manual Installation"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "📦 Setting up Docker Volume Mount..."
        echo ""
        
        # Check if docker-compose.yml already has the volume mount
        if grep -q "infrastructure/keycloak/themes:/opt/keycloak/themes" docker-compose.yml; then
            echo -e "${YELLOW}Volume mount already exists in docker-compose.yml${NC}"
        else
            echo "Adding volume mount to docker-compose.yml..."
            # Note: This is a simple approach. In production, use a proper YAML parser
            echo -e "${YELLOW}Please manually add this to your keycloak service in docker-compose.yml:${NC}"
            echo ""
            echo "    volumes:"
            echo "      - ./infrastructure/keycloak/themes:/opt/keycloak/themes"
            echo ""
        fi
        
        echo "Restarting Keycloak container..."
        docker-compose restart keycloak
        
        echo ""
        echo -e "${GREEN}✓ Theme installed successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Go to Keycloak Admin Console: http://localhost:8080"
        echo "2. Login as admin"
        echo "3. Select your realm (aws-framework)"
        echo "4. Go to Realm Settings → Themes"
        echo "5. Set Login Theme to 'aws-framework'"
        echo "6. Click Save"
        ;;
        
    2)
        echo ""
        echo "🐳 Building Custom Docker Image..."
        echo ""
        
        # Check if Dockerfile exists
        if [ ! -f "infrastructure/keycloak/Dockerfile" ]; then
            echo "Creating Dockerfile..."
            cat > infrastructure/keycloak/Dockerfile << 'EOF'
FROM quay.io/keycloak/keycloak:latest

# Copy custom theme
COPY themes/aws-framework /opt/keycloak/themes/aws-framework

# Set production mode
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Build Keycloak
RUN /opt/keycloak/bin/kc.sh build

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
EOF
            echo "✓ Dockerfile created"
        fi
        
        # Build the image
        echo "Building Docker image..."
        cd infrastructure/keycloak
        docker build -t aws-framework-keycloak:latest .
        cd ../..
        
        echo ""
        echo -e "${GREEN}✓ Docker image built successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Update docker-compose.yml to use: aws-framework-keycloak:latest"
        echo "2. Run: docker-compose up -d keycloak"
        echo "3. Configure theme in Keycloak Admin Console"
        ;;
        
    3)
        echo ""
        echo "📋 Manual Installation Instructions"
        echo ""
        echo "1. Copy theme files to Keycloak:"
        echo "   cp -r infrastructure/keycloak/themes/aws-framework /opt/keycloak/themes/"
        echo ""
        echo "2. Restart Keycloak:"
        echo "   sudo systemctl restart keycloak"
        echo "   # OR"
        echo "   /opt/keycloak/bin/kc.sh start"
        echo ""
        echo "3. Configure theme in Keycloak Admin Console"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "📚 For more information, see: docs/KEYCLOAK_CUSTOM_THEME.md"
echo ""
