variable "name" {

  type    = string
  default = "trackr"

}
variable "region" {

  type    = string
  default = "us-east-1"

}
variable "domain" {

  type        = string
  description = "Public hostname, e.g. trackr.example.com"

}
variable "certificate_arn" {

  type        = string
  description = "Issued ACM certificate in the same AWS region"

}
variable "images" {

  type        = map(string)
  description = "Immutable public image URLs for web, api, worker, ai (or same-account ECR URLs)"
  validation {

    condition     = alltrue([for key in ["web", "api", "worker", "ai"] : contains(keys(var.images), key)])
    error_message = "Provide web, api, worker, and ai image URLs."

  }

}
variable "app_secrets" {

  type        = map(string)
  sensitive   = true
  description = "Provider keys and optional integration configuration merged into Secrets Manager"
  default = {

  }

}
variable "service_count" {

  type        = number
  default     = 0
  description = "Keep zero until the migration task completes; then set to one or more"

}
variable "deletion_protection" {

  type    = bool
  default = true

}
