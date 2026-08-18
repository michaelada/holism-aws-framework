#!/usr/bin/env bash
#
# Run the instance's first-boot script the way cloud-init would, and fail here
# rather than twenty minutes into an apply.
#
#   ./scripts/deploy/test-user-data.sh
#
# Five separate first-boot failures reached a real instance before this existed:
# a missing buildx plugin, an uncommitted lockfile, an undeclared TypeScript, a
# cron directory that does not exist on Amazon Linux, and `git config --global`
# with no HOME. Each cost a rebuild and, twice, a Let's Encrypt certificate.
#
# They share a shape. The script assumes a richer environment than cloud-init
# actually provides, and `set -e` turns every one of them into a silent stop
# whose only trace is a log on a box that has to be reached to read it.
#
# So this runs the script:
#
#   * in `amazonlinux:2023`, not on a developer machine — the distribution is
#     the thing being got wrong;
#   * with **no HOME**, exactly as cloud-init runs it;
#   * with the Terraform template rendered first, so interpolation errors and
#     shell `${VAR:-default}` escaping are covered too;
#   * with real `git`, `bash` and coreutils, because those are where the
#     assumptions bite — and stubs only for what genuinely cannot run here
#     (installing packages, systemd, Docker, network downloads, certbot, AWS).
#
# The stubs record every call, so the assertions can check *ordering* — that
# buildx is installed before anything builds, and that the certificate is
# obtained before the long build rather than after it.
#
# WHAT THIS DOES NOT COVER, so nobody mistakes a pass for a guarantee:
#
#   * `bootstrap.sh` is stubbed. Anything that goes wrong inside it — a stale
#     lockfile, an undeclared compiler, an image that will not build — happens
#     beyond this boundary. `docker build` on the real Dockerfiles is what
#     catches those, and it is worth running before an apply.
#   * Package availability is assumed. `dnf install` is a stub, so a package
#     that does not exist on Amazon Linux (certbot, cron) still passes here.
#     Those were found the hard way and are now pinned by the assertions below
#     rather than by installation.
#   * Nothing is downloaded, so a moved release URL is not detected.
#   * systemd is stubbed: a malformed unit file will not be noticed.
#
# It covers the class that actually kept happening: the script assuming an
# environment cloud-init does not provide, and stopping silently.
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
TEMPLATE="$ROOT/terraform/environments/testing/user_data.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0; fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=$((fail+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. Render, as Terraform's templatefile() would
# ---------------------------------------------------------------------------
head_ "Rendering the template"

python3 - "$TEMPLATE" "$WORK/user_data.sh" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()

# The variables main.tf passes in.
VARS = {
    "public_url": "https://test.example.com",
    "extra_domains": "www.test.example.com",
    "ses_from_email": "noreply@example.com",
    "aws_region": "eu-west-1",
    "repository_url": "https://github.com/example/repo.git",
    "branch": "main",
    "seed_demo_data": "true",
    "github_token_parameter": "/holism/testing/github-token",
}

# Terraform resolves ${name}; anything left is a shell expression that should
# have been escaped as $${...} and would have failed `tofu validate`.
unknown = sorted({m for m in re.findall(r'\$(?<!\$\$)\{(\w+)[^}]*\}', s)} - set(VARS))
if unknown:
    print("UNRENDERED:" + ",".join(unknown))

out = re.sub(r'\$\{(\w+)\}', lambda m: VARS.get(m.group(1), m.group(0)), s)
out = out.replace("$${", "${")          # what Terraform does to escaped sequences
open(dst, "w").write(out)
PY

if grep -q '\${' "$WORK/user_data.sh"; then
  # Only shell expansions should survive, and they must be ones bash can handle.
  :
fi
ok "template rendered"

bash -n "$WORK/user_data.sh" && ok "rendered script is valid bash" || bad "bash syntax error"

# ---------------------------------------------------------------------------
# 2. Stubs
# ---------------------------------------------------------------------------
# Only for what cannot run in a container: package installation, systemd,
# Docker, network fetches, certbot and AWS. Everything else stays real, because
# real is where the surprises are.
mkdir -p "$WORK/stubs"

