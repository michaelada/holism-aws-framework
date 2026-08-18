#!/bin/bash
#
# First boot. Installs Docker, fetches the repository, obtains a certificate and
# hands over to scripts/deploy/bootstrap.sh.
#
# Runs exactly once, and its output is in /var/log/cloud-init-output.log. The
# Terraform sets `user_data_replace_on_change`, so editing this file replaces
# the instance rather than leaving a change that never runs.
set -euxo pipefail

exec > >(tee /var/log/holism-bootstrap.log) 2>&1

PUBLIC_URL="${public_url}"
PUBLIC_HOST="$(echo "$PUBLIC_URL" | sed -E 's#^https?://##; s#/.*##')"
# Space-separated, may be empty.
EXTRA_DOMAINS="${extra_domains}"

dnf update -y
dnf install -y docker git nginx openssl

# Docker's CLI plugins.
#
# Amazon Linux's `docker` package is the daemon and base CLI; it brings no
# compose plugin at all, and a buildx that is too old to be useful. Both are
# installed here into /usr/local/lib/docker/cli-plugins, which takes precedence
# over anything the distribution provides.
DOCKER_PLUGINS=/usr/local/lib/docker/cli-plugins
mkdir -p "$DOCKER_PLUGINS"

# Compose. Its assets are named by `uname -m` — `aarch64`, not `arm64`.
ARCH="$(uname -m)"
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$ARCH" \
  -o "$DOCKER_PLUGINS/docker-compose"
chmod +x "$DOCKER_PLUGINS/docker-compose"

# buildx, and it is **not optional**: `docker compose build` delegates to it
# and fails with "compose build requires buildx 0.17.0 or later" when it is too
# old. Amazon Linux ships 0.12.1, which is exactly too old — so this replaces
# it rather than installing something missing. A plugin in
# /usr/local/lib/docker/cli-plugins takes precedence over the packaged one.
#
# The version is **pinned, not discovered**. Resolving "latest" from the GitHub
# API cost a whole boot: `curl | grep -m1` makes curl die of EPIPE when grep
# stops reading, and under `set -e` with `pipefail` that failing pipeline ends
# the script — silently, three lines before Docker is even started. A pinned
# version has no network dependency beyond the download itself, no rate limit,
# and builds the same box every time. Bump it deliberately.
BUILDX_VERSION="v0.36.1"
BUILDX_ARCH=$([ "$ARCH" = "aarch64" ] && echo arm64 || echo amd64)

curl -fsSL "https://github.com/docker/buildx/releases/download/$BUILDX_VERSION/buildx-$BUILDX_VERSION.linux-$BUILDX_ARCH" \
  -o "$DOCKER_PLUGINS/docker-buildx"
chmod +x "$DOCKER_PLUGINS/docker-buildx"

systemctl enable --now docker
usermod -aG docker ec2-user

# Fail here, loudly, rather than three minutes later inside a build.
docker compose version
docker buildx version

# Swap.
#
# The peak memory here is the front-end build — four Vite bundles — not anything
# at run time. On a 2 GB instance it is killed part-way through with an error
# that blames esbuild rather than memory, so the swap goes on before the first
# build rather than after the first confusing failure.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------------------
# The application
# ---------------------------------------------------------------------------
install -d -o ec2-user -g ec2-user /opt/holism

GITHUB_TOKEN_PARAMETER="${github_token_parameter}"
REPO_URL="${repository_url}"

