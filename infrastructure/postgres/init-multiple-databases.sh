#!/bin/bash
#
# Create the extra databases named in POSTGRES_MULTIPLE_DATABASES.
#
# Keycloak needs a database of its own, and on a single-instance deployment it
# shares this Postgres rather than running a second server — the memory saved is
# worth more than the isolation on a box this size.
#
# Runs once, on an empty data directory. An existing volume never re-runs it,
# which is why the CREATE is guarded rather than assumed.
set -euo pipefail

create_database() {
    local database="$1"
    echo "  creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
         WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "Additional databases requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
        create_database "$db"
    done
fi
