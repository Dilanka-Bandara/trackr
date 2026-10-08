terraform {

  required_version = ">= 1.10"
  required_providers {

    aws = {
      source = "hashicorp/aws", version = "~> 6.0"
    }
    random = {
      source = "hashicorp/random", version = "~> 3.7"
    }

  }
  # Supply the pre-existing state bucket using -backend-config=backend.hcl.
  backend "s3" {

  }

}
provider "aws" {

  region = var.region
  default_tags {
    tags = {
      Project = var.name, ManagedBy = "Terraform"
    }
  }

}
