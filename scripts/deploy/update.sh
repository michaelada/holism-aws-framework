#!/usr/bin/env bash
#
# Pull a new version and restart.
#
#   cd /opt/holism && ./scripts/deploy/update.sh
#
# Fetches the GitHub token from SSM for the duration of the pull and does not
# leave it on disk — the remote is stored without credentials on purpose, so a
# plain `git pull` on a private repository will ask for a password and hang.
# This is the way to update.
#
# Keeps the database and the Keycloak realm exactly as they are. It rebuilds
# images and runs migrations; it never re-imports the realm or re-seeds.
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
ENV_FILE="$ROOT/.env.deploy"
SOURCE_FILE="$ROOT/.deploy-source"

COMPOSE="docker compose -f docker-compose.deploy.yml --env-file $ENV_FILE"
TOOLS="$COMPOSE --profile tools run --rm tools"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31m\n  ✖ %s\n\n\033[0m' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "No $ENV_FILE — has this instance been bootstrapped?"

# Git refuses to touch a repository owned by somebody else — and this one is
# owned by ec2-user while this script is normally run with sudo, so every git
# command here would fail with "detected dubious ownership". Declaring it safe
# is the documented fix. `--system` rather than `--global`, so it works whether
# or not HOME is set — cloud-init sets none, and that broke a boot.
#
# Written without a pipeline on purpose. `git config --get-all` exits non-zero
# when the key is unset, and `grep -q` closes the pipe early; under
# `set -e`/`pipefail` that combination is exactly what killed a boot earlier in
# this deployment. A variable and a `case` cannot fail.
SAFE_DIRS="$(git config --system --get-all safe.directory 2>/dev/null || true)"
case "$SAFE_DIRS" in
  *"$ROOT"*) ;;
  *) git config --system --add safe.directory "$ROOT" ;;
esac

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
BRANCH="main"
GITHUB_TOKEN_PARAMETER=""
REPOSITORY_URL=""
AWS_REGION="${AWS_REGION:-eu-west-1}"
# Written by the instance's first boot: the parameter *name*, never the token.
[ -f "$SOURCE_FILE" ] && . "$SOURCE_FILE"

log "Fetching $BRANCH"
if [ -n "$GITHUB_TOKEN_PARAMETER" ]; then
  # Tracing is off in this script, but be explicit: nothing below may echo the
  # token, and it is never written anywhere.
  GITHUB_TOKEN="$(aws ssm get-parameter \
      --name "$GITHUB_TOKEN_PARAMETER" \
      --with-decryption --query Parameter.Value --output text \
      --region "$AWS_REGION")"
  [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "None" ] \
    || die "Could not read $GITHUB_TOKEN_PARAMETER from SSM."

  AUTH_URL="$(echo "$REPOSITORY_URL" | sed -E "s#^https://#https://x-access-token:$GITHUB_TOKEN@#")"
  git fetch "$AUTH_URL" "$BRANCH"
  unset GITHUB_TOKEN AUTH_URL
else
  git fetch origin "$BRANCH"
fi

git reset --hard FETCH_HEAD
echo "  now at $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

# ---------------------------------------------------------------------------
# Rebuild and restart
# ---------------------------------------------------------------------------
# The front-end bundles carry PUBLIC_URL, so `web` is rebuilt whenever anything
# changes rather than only when its Dockerfile does.
#
# `--profile tools` matters. Compose only builds services whose profiles are
# active, and `tools` is behind one — so a plain `$COMPOSE build` rebuilt the
# application and left the tools image exactly as first boot created it. The
# migrations are baked into that image, so `node-pg-migrate up` below ran
# against a months-old copy of the directory, found nothing new to do, reported
# "Migrations complete!" and returned 0. On itsps.org that silently held the
# database at migration 029 through every deployment after the first, while the
# code moved on — which surfaced as the audit log 500ing on a table no migration
# had ever created.
log "Rebuilding"
$COMPOSE --profile tools build

log "Migrating"
$TOOLS npx node-pg-migrate up -m migrations

log "Restarting"
$COMPOSE up -d

log "Done"
$COMPOSE ps
echo
echo "  Realm and database untouched. To re-seed (DESTRUCTIVE):"
echo "    $TOOLS npm run seed:demo -- --reset --no-stripe"
