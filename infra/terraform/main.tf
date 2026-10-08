module "network" {

  source = "./modules/network"
  name   = var.name

}
module "data" {

  source              = "./modules/data"
  name                = var.name
  vpc_id              = module.network.vpc_id
  private_subnets     = module.network.private_subnets
  app_security_group  = module.network.app_security_group
  deletion_protection = var.deletion_protection
  web_origin          = "https://${var.domain}"

}
resource "random_password" "jwt" {
  length  = 64
  special = false
}
resource "random_password" "internal" {
  length  = 64
  special = false
}
resource "aws_secretsmanager_secret" "app" {

  name_prefix             = "${var.name}-environment-"
  recovery_window_in_days = 7

}
resource "aws_secretsmanager_secret_version" "app" {

  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(merge(var.app_secrets, {

    DATABASE_URL    = "postgresql://trackr:${module.data.password}@${module.data.database_endpoint}/trackr?sslmode=verify-full&sslrootcert=/app/certs/rds.pem"
    REDIS_URL       = "rediss://${module.data.redis_endpoint}:6379"
    JWT_SECRET      = random_password.jwt.result
    AI_INTERNAL_KEY = random_password.internal.result

  }))

}
module "compute" {

  source             = "./modules/compute"
  name               = var.name
  region             = var.region
  vpc_id             = module.network.vpc_id
  public_subnets     = module.network.public_subnets
  private_subnets    = module.network.private_subnets
  app_security_group = module.network.app_security_group
  alb_security_group = module.network.alb_security_group
  domain             = var.domain
  certificate_arn    = var.certificate_arn
  images             = var.images
  service_count      = var.service_count
  secret_arn         = aws_secretsmanager_secret.app.arn
  secret_keys        = distinct(concat(["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "AI_INTERNAL_KEY"], nonsensitive(keys(var.app_secrets))))
  bucket_arn         = module.data.bucket_arn
  bucket_name        = module.data.bucket_name
  depends_on         = [aws_secretsmanager_secret_version.app]

}
