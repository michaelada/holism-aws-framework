variable "aws_region" {
  description = "Where to deploy."
  type        = string
  default     = "eu-west-1"
}

variable "instance_type" {
  description = <<-EOT
    Memory is the binding constraint here, not CPU. Keycloak's JVM alone wants
    about a gigabyte, and Postgres, the API and nginx share what is left.

      t4g.small  (2 GB)  works if Prometheus and Grafana stay off, and with swap
      t4g.medium (4 GB)  comfortable, and can build the front-end bundles

    The front-end build is the peak: four Vite bundles. On 2 GB it needs the
    swap the bootstrap adds, or it is killed with an error blaming esbuild.
  EOT
  type        = string
  default     = "t4g.medium"
}

variable "use_graviton" {
  description = <<-EOT
    ARM instances (t4g) rather than x86 (t3). Roughly 20% cheaper, and every
    image in this stack is multi-architecture — Postgres, Keycloak, nginx and
    node:20-alpine all publish arm64 — so there is nothing to give up.

    Set false only if you add something x86-only.
  EOT
  type        = bool
  default     = true
}

variable "existing_elastic_ip" {
  description = <<-EOT
    An elastic IP you already hold, to attach to this instance instead of
    allocating a new one.

    Worth using when DNS already points at it: the deployment comes up on the
    right name with no record to change and no propagation to wait for, and
    certbot can validate immediately. An unattached elastic IP is also charged
    for doing nothing, so attaching one you already have costs less than
    allocating another.

    Given as the address itself, e.g. "63.32.80.204". Empty allocates a new one.

    Terraform associates it but does not manage it: destroying this environment
    releases the association and leaves the address in your account.
  EOT
  type        = string
  default     = ""
}

variable "disk_size_gb" {
  description = "Root volume. Holds the database, the images and the build cache."
  type        = number
  default     = 30
}

variable "public_url" {
  description = <<-EOT
    Where this deployment will be reached, scheme included:
    https://test.example.com

    Baked into the front-end bundles and into Keycloak's issuer URLs, so it
    cannot be changed without rebuilding and re-importing the realm. Point the
    DNS record at the elastic IP this outputs.
  EOT
  type        = string
}

variable "extra_domains" {
  description = <<-EOT
    Other names that should reach this deployment — typically the www form.

    They are **redirected to `public_url`**, not served alongside it. One
    canonical origin is what keeps Keycloak simple: every client's redirect URIs
    and web origins name a single host, and a sign-in that began on www would
    otherwise come back to a URI the realm does not list and fail.

    Each name must already resolve to this instance before the certificate is
    requested. Certbot asks for all of them in one go and fails *entirely* if
    any one does not validate — which is why this is empty by default rather
    than quietly including www.
  EOT
  type        = list(string)
  default     = []
}

variable "repository_url" {
  description = "Git URL the instance clones to build from."
  type        = string
}

variable "github_token_ssm_parameter" {
  description = <<-EOT
    Name of an SSM Parameter Store **SecureString** holding a GitHub token, for
    cloning a private repository. Empty for a public one.

    The parameter is created by you, outside Terraform, and named here:

      aws ssm put-parameter --name /holism/testing/github-token \
        --type SecureString --value ghp_xxx --region eu-west-1

    Deliberately not a Terraform variable holding the token itself. A value
    passed in would be written to the state file in plain text, and a value
    passed through `user_data` would be readable by anything that can reach the
    instance metadata service — including any process on the box. This way
    Terraform only ever knows the *name*, and grants the instance role
    permission to read that one parameter.

    A fine-grained token with `Contents: Read-only` on the single repository is
    enough; it never needs write access.
  EOT
  type        = string
  default     = ""
}

variable "branch" {
  description = "Branch to deploy."
  type        = string
  default     = "main"
}

variable "web_ingress_cidrs" {
  description = <<-EOT
    Who may reach ports 80 and 443.

    Defaults to the whole internet because a test deployment usually needs to be
    shown to somebody. Narrow it to your office range if not — there is a
    Keycloak admin console on this box.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_ingress_cidrs" {
  description = <<-EOT
    Who may reach port 22. Empty by default, and the rule is not created at all
    when it is empty.

    Session Manager is attached to the instance role, so `aws ssm start-session`
    gets you a shell without opening SSH to anything.
  EOT
  type        = list(string)
  default     = []
}

variable "ssh_key_name" {
  description = "An existing EC2 key pair, if you want SSH as well as Session Manager."
  type        = string
  default     = null
}

variable "ses_from_email" {
  description = <<-EOT
    The address the platform sends from. Must be verified in SES.

    A new SES account is in the sandbox, where mail is only delivered to
    verified addresses — so registration and credential emails will appear to
    send and never arrive. Verify the recipients too, or request production
    access.
  EOT
  type        = string
}

variable "seed_demo_data" {
  description = <<-EOT
    Load the demo clubs, members and events on first boot.

    DELETES all application data before writing, so it runs only on the first
    boot of a new instance. Includes an administrator who runs two clubs, which
    is what exercises the organisation switcher.
  EOT
  type        = bool
  default     = true
}
