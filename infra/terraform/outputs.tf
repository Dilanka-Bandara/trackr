output "load_balancer_dns" {
  value = module.compute.load_balancer_dns
}
output "cluster" {
  value = module.compute.cluster
}
output "migration_task_definition" {
  value = module.compute.migration_task_definition
}
output "private_subnets" {
  value = module.network.private_subnets
}
output "app_security_group" {
  value = module.network.app_security_group
}
output "uploads_bucket" {
  value = module.data.bucket_name
}
