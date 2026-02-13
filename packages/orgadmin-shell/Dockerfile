# Multi-stage Dockerfile for ItsPlainSailing OrgAdmin Shell
# Supports both development and production builds

# ============================================
# Base Stage - Common dependencies
# ============================================
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# ============================================
# Dependencies Stage - Install all dependencies
# ============================================
FROM base AS dependencies

# Install all dependencies (including devDependencies)
RUN npm ci

# ============================================
# Development Stage - For local development with hot reload
# ============================================
FROM dependencies AS development

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5175

# Set environment to development
ENV NODE_ENV=development

# Start development server with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5175"]

# ============================================
# Builder Stage - Build production assets
# ============================================
FROM dependencies AS builder

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_BASE_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_APP_NAME=ItsPlainSailing
ARG VITE_APP_VERSION=1.0.0

# Set environment variables for build
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL}
ENV VITE_KEYCLOAK_REALM=${VITE_KEYCLOAK_REALM}
ENV VITE_KEYCLOAK_CLIENT_ID=${VITE_KEYCLOAK_CLIENT_ID}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Verify build output
RUN ls -la dist/

# ============================================
# Production Stage - Serve with Nginx
# ============================================
FROM nginx:alpine AS production

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html/orgadmin

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx/client_temp && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html/orgadmin

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/orgadmin/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# ============================================
# Metadata
# ============================================
LABEL maintainer="ItsPlainSailing Team"
LABEL description="ItsPlainSailing OrgAdmin Shell - Organization Administration Interface"
LABEL version="1.0.0"
