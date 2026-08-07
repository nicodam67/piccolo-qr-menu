#!/bin/sh
set -eu

node /app/migrate-production.cjs

exec "$@"
