# Trackr on AWS

This configuration provisions a two-AZ VPC, public ALB, private ECS Fargate services, RDS PostgreSQL 16, encrypted ElastiCache Redis, private S3 uploads, IAM task roles, Secrets Manager, Cloud Map service discovery, and CloudWatch logs. Supply an **issued ACM certificate** in the same region. DNS validation depends on your domain owner and is intentionally not automatic.

## Validate without an AWS account

```sh
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
terraform test
```

The test uses mocked AWS providers to exercise a plan. It does **not** confirm that an AWS account has enough permissions or quota, that your certificate exists, or that an image can be pulled. A real `terraform plan` needs AWS credentials and real variable values.

## Remote state and deployment

1. Create a private S3 state bucket with encryption and versioning. Restrict access: state contains generated database passwords and secret values.
2. Copy `backend.hcl.example` to `backend.hcl` and fill it in. Run `terraform init -reconfigure -backend-config=backend.hcl`.
3. Copy `terraform.tfvars.example` to `terraform.tfvars`. Supply immutable image URLs, your domain, certificate ARN, and provider/email secrets. Build the web image with `NEXT_PUBLIC_API_URL=/api`.
4. Run `terraform plan -out=plan.tfplan` and review it before applying. `service_count` defaults to zero so the app cannot start against an unmigrated database.
5. After an authorized apply, run the `migration_task_definition` output as a one-off ECS Fargate task in the output private subnets/security group. Inspect its exit code and CloudWatch logs; it must exit zero.
6. Set `service_count=1`, plan again, then apply. Point your DNS hostname at `load_balancer_dns`. Enable Stripe webhooks at `/api/billing/webhook` and Google’s callback at `/api/auth/google/callback`.

The task role supplies S3/Bedrock credentials; leave static S3/AWS access keys empty. RDS connections verify the AWS root certificate included in the API image. Redis uses TLS. The public bucket CORS policy permits only the configured web origin.

## Cost and teardown

This is a portfolio reference architecture, not a free-tier deployment. Four Fargate tasks, ALB, NAT gateway, RDS, Redis, storage, public IPv4, logs, and AI usage all incur charges. A continuously running installation can cost **hundreds of USD per month**, depending on region and traffic; check the AWS calculator for your configuration. No AWS resources were created as part of the source build.

For a temporary showcase, review `terraform plan -destroy`. RDS deletion protection defaults to true. To intentionally destroy it, first change `deletion_protection=false` and apply that change; export backups and empty the uploads bucket when you are certain you no longer need its files. Secrets have a seven-day recovery window. Do not destroy an environment containing needed application data.

The single NAT gateway and single Redis node are cost-conscious choices, not high availability. Raise replicas, add multi-AZ RDS and a second NAT, narrow IAM model ARNs, configure alarms, and conduct a production security review for a real launch.
