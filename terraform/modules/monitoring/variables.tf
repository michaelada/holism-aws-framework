variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "monitoring_security_group_id" {
  description = "Security group ID for monitoring services"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for monitoring instance"
  type        = string
}

variable "monitoring_instance_type" {
  description = "Instance type for monitoring server"
  type        = string
  default     = "t3.medium"
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "alarm_email_addresses" {
  description = "List of email addresses to receive alarm notifications"
  type        = list(string)
  default     = []
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
