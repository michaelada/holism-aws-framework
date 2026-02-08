#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI
yum install -y aws-cli

# Create application directory
mkdir -p /opt/app
cd /opt/app

# Retrieve secrets from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id ${secrets_arn} \
  --region ${aws_region} \
  --query SecretString \
  --output text > /opt/app/.env

# Add environment-specific variables
cat >> /opt/app/.env <<EOF
NODE_ENV=${environment}
DATABASE_HOST=${database_host}
DATABASE_NAME=${database_name}
KEYCLOAK_URL=${keycloak_url}
AWS_REGION=${aws_region}
EOF

# Pull and start application containers
# Note: In production, you would pull from ECR or another container registry
# This is a placeholder for the actual deployment process
echo "Application deployment complete"

# Configure CloudWatch Logs agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json <<EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/app/logs/application.log",
            "log_group_name": "/aws/ec2/${environment}/application",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
