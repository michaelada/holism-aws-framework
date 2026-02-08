output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.compute.alb_dns_name
}

output "database_endpoint" {
  description = "Database connection endpoint"
  value       = module.database.db_instance_endpoint
  sensitive   = true
}

output "monitoring_instance_ip" {
  description = "Private IP of monitoring instance"
  value       = module.monitoring.monitoring_instance_private_ip
}

output "cloudwatch_dashboard_name" {
  description = "Name of CloudWatch dashboard"
  value       = module.monitoring.dashboard_name
}

output "secrets_arn" {
  description = "ARN of secrets in Secrets Manager"
  value       = module.secrets.secret_arn
  sensitive   = true
}