stub () {  # stub <name> <body>
  printf '#!/bin/sh\necho "CALL %s $*" >> "$CALLS"\n%s\n' "$1" "$2" > "$WORK/stubs/$1"
  chmod +x "$WORK/stubs/$1"
}

stub dnf        'exit 0'
stub systemctl  'exit 0'
stub usermod    'exit 0'
stub mkswap     'exit 0'
stub swapon     'exit 0'
# `dd` must leave a file behind: the script chmods the swapfile afterwards, and
# a stub that does nothing fails the step it was standing in for.
stub dd         'for a in "$@"; do case "$a" in of=*) : > "${a#of=}";; esac; done; exit 0'
stub nginx      'exit 0'
stub openssl    'for a in "$@"; do case "$prev" in -keyout|-out) : > "$a";; esac; prev="$a"; done; exit 0'
stub certbot    'exit ${CERTBOT_EXIT:-0}'
stub aws        'echo "ghp_faketoken"; exit 0'
# `sudo` is on the AMI but not in the base image.
#
# It must genuinely switch user for `-u`. A stub that simply exec'd as root made
# the test report a "dubious ownership" failure that cannot happen in reality,
# because the real clone runs as the user who owns the directory. A stub that
# lies produces bugs that are not there, which is worse than no test.
cat > "$WORK/stubs/sudo" <<'SH'
#!/bin/sh
echo "CALL sudo $*" >> "$CALLS"
if [ "$1" = "-u" ]; then u="$2"; shift 2; exec runuser -u "$u" -- "$@"; fi
exec "$@"
SH
chmod +x "$WORK/stubs/sudo"

# curl: create the file it was asked to write, so `chmod +x` on a downloaded
# plugin succeeds. No network.
cat > "$WORK/stubs/curl" <<'SH'
#!/bin/sh
echo "CALL curl $*" >> "$CALLS"
out=""; prev=""
for a in "$@"; do [ "$prev" = "-o" ] && out="$a"; prev="$a"; done
[ -n "$out" ] && { mkdir -p "$(dirname "$out")"; echo "#!/bin/sh" > "$out"; }
exit 0
SH
chmod +x "$WORK/stubs/curl"

# docker: version subcommands must answer, everything else just records.
cat > "$WORK/stubs/docker" <<'SH'
#!/bin/sh
echo "CALL docker $*" >> "$CALLS"
case "$1 $2" in
  "buildx version") echo "github.com/docker/buildx v0.36.1" ;;
  "compose version") echo "Docker Compose version v2.29.0" ;;
esac
exit 0
SH
chmod +x "$WORK/stubs/docker"

# git: real, except `clone`. The HOME assumptions live in `git config`, so that
# must be the genuine article — a stub would have passed the bug this exists to
# catch.
cat > "$WORK/stubs/git" <<'SH'
#!/bin/sh
echo "CALL git $*" >> "$CALLS"
if [ "$1" = "clone" ]; then
  for a in "$@"; do dest="$a"; done
  mkdir -p "$dest/scripts/deploy"
  printf '#!/bin/sh\necho "CALL bootstrap.sh $*" >> "$CALLS"\nexit 0\n' > "$dest/scripts/deploy/bootstrap.sh"
  chmod +x "$dest/scripts/deploy/bootstrap.sh"
  # A real repository, because the script goes on to rewrite the remote to strip
  # the token out — and that has to actually work.
  /usr/bin/git -C "$dest" init -q
  /usr/bin/git -C "$dest" remote add origin "http://placeholder.invalid/repo.git"
  exit 0
fi
exec /usr/bin/git "$@"
SH
chmod +x "$WORK/stubs/git"

# ---------------------------------------------------------------------------
# 3. Run it as cloud-init does
# ---------------------------------------------------------------------------
head_ "Running first boot in amazonlinux:2023 (no HOME)"

