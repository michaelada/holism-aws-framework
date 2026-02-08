-- Initialize databases for the AWS Web Application Framework

-- Create keycloak database for Keycloak service
CREATE DATABASE keycloak;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aws_framework TO framework_user;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO framework_user;

-- Connect to aws_framework database and create extensions
\c aws_framework;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema placeholder (migrations will handle actual tables)
CREATE SCHEMA IF NOT EXISTS public;
