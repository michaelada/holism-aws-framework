output "cloudwatch_log_group_application" {
  description = "Name of application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application.name
}

output "cloudwatch_log_group_backend" {
  description = "Name of backend CloudWatch log group"
  value       = aws_cloudwatch_log_group.backend.name
}

output "cloudwatch_log_group_frontend" {
  description = "Name of frontend CloudWatch log group"
  value       = aws_cloudwatch_log_group.frontend.name
}

output "sns_topic_arn" {
  description = "ARN of SNS topic for alarms"
  value       = aws_sns_topic.alarms.arn
}

output "dashboard_name" {
  description = "Name of CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "monitoring_instance_id" {
  description = "ID of monitoring EC2 instance"
  value       = aws_instance.monitoring.id
}

output "monitoring_instance_private_ip" {
  description = "Private IP of monitoring instance"
  value       = aws_instance.monitoring.private_ip
}
