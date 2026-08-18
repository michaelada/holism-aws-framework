/**
 * The whole platform on one instance.
 *
 * A deliberately different shape from `staging/` and `production/`, which model
 * a real deployment: load balancer, RDS, autoscaling group, a NAT gateway and a
 * second instance for monitoring — about $145/month before anybody signs in.
 *
 * This is for *testing*, where the useful question is "does the product work?"
 * and not "does it survive an availability-zone failure". Everything the stack
 * needs already runs in one `docker compose`, so it runs in one instance:
 *
 *   no NAT gateway   the instance sits in a public subnet   (~$33/month saved)
 *   no RDS           Postgres is a container                (~$35/month saved)
 *   no ALB           nginx is already in the compose file   (~$22/month saved)
 *   no second box    Prometheus and Grafana are optional    (~$15/month saved)
 *
 * What it gives up, stated plainly: there is no redundancy, an instance
 * replacement loses the database unless a snapshot was taken, and the whole
 * thing stops when the instance stops. All fine for a test environment, none of
 * it fine for a real one — use `staging/` for that.
 *
 * No module of its own on purpose. Modules earn their keep when something is
 * used twice; this is one instance in one environment, and a reader who wants
 * to know what is deployed should be able to read it in one file.
 */

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "holism"
      Environment = "testing"
      ManagedBy   = "opentofu"
      # So the bill can be read: this environment exists to be cheap, and that
      # claim should be checkable in Cost Explorer rather than believed.
      CostCentre = "testing"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------
# One public subnet and an internet gateway. No private subnet, and therefore
# no NAT gateway — which at ~$33/month would be the single largest line on the
# bill, more than the instance it exists to serve.

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "holism-testing" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "holism-testing" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = { Name = "holism-testing-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "holism-testing-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

resource "aws_security_group" "instance" {
  name        = "holism-testing"
  description = "Single-instance test deployment"
  vpc_id      = aws_vpc.main.id

  # HTTP and HTTPS from wherever you say. Defaulting this open would be the
  # wrong default for something with a Keycloak admin console on it.
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.web_ingress_cidrs
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.web_ingress_cidrs
  }

  dynamic "ingress" {
    # Only when an address is given. SSH open to the world on a box holding a
    # database is not a default anybody should inherit by forgetting a variable.
    for_each = length(var.ssh_ingress_cidrs) > 0 ? [1] : []
    content {
      description = "SSH"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_ingress_cidrs
    }
  }

  egress {
    description = "All outbound: pulls images, sends mail, reaches Stripe"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "holism-testing" }
}

# ---------------------------------------------------------------------------
# Instance role
# ---------------------------------------------------------------------------
# Enough to be reachable through Session Manager (so SSH can stay shut) and to
# send mail through SES. Nothing else: this box holds a database, and a role it
# does not need is a role that cannot be misused.

resource "aws_iam_role" "instance" {
  name = "holism-testing-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ses" {
  name = "send-email"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

# Read the one parameter holding the GitHub token, and nothing else.
#
# Scoped to the exact parameter rather than a prefix: this box is reachable from
# the internet, and a role that can read every parameter in the account is a
# much larger thing to hand it than the one secret it needs.
resource "aws_iam_role_policy" "github_token" {
  count = var.github_token_ssm_parameter != "" ? 1 : 0

  name = "read-github-token"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.github_token_ssm_parameter}"
      },
      {
        # SecureString parameters are encrypted with the account's default SSM
        # key unless you say otherwise; reading one needs permission to decrypt.
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "holism-testing-instance"
  role = aws_iam_role.instance.name
}

# ---------------------------------------------------------------------------
# The instance
# ---------------------------------------------------------------------------

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name = "name"
    # Architecture follows the instance type: Graviton (t4g) is roughly 20%
    # cheaper than the equivalent t3, and every image in this stack is
    # multi-architecture, so there is nothing to give up by taking it.
    values = [var.use_graviton ? "al2023-ami-2023.*-arm64" : "al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "main" {
  ami           = data.aws_ami.al2023.id
  instance_type = var.instance_type

  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.instance.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name
  key_name               = var.ssh_key_name

  root_block_device {
    volume_size = var.disk_size_gb
    volume_type = "gp3"
    encrypted   = true
    # Kept when the instance is replaced would be better, but a root volume
    # cannot be. The database lives on it, so take a snapshot before doing
    # anything drastic — see the README.
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    repository_url         = var.repository_url
    branch                 = var.branch
    github_token_parameter = var.github_token_ssm_parameter
    public_url             = var.public_url
    extra_domains          = join(" ", var.extra_domains)
    ses_from_email         = var.ses_from_email
    aws_region             = var.aws_region
    seed_demo_data         = var.seed_demo_data
  })

  # So a change to the bootstrap replaces the instance rather than being
  # silently ignored — user_data runs once, and an edited script that never
  # runs is worse than one that fails loudly.
  user_data_replace_on_change = true

  tags = { Name = "holism-testing" }
}

# A stable address, so the DNS record and the Keycloak hostname survive a stop
# and start. Charged whether or not it is attached — about $3.60/month — which
# is the price of not re-pointing DNS every time the instance is restarted.
resource "aws_eip" "main" {
  instance = aws_instance.main.id
  domain   = "vpc"

  tags = { Name = "holism-testing" }
}
