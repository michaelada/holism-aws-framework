# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "production" ? true : false

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-alb"
    }
  )
}

# Target Group for Backend
resource "aws_lb_target_group" "backend" {
  name     = "${var.environment}-backend-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-backend-tg"
    }
  )
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name     = "${var.environment}-frontend-tg"
  port     = 5173
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/"
    matcher             = "200"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-frontend-tg"
    }
  )
}

# Target Group for Admin Frontend
resource "aws_lb_target_group" "admin" {
  name     = "${var.environment}-admin-tg"
  port     = 5174
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/admin"
    matcher             = "200"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-admin-tg"
    }
  )
}

# ALB Listener - HTTP (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB Listener - HTTPS
resource "aws_lb_listener" "https" {
  count             = var.ssl_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener Rule for API requests
resource "aws_lb_listener_rule" "api" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# Listener Rule for Admin API requests
resource "aws_lb_listener_rule" "admin_api" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 90

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/admin/*"]
    }
  }
}

# Listener Rule for Admin Frontend
resource "aws_lb_listener_rule" "admin" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 80

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    path_pattern {
      values = ["/admin", "/admin/*"]
    }
  }
}

# Launch Template for Application Servers
resource "aws_launch_template" "app" {
  name_prefix   = "${var.environment}-app-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  vpc_security_group_ids = [var.app_security_group_id]

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    environment           = var.environment
    database_host         = var.database_host
    database_name         = var.database_name
    secrets_arn           = var.secrets_arn
    keycloak_url          = var.keycloak_url
    aws_region            = var.aws_region
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.tags,
      {
        Name = "${var.environment}-app-server"
      }
    )
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "${var.environment}-app-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [
    aws_lb_target_group.backend.arn,
    aws_lb_target_group.frontend.arn,
    aws_lb_target_group.admin.arn
  ]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.environment}-app-server"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

# Auto Scaling Policy - Target Tracking (CPU)
resource "aws_autoscaling_policy" "cpu" {
  name                   = "${var.environment}-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# IAM Role for EC2 Instances
resource "aws_iam_role" "app" {
  name = "${var.environment}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Secrets Manager Access
resource "aws_iam_role_policy" "secrets" {
  name = "${var.environment}-secrets-policy"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secrets_arn
      }
    ]
  })
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch" {
  name = "${var.environment}-cloudwatch-policy"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "app" {
  name = "${var.environment}-app-profile"
  role = aws_iam_role.app.name

  tags = var.tags
}
