terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "aws-web-framework-terraform-state-production"
    key            = "production/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-production"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "production"
      Project     = "aws-web-framework"
      ManagedBy   = "terraform"
    }
  }
}

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  environment = "production"
  common_tags = {
    Environment = local.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Networking Module
module "networking" {
  source = "../../modules/networking"

  environment        = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  tags               = local.common_tags
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  environment            = local.environment
  database_password      = var.database_password
  keycloak_client_secret = var.keycloak_client_secret
  jwt_signing_key        = var.jwt_signing_key
  session_secret         = var.session_secret
  enable_rotation        = var.enable_secret_rotation
  rotation_lambda_arn    = var.rotation_lambda_arn
  rotation_days          = 30
  alarm_actions          = [module.monitoring.sns_topic_arn]
  tags                   = local.common_tags
}

# Database Module
module "database" {
  source = "../../modules/database"

  environment                = local.environment
  private_subnet_ids         = module.networking.private_subnet_ids
  database_security_group_id = module.networking.database_security_group_id
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  database_name              = var.database_name
  master_username            = var.db_master_username
  master_password            = var.database_password
  backup_retention_period    = 30
  multi_az                   = true
  alarm_actions              = [module.monitoring.sns_topic_arn]
  tags                       = local.common_tags
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  environment                 = local.environment
  private_subnet_ids          = module.networking.private_subnet_ids
  monitoring_security_group_id = module.networking.monitoring_security_group_id
  ami_id                      = data.aws_ami.amazon_linux_2.id
  monitoring_instance_type    = var.monitoring_instance_type
  log_retention_days          = 90
  alarm_email_addresses       = var.alarm_email_addresses
  aws_region                  = var.aws_region
  tags                        = local.common_tags
}

# Compute Module
module "compute" {
  source = "../../modules/compute"

  environment            = local.environment
  vpc_id                 = module.networking.vpc_id
  public_subnet_ids      = module.networking.public_subnet_ids
  private_subnet_ids     = module.networking.private_subnet_ids
  alb_security_group_id  = module.networking.alb_security_group_id
  app_security_group_id  = module.networking.app_security_group_id
  ami_id                 = data.aws_ami.amazon_linux_2.id
  instance_type          = var.instance_type
  asg_min_size           = var.asg_min_size
  asg_max_size           = var.asg_max_size
  asg_desired_capacity   = var.asg_desired_capacity
  ssl_certificate_arn    = var.ssl_certificate_arn
  database_host          = module.database.db_instance_address
  database_name          = var.database_name
  secrets_arn            = module.secrets.secret_arn
  keycloak_url           = var.keycloak_url
  aws_region             = var.aws_region
  tags                   = local.common_tags

  depends_on = [module.database, module.secrets]
}
