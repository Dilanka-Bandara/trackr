variable "name" {
  type = string
}
variable "region" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "public_subnets" {
  type = list(string)
}
variable "private_subnets" {
  type = list(string)
}
variable "app_security_group" {
  type = string
}
variable "alb_security_group" {
  type = string
}
variable "domain" {
  type = string
}
variable "certificate_arn" {
  type = string
}
variable "images" {
  type = map(string)
}
variable "service_count" {
  type = number
}
variable "secret_arn" {
  type = string
}
variable "secret_keys" {
  type = list(string)
}
variable "bucket_arn" {
  type = string
}
variable "bucket_name" {
  type = string
}
locals {

  services = {
    web = 3000, api = 4000, ai = 8000, worker = 0
  }
  trust = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }, Action = "sts:AssumeRole"
    }]
  })
  environment = [for key, value in {

    NODE_ENV      = "production", WEB_URL = "https://${var.domain}", API_URL = "https://${var.domain}", PORT = "4000", TRUST_PROXY_HOPS = "1",
    AI_URL        = "http://ai.${var.name}.internal:8000", S3_BUCKET = var.bucket_name, S3_REGION = var.region,
    S3_ENDPOINT   = "https://s3.${var.region}.amazonaws.com", S3_PUBLIC_ENDPOINT = "https://s3.${var.region}.amazonaws.com",
    S3_ACCESS_KEY = "", S3_SECRET_KEY = "", AWS_REGION = var.region, EMBEDDING_DIM = "1024", EMAIL_PROVIDER = "resend"

    } : {
    name = key, value = value
  }]

}
resource "aws_ecs_cluster" "main" {
  name = var.name
}
resource "aws_cloudwatch_log_group" "apps" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
}
resource "aws_iam_role" "execution" {
  name_prefix        = "${var.name}-execution-"
  assume_role_policy = local.trust
}
resource "aws_iam_role_policy_attachment" "execution" {

  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

}
resource "aws_iam_role_policy" "secrets" {

  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.secret_arn
    }]
  })

}
resource "aws_iam_role" "task" {
  name_prefix        = "${var.name}-task-"
  assume_role_policy = local.trust
}
resource "aws_iam_role_policy" "task" {

  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [
      {
        Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${var.bucket_arn}/*"
      },
      {
        Effect = "Allow", Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], Resource = ["arn:aws:bedrock:${var.region}::foundation-model/*"]
      }
    ]
  })

}
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${var.name}.internal"
  vpc  = var.vpc_id
}
resource "aws_service_discovery_service" "ai" {

  name = "ai"
  dns_config {

    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"

  }
  health_check_custom_config {}

}
resource "aws_ecs_task_definition" "apps" {

  for_each                 = local.services
  family                   = "${var.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([merge({

    name        = each.key, image = var.images[each.key], essential = true,
    environment = each.key == "web" ? [] : local.environment,
    secrets = each.key == "web" ? [] : [for key in var.secret_keys : {
      name = key, valueFrom = "${var.secret_arn}:${key}::"
    }],
    portMappings = each.value == 0 ? [] : [{
      containerPort = each.value, protocol = "tcp"
    }],
    logConfiguration = {
      logDriver = "awslogs", options = {
        awslogs-group = aws_cloudwatch_log_group.apps.name, awslogs-region = var.region, awslogs-stream-prefix = each.key
      }
    }

    }, each.key == "worker" ? {
    command = ["node", "dist/worker.js"]
    } : {

  })])

}
resource "aws_ecs_service" "apps" {

  for_each        = local.services
  name            = "${var.name}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.apps[each.key].arn
  launch_type     = "FARGATE"
  desired_count   = var.service_count
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [var.app_security_group]
    assign_public_ip = false
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  dynamic "load_balancer" {

    for_each = contains(["web", "api"], each.key) ? [each.key] : []
    content {
      target_group_arn = aws_lb_target_group.apps[each.key].arn
      container_name   = each.key
      container_port   = each.value
    }

  }
  dynamic "service_registries" {

    for_each = each.key == "ai" ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.ai.arn
    }

  }
  depends_on = [aws_lb_listener.https, aws_lb_listener_rule.api]

}
resource "aws_ecs_task_definition" "migrate" {

  family                   = "${var.name}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{

    name    = "migrate", image = var.images["api"], essential = true,
    command = ["node", "dist/db/migrate.js"], environment = local.environment,
    secrets = [for key in var.secret_keys : {
      name = key, valueFrom = "${var.secret_arn}:${key}::"
    }],
    logConfiguration = {
      logDriver = "awslogs", options = {
        awslogs-group = aws_cloudwatch_log_group.apps.name, awslogs-region = var.region, awslogs-stream-prefix = "migrate"
      }
    }

  }])

}
resource "aws_lb" "main" {
  name               = var.name
  subnets            = var.public_subnets
  security_groups    = [var.alb_security_group]
  load_balancer_type = "application"
}
resource "aws_lb_target_group" "apps" {

  for_each = {
    web = 3000, api = 4000
  }
  name        = "${var.name}-${each.key}"
  port        = each.value
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    path    = each.key == "api" ? "/api/health" : "/login"
    matcher = "200"
  }

}
resource "aws_lb_listener" "http" {

  load_balancer_arn = aws_lb.main.arn
  port              = 80
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
resource "aws_lb_listener" "https" {

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.apps["web"].arn
  }

}
resource "aws_lb_listener_rule" "api" {

  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.apps["api"].arn
  }
  condition {
    path_pattern {
      values = ["/api/*", "/socket.io/*"]
    }
  }

}
output "load_balancer_dns" {
  value = aws_lb.main.dns_name
}
output "cluster" {
  value = aws_ecs_cluster.main.name
}
output "migration_task_definition" {
  value = aws_ecs_task_definition.migrate.arn
}
