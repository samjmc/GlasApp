#!/bin/sh
# Build and (re)start GlasApp on a host whose Caddy is already running (deploy/compose.shared-proxy.yml,
# docs/deploy.md "Behind a Caddy that is already on the host"). Run on the host from any directory:
#   sh deploy/up.sh           build and start (or restart with the new code)
#   sh deploy/up.sh check     only validate the compose files and show the container state
set -eu
cd "$(dirname "$0")/.."

ENV_FILE=deploy/glasapp.env
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE: copy deploy/glasapp.env.example and fill it in (docs/deploy.md, section 1)." >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f deploy/compose.yml -f deploy/compose.shared-proxy.yml "$@"
}

compose config -q
if [ "${1:-}" != "check" ]; then
  compose up -d --build
fi
compose ps
