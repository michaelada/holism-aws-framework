# Secrets Manager Secret
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.environment}-app-secrets"
  description = "Application secrets for ${var.environment} environment"

  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-app-secrets"
      Environment = var.environment
    }
  )
}

# Secret Version with Initial Values
resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    database_password       = var.database_password
    keycloak_client_secret  = var.keycloak_client_secret
    jwt_signing_key         = var.jwt_signing_key
    session_secret          = var.session_secret
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Secret Rotation (Optional - for production)
resource "aws_secretsmanager_secret_rotation" "app_secrets" {
  count               = var.enable_rotation ? 1 : 0
  secret_id           = aws_secretsmanager_secret.app_secrets.id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

# IAM Policy for Secret Access
resource "aws_iam_policy" "secrets_access" {
  name        = "${var.environment}-secrets-access-policy"
  description = "Policy to allow access to application secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })

  tags = var.tags
}

# CloudWatch Alarm for Secret Access
resource "aws_cloudwatch_log_metric_filter" "secret_access" {
  name           = "${var.environment}-secret-access-filter"
  log_group_name = "/aws/secretsmanager/${var.environment}"
  pattern        = "[time, request_id, event_type = GetSecretValue, ...]"

  metric_transformation {
    name      = "SecretAccessCount"
    namespace = "CustomMetrics/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "unusual_secret_access" {
  alarm_name          = "${var.environment}-unusual-secret-access"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "SecretAccessCount"
  namespace           = "CustomMetrics/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.secret_access_threshold
  alarm_description   = "Alert on unusual number of secret accesses"
  alarm_actions       = var.alarm_actions

  tags = var.tags
}
