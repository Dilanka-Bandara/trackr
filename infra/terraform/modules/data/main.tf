variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "private_subnets" {
  type = list(string)
}
variable "app_security_group" {
  type = string
}
variable "deletion_protection" {
  type = bool
}
variable "web_origin" {
  type = string
}
resource "random_password" "database" {
  length  = 40
  special = false
}
resource "aws_security_group" "data" {

  name_prefix = "${var.name}-data-"
  vpc_id      = var.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group]
  }
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group]
  }

}
resource "aws_db_subnet_group" "main" {
  name       = "${var.name}-db"
  subnet_ids = var.private_subnets
}
resource "aws_db_instance" "main" {

  identifier                 = var.name
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = "db.t4g.micro"
  allocated_storage          = 20
  max_allocated_storage      = 100
  storage_encrypted          = true
  db_name                    = "trackr"
  username                   = "trackr"
  password                   = random_password.database.result
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.data.id]
  publicly_accessible        = false
  backup_retention_period    = 7
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = !var.deletion_protection
  final_snapshot_identifier  = "${var.name}-final"
  auto_minor_version_upgrade = true

}
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name}-redis"
  subnet_ids = var.private_subnets
}
resource "aws_elasticache_parameter_group" "main" {

  name   = "${var.name}-redis"
  family = "redis7"
  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

}
resource "aws_elasticache_replication_group" "main" {

  replication_group_id       = var.name
  description                = "Trackr queues and cache"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  engine                     = "redis"
  engine_version             = "7.1"
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  snapshot_retention_limit   = 3

}
resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "${var.name}-uploads-"
}
resource "aws_s3_bucket_public_access_block" "uploads" {

  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

}
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {

  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }

}
resource "aws_s3_bucket_cors_configuration" "uploads" {

  bucket = aws_s3_bucket.uploads.id
  cors_rule {

    allowed_headers = ["content-type", "if-none-match", "x-amz-*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = [var.web_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 300

  }

}
output "database_endpoint" {
  value = aws_db_instance.main.endpoint
}
output "password" {
  value     = random_password.database.result
  sensitive = true
}
output "redis_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}
output "bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}
output "bucket_name" {
  value = aws_s3_bucket.uploads.id
}