if [ -n "$GITHUB_TOKEN_PARAMETER" ]; then
  # ---------------------------------------------------------------------
  # Private repository.
  #
  # `set +x` first, and it matters: this script runs under `set -x`, so
  # every command is echoed to /var/log/holism-bootstrap.log and to the
  # cloud-init log. Fetching a token with tracing on would write it to both,
  # in plain text, on a box reachable from the internet.
  # ---------------------------------------------------------------------
  set +x
  GITHUB_TOKEN="$(aws ssm get-parameter \
      --name "$GITHUB_TOKEN_PARAMETER" \
      --with-decryption \
      --query Parameter.Value \
      --output text \
      --region "${aws_region}")"

  if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "None" ]; then
    set -x
    echo "Could not read $GITHUB_TOKEN_PARAMETER from SSM. Is the parameter there, and does the instance role allow it?" >&2
    exit 1
  fi

  AUTH_URL="$(echo "$REPO_URL" | sed -E "s#^https://#https://x-access-token:$GITHUB_TOKEN@#")"
  sudo -u ec2-user git clone --branch "${branch}" --depth 1 "$AUTH_URL" /opt/holism

  # The token would otherwise sit in .git/config for anyone on the box to
  # read, and would be pushed back out by any tooling that echoes the remote.
  sudo -u ec2-user git -C /opt/holism remote set-url origin "$REPO_URL"

  unset GITHUB_TOKEN AUTH_URL
  set -x
  echo "Cloned the private repository; the token is not stored on disk."
else
  sudo -u ec2-user git clone --branch "${branch}" --depth 1 "$REPO_URL" /opt/holism
fi

# The repository belongs to ec2-user, but bootstrap.sh and update.sh are run
# with sudo. Git refuses to operate on a repository owned by another user
# ("detected dubious ownership"), so root is told this one is expected.
git config --global --add safe.directory /opt/holism

