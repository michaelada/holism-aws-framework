# Deploying the whole platform to one EC2 instance

For testing. Roughly **$20–33/month**, against **$145/month** for the
[staging environment](../terraform/environments/staging/COST_ESTIMATE.md) that
models a real deployment.

## Why one instance is enough

Everything already runs in one `docker compose` — Postgres, Keycloak, the API,
nginx. The staging environment's cost is almost entirely *architecture*, not
capacity:

| | staging | here | why |
|---|---|---|---|
| NAT gateway | ~$33 | — | the instance sits in a public subnet |
| RDS | ~$35 | — | Postgres is a container on the same box |
| Load balancer | ~$22 | — | nginx is already in the stack |
| Monitoring instance | ~$15 | — | Prometheus and Grafana are optional |
| CloudWatch | ~$19 | — | container logs |
| Instance | ~$15 | ~$27 | one, slightly larger |

**What you give up:** no redundancy, the database lives on the instance's root
volume, and everything stops when the instance stops. All acceptable for
testing; none of it acceptable for real data — use `staging/` for that.

## Cost

Indicative eu-west-1 on-demand; check current rates.

| | t4g.small (2 GB) | t4g.medium (4 GB) |
|---|---|---|
| Instance | ~$13 | ~$27 |
| 30 GB gp3 | ~$2.60 | ~$2.60 |
| Elastic IP | ~$3.60 | ~$3.60 |
| **Total** | **~$19/month** | **~$33/month** |

Stopped between sessions you pay for the volume and the address only — about
**$6/month**. `t4g.medium` is the recommendation: memory is the binding
constraint, and the front-end build is the peak.

Graviton (`t4g`) is ~20% cheaper than `t3` and every image here is
multi-architecture, so there is nothing to give up.

## A private repository

The instance clones the repository and builds from source, so it needs read
access. The token is kept out of Terraform entirely — a variable holding it
would be written to the state file in plain text, and passing it through
`user_data` would put it where anything on the box can read it through the
instance metadata service.

Create the parameter once, yourself:

```bash
aws ssm put-parameter \
  --name /holism/testing/github-token \
  --type SecureString \
  --value ghp_your_token \
  --region eu-west-1
```

A **fine-grained** token with `Contents: Read-only` on that one repository is
enough — it never needs write access. Then name it in `terraform.tfvars`:

```hcl
github_token_ssm_parameter = "/holism/testing/github-token"
```

Terraform grants the instance role permission to read **that one parameter** and
nothing else. At boot the token is fetched with tracing disabled — the script
otherwise runs under `set -x` and would echo it into two log files — used for
the clone, and then removed from the remote URL so it does not sit in
`.git/config`.

Because the remote is stored without credentials, a plain `git pull` on the box
will hang asking for a password. Use the update script instead, which fetches
the token the same way:

```bash
cd /opt/holism && ./scripts/deploy/update.sh
```

That rebuilds, migrates and restarts. It leaves the database and the Keycloak
realm alone.

## Deploying

```bash
cd terraform/environments/testing
cp terraform.tfvars.example terraform.tfvars   # set public_url, repository_url, ses_from_email
tofu init && tofu apply
```

Then point a DNS A record at the `public_ip` it outputs. The instance builds and
starts everything on first boot; watch it with:

```bash
aws ssm start-session --target <instance_id>
sudo tail -f /var/log/holism-bootstrap.log
```

Fifteen to twenty minutes on a `t4g.medium`, most of it building four Vite
bundles.

### If DNS was not ready

The certificate step is deliberately last and deliberately non-fatal: the stack
comes up on a self-signed certificate and you get a browser warning. Once DNS
resolves:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d <your host>
sudo systemctl reload nginx
```

## How it fits together

```
        :443 ─ host nginx ─ TLS ─┐
                                 │  127.0.0.1:8080
                          ┌──────▼──────┐
                          │  web        │  nginx + the four built bundles
                          │             │  /account /orgadmin /admin /metadata
                          └──┬───────┬──┘
                    /api/    │       │   /auth/
                       ┌─────▼──┐ ┌──▼────────┐
                       │ backend│ │ keycloak  │
                       └────┬───┘ └─────┬─────┘
                            └─────┬─────┘
                             ┌────▼────┐
                             │postgres │  two databases, one server
                             └─────────┘
```

**One origin for everything.** The bundles call `/api` relatively and Keycloak
lives at `/auth`, so there is no CORS to configure and one certificate covers
it.

## Things that will bite you

**The front-end bundles are built for one hostname.** `PUBLIC_URL` is compiled
into them, so changing it means rebuilding the `web` image. It is also in
Keycloak's issuer URLs and every client's redirect URIs.

**The realm is imported once.** Keycloak reads `realm-import.rendered.json` only
when the realm does not exist. Regenerating the secrets afterwards leaves the
realm holding one set and the backend using another, which presents as *"sign-in
works but every API call is 401"*. `bootstrap.sh` therefore generates them once
and refuses to re-render.

**`KC_PROXY_HEADERS` is not optional.** Without it Keycloak builds `http://`
redirect URLs from behind TLS and the sign-in loop never closes — a failure that
looks like a broken application rather than a misconfigured proxy.

**SES starts in the sandbox.** A new account only delivers to *verified*
addresses, so registration and credential emails appear to send and never
arrive. Verify the recipients, or request production access.

**Stripe keys must be test keys.** Payments refuse without them, which is fine;
a test deployment taking real money is not.

**The database is on the root volume.** Snapshot it before replacing the
instance:

```bash
aws ec2 create-snapshot --volume-id <root volume> --description "before rebuild"
```

## Running it by hand

The AWS instance is not special — the same three files work on any Docker host:

```bash
PUBLIC_URL=https://test.example.com \
SES_FROM_EMAIL=noreply@example.com \
SEED_DEMO_DATA=true \
  ./scripts/deploy/bootstrap.sh
```

Afterwards:

```bash
C="docker compose -f docker-compose.deploy.yml --env-file .env.deploy"

$C logs -f backend
$C restart backend
$C --profile tools run --rm tools npx node-pg-migrate up -m migrations
$C --profile tools run --rm tools npm run seed:demo -- --reset --no-stripe
```

The `tools` service exists because the production backend image installs
`--only=production` and copies only `dist` and `migrations` — it has neither
`node-pg-migrate` nor the seed scripts.

## What the demo data gives you

With `seed_demo_data = true`: four pony clubs, members, events, memberships,
bookings, a shop, and — deliberately — **an administrator who runs two of them**
(`admin@kildarehunt.test`), which is what exercises the organisation switcher.
Seeded password `Passw0rd!`.

The seed refuses to run against a non-local database or Keycloak. Both are local
to this box, so it works here and cannot be aimed at anything else.

## Files

| | |
|---|---|
| `terraform/environments/testing/` | the instance, network, and first-boot script |
| `docker-compose.deploy.yml` | the stack, distinct from the development one |
| `Dockerfile.web` | builds the four front ends, serves them from nginx |
| `infrastructure/nginx/deploy.conf` | the single-origin layout |
| `infrastructure/keycloak/realm-import.json` | realm, clients, audience mappers |
| `scripts/deploy/bootstrap.sh` | secrets, realm rendering, migrations, start |
| `.env.deploy.example` | the shape of the generated configuration |
