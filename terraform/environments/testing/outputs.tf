output "public_ip" {
  description = "Point your DNS A record here, unless it already points at an address you reused."
  value       = local.public_ip
}

output "instance_id" {
  description = "For `aws ssm start-session --target <id>`."
  value       = aws_instance.main.id
}

output "shell_command" {
  description = "A shell on the box without opening SSH."
  value       = "aws ssm start-session --target ${aws_instance.main.id} --region ${var.aws_region}"
}

output "urls" {
  description = "Where the applications will be once DNS points at the address above."
  value = {
    member_portal    = "${var.public_url}/account"
    club_admin       = "${var.public_url}/orgadmin"
    platform_admin   = "${var.public_url}/admin"
    metadata         = "${var.public_url}/metadata"
    keycloak_console = "${var.public_url}/auth/admin/"
  }
}

output "estimated_monthly_cost" {
  description = "Indicative eu-west-1 on-demand pricing. Check current rates."
  value = {
    instance     = var.instance_type
    note         = "t4g.medium ~$27, t4g.small ~$13, plus ~$2.60 disk and ~$3.60 for the elastic IP"
    when_stopped = "~$6/month — the volume and the address only"
  }
}