# ---------------------------------------------------------------------------
# TLS
# ---------------------------------------------------------------------------
# The host's nginx terminates TLS and passes plain HTTP to the container on 80.
# Keeping the certificate outside the container means a renewal does not require
# rebuilding or restarting the application.
#
# A self-signed certificate first, so the box serves *something* even if DNS has
# not propagated yet and Let's Encrypt cannot validate. `certbot` replaces it
# when it succeeds.
mkdir -p /etc/nginx/tls
if [ ! -f /etc/nginx/tls/fullchain.pem ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/nginx/tls/privkey.pem \
    -out /etc/nginx/tls/fullchain.pem \
    -subj "/CN=$PUBLIC_HOST"
fi

# Every name that should reach this box, for the plain-HTTP block: the
# ACME challenge must be answerable on all of them or the certificate covers
# only some.
ALL_NAMES="$PUBLIC_HOST $EXTRA_DOMAINS"

cat > /etc/nginx/conf.d/holism.conf <<NGINX
server {
    listen 80;
    server_name $ALL_NAMES;

    # Certificate renewal has to be reachable over plain HTTP.
    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location / { return 301 https://\$host\$request_uri; }
}

NGINX

# The alternative names redirect to the canonical one rather than serving it.
#
# One origin is what keeps Keycloak simple: every client's redirect URIs and web
# origins name a single host, and a sign-in begun on www would otherwise return
# to a URI the realm does not list. Redirecting means www works without any of
# that being duplicated.
#
# Over TLS as well as plain HTTP, so the redirect itself does not produce a
# certificate warning — which is the whole reason the certificate covers these
# names too.
if [ -n "$EXTRA_DOMAINS" ]; then
cat >> /etc/nginx/conf.d/holism.conf <<NGINX

server {
    listen 443 ssl http2;
    server_name $EXTRA_DOMAINS;

    ssl_certificate     /etc/nginx/tls/fullchain.pem;
    ssl_certificate_key /etc/nginx/tls/privkey.pem;

    return 301 $PUBLIC_URL\$request_uri;
}
NGINX
fi

cat >> /etc/nginx/conf.d/holism.conf <<NGINX

server {
    listen 443 ssl http2;
    server_name $PUBLIC_HOST;

    ssl_certificate     /etc/nginx/tls/fullchain.pem;
    ssl_certificate_key /etc/nginx/tls/privkey.pem;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        # Keycloak builds every issuer and redirect URL from this. Without it,
        # it hands out http:// links from behind TLS and sign-in never
        # completes — a failure that looks like a broken application.
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port  443;
        proxy_read_timeout 120s;
    }
}
NGINX

mkdir -p /var/www/certbot
rm -f /etc/nginx/conf.d/default.conf
systemctl enable --now nginx

# ---------------------------------------------------------------------------
# A real certificate, before the application is built
# ---------------------------------------------------------------------------
# Deliberately ahead of the build, which is the slow and failure-prone part.
#
# It used to run last, and an instance whose build failed got no certificate
# either — two problems from one cause, and the second only discovered after
# the first was fixed by hand. Nothing here needs the application: the ACME
# challenge is answered by nginx, which is already up, from a directory on disk.
#
# Still non-fatal. A missing certificate should not stop the deployment.
# certbot is **not** in the Amazon Linux 2023 repositories.
#
# `dnf install -y certbot` fails there — AL2023 dropped EPEL and certbot was
# never packaged for it. Installed into its own virtualenv, the route AWS
# documents. Getting this wrong is silent: the stack comes up, the site serves
# on a self-signed certificate, and the only clue is `certbot: command not
# found` when somebody tries to fix it by hand.
dnf install -y python3 python3-pip augeas-libs
python3 -m venv /opt/certbot
/opt/certbot/bin/pip install --upgrade pip
/opt/certbot/bin/pip install certbot certbot-nginx
ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
# One certificate covering every name. Certbot fails the whole request if any
# one of them does not validate, so a name listed here must already resolve to
# this instance.
CERT_ARGS="-d $PUBLIC_HOST"
for d in $EXTRA_DOMAINS; do CERT_ARGS="$CERT_ARGS -d $d"; done

# Errors are no longer sent to /dev/null: a failure here used to be invisible
# in the log that exists to explain it.
if certbot certonly --webroot -w /var/www/certbot \
     $CERT_ARGS --non-interactive --agree-tos \
     --register-unsafely-without-email; then
  ln -sf "/etc/letsencrypt/live/$PUBLIC_HOST/fullchain.pem" /etc/nginx/tls/fullchain.pem
  ln -sf "/etc/letsencrypt/live/$PUBLIC_HOST/privkey.pem"   /etc/nginx/tls/privkey.pem
  nginx -t && systemctl reload nginx

  # A pip-installed certbot brings no systemd timer, so renewal is a cron entry.
  # Twice daily is what certbot recommends; it exits quietly when nothing is
  # near expiry.
  echo "0 0,12 * * * root /opt/certbot/bin/certbot renew -q --deploy-hook 'systemctl reload nginx'" \
    > /etc/cron.d/certbot-renew
  echo "Certificate obtained for: $CERT_ARGS"
else
  # Non-fatal on purpose — the application should be up whether or not a
  # certificate could be issued — but no longer silent.
  echo "!! No certificate. The self-signed one is in use and browsers will warn." >&2
  echo "!! Usually DNS not yet resolving here, or a name in extra_domains that" >&2
  echo "!! does not. Retry with:" >&2
  echo "!!   sudo certbot certonly --webroot -w /var/www/certbot $CERT_ARGS" >&2
fi

# ---------------------------------------------------------------------------
# Bring the stack up
# ---------------------------------------------------------------------------
# The container publishes on 8080 and only on the loopback, because the host's
# nginx holds 80 and 443 to terminate TLS. Nothing reaches the container except
# through that, so the application is never served without TLS.
# Recorded so scripts/deploy/update.sh can fetch the token the same way when
# pulling a new version. The *name*, never the token.
cat > /opt/holism/.deploy-source <<SOURCE
GITHUB_TOKEN_PARAMETER=$GITHUB_TOKEN_PARAMETER
REPOSITORY_URL=$REPO_URL
BRANCH=${branch}
AWS_REGION=${aws_region}
SOURCE
chown ec2-user:ec2-user /opt/holism/.deploy-source

cd /opt/holism
WEB_PUBLISH="127.0.0.1:8080" \
PUBLIC_URL="$PUBLIC_URL" \
PUBLIC_HOST="$PUBLIC_HOST" \
SES_FROM_EMAIL="${ses_from_email}" \
AWS_REGION="${aws_region}" \
SEED_DEMO_DATA="${seed_demo_data}" \
  ./scripts/deploy/bootstrap.sh


echo "Bootstrap finished. Application at $PUBLIC_URL"