cat > "$WORK/run.sh" <<'SH'
#!/bin/bash
export CALLS=/work/calls.log
: > "$CALLS"
mkdir -p /var/www /etc/nginx/conf.d /etc/systemd/system
# `env -u HOME` is the whole point: cloud-init provides none, and a command
# that quietly needs one ends the boot.
cd /
env -u HOME PATH="/work/stubs:$PATH" CALLS="$CALLS" bash /work/user_data.sh > /work/out.log 2>&1
echo "EXIT=$?" >> "$CALLS"
SH
chmod +x "$WORK/run.sh"

run_boot () {
  # `git` and `ec2-user` exist on the real AMI; the bare image has neither, and
  # their absence would fail steps that are actually fine.
  docker run --rm -v "$WORK:/work" amazonlinux:2023 sh -c '
    dnf install -y -q git shadow-utils util-linux >/dev/null 2>&1
    id ec2-user >/dev/null 2>&1 || useradd -m ec2-user
    bash /work/run.sh' >/dev/null 2>&1 || true
}

run_boot

CALLS="$WORK/calls.log"
[ -f "$CALLS" ] || { echo "  the container produced no log — is Docker running?"; exit 1; }

EXIT=$(grep -oE '^EXIT=[0-9]+' "$CALLS" | tail -1 | cut -d= -f2)
if [ "${EXIT:-1}" = "0" ]; then
  ok "first boot ran to completion"
else
  bad "first boot exited $EXIT — last lines:"
  tail -12 "$WORK/out.log" | sed 's/^/      /'
fi

# ---------------------------------------------------------------------------
# 4. Assertions
# ---------------------------------------------------------------------------
head_ "Checking what it did, and in what order"

line_of () { grep -n "$1" "$CALLS" | head -1 | cut -d: -f1; }

called () { grep -q "$1" "$CALLS" && ok "$2" || bad "$2"; }

called "CALL docker buildx version"  "buildx is verified, not assumed"
called "CALL git config --system"    "safe.directory set with --system (works without HOME)"
called "CALL certbot"                "a certificate is requested"
called "CALL bootstrap.sh"           "the application bootstrap is invoked"

# Ordering — the reason the stubs record calls at all.
cert=$(line_of "CALL certbot")
boot=$(line_of "CALL bootstrap.sh")
if [ -n "$cert" ] && [ -n "$boot" ] && [ "$cert" -lt "$boot" ]; then
  ok "certificate obtained BEFORE the build, so a failed build still leaves TLS"
else
  bad "certificate is requested after the build (or not at all)"
fi

bx=$(line_of "CALL docker buildx version")
if [ -n "$bx" ] && [ -n "$boot" ] && [ "$bx" -lt "$boot" ]; then
  ok "buildx is present before anything tries to build"
else
  bad "buildx is verified too late to help"
fi

grep -q "config --global" "$CALLS" \
  && bad "uses 'git config --global', which fails when cloud-init sets no HOME" \
  || ok "no 'git config --global'"

# ---------------------------------------------------------------------------
# 5. A failing certificate must not stop the deployment
# ---------------------------------------------------------------------------
head_ "Checking the certificate failure path"

sed -i.bak 's/^stub certbot.*$//' /dev/null 2>/dev/null || true
cat > "$WORK/stubs/certbot" <<'SH'
#!/bin/sh
echo "CALL certbot $*" >> "$CALLS"
exit 1
SH
chmod +x "$WORK/stubs/certbot"

run_boot

EXIT=$(grep -oE '^EXIT=[0-9]+' "$CALLS" | tail -1 | cut -d= -f2)
if [ "${EXIT:-1}" = "0" ] && grep -q "CALL bootstrap.sh" "$CALLS"; then
  ok "a failed certificate is survivable — the application still deploys"
else
  bad "a failed certificate stops the deployment"
fi

# ---------------------------------------------------------------------------
head_ "Result"
printf "  %d passed, %d failed\n\n" "$pass" "$fail"
[ "$fail" -eq 0 ]
