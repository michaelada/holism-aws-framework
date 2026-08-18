# itsps.org test deployment.
#
# NOTE: terraform.tfvars is NOT gitignored in this repository. Nothing secret is
# in here — the secrets are generated on the instance by bootstrap.sh — but do
# not add any.

public_url = "https://itsps.org"

# Redirected to public_url, so Keycloak only ever sees one origin.
#
# This name must already resolve to the instance before the certificate is
# requested: certbot asks for both in one go and fails entirely if either does
# not validate. If you have not pointed www yet, leave this empty for the first
# apply and add it later.
extra_domains = ["www.itsps.org"]

ses_from_email = "info@eskersoft.com"

repository_url = "https://github.com/michaelada/holism-aws-framework.git"
branch         = "main"

# Private repository.
#
# The NAME of an SSM SecureString parameter holding a GitHub token — never the
# token itself, which would end up in Terraform state in plain text. Create it
# once, outside Terraform:
#
#   aws ssm put-parameter --name /holism/testing/github-token \
#     --type SecureString --value ghp_xxx --region eu-west-1
#
# A fine-grained token with `Contents: Read-only` on this one repository is
# enough. Leave empty for a public repository.
github_token_ssm_parameter = "/holism/testing/github-token"

# 4 GB. Memory is the binding constraint, and the front-end build is the peak.
instance_type = "t4g.medium"
aws_region    = "eu-west-1"

# Four demo clubs, members, events and a shop — including an administrator who
# runs two clubs, which is what exercises the organisation switcher.
seed_demo_data = true

# Open to the internet so the deployment can be shown to people. Narrow it if
# not: there is a Keycloak admin console on this box.
web_ingress_cidrs = ["0.0.0.0/0"]

# SSH stays shut; Session Manager is attached to the instance role instead.
ssh_ingress_cidrs = ["203.0.113.5/32"]
ssh_key_name      = "ips-ec2-server"

# Reaching a port from your laptop
# Session Manager will tunnel, so you can use a local psql or Postico without opening anything:

# on the box: publish Postgres on loopback only, temporarily
#docker compose -f docker-compose.deploy.yml --env-file .env.deploy \
#  run -d --rm -p 127.0.0.1:5432:5432 postgres

# locally
#aws ssm start-session --target i-0abc123... --region eu-west-1 \
#  --document-name AWS-StartPortForwardingSession \
#  --parameters '{"portNumber":["5432"],"localPortNumber":["15432"]}'