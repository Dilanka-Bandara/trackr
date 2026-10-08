mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1b"] }
  }
}
mock_provider "random" {}

run "architecture_plan" {
  command = plan
  variables {
    domain          = "trackr.example.com"
    certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
    images = {
      web    = "ghcr.io/example/trackr-web:test"
      api    = "ghcr.io/example/trackr-api:test"
      worker = "ghcr.io/example/trackr-api:test"
      ai     = "ghcr.io/example/trackr-ai:test"
    }
  }
  assert {
    condition     = var.service_count == 0
    error_message = "Services must stay stopped until the migration task is run."
  }
}
