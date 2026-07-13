#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker/docker-compose.dev.yml"
POSTGRES_PORT=55432
POSTGRES_TIMEOUT=30

SKIP_BUILD=false
SKIP_SERVICES=false
NO_DEV=false

log() {
  echo "==> $*"
}

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: ./config-dev.sh [options]

Options:
  --skip-build      Skip building workspace packages
  --skip-services   Skip starting Docker services and Postgres readiness check
  --no-dev          Run setup only; do not start yarn dev
  -h, --help        Show this help message
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skip-build)
        SKIP_BUILD=true
        ;;
      --skip-services)
        SKIP_SERVICES=true
        ;;
      --no-dev)
        NO_DEV=true
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1 (run with --help)"
        ;;
    esac
    shift
  done
}

check_prerequisites() {
  log "Checking prerequisites"

  command -v node >/dev/null 2>&1 || die "node is required (>= 20)"
  command -v yarn >/dev/null 2>&1 || die "yarn is required (>= 4.9)"
  command -v docker >/dev/null 2>&1 || die "docker is required"

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$node_major" -lt 20 ]]; then
    die "node >= 20 is required (found $(node -v))"
  fi

  if ! docker info >/dev/null 2>&1; then
    die "docker daemon is not running"
  fi
}

install_dependencies() {
  if [[ ! -d node_modules ]]; then
    log "Installing dependencies"
    yarn install --immutable
  else
    log "Dependencies already installed"
  fi
}

copy_env_if_missing() {
  local env_files=(
    "apps/api/.env"
    "packages/db/.env"
    "apps/web/.env"
    "apps/wiki/.env"
  )

  log "Ensuring environment files exist"

  for env_file in "${env_files[@]}"; do
    if [[ ! -f "$env_file" ]]; then
      if [[ ! -f "${env_file}.example" ]]; then
        die "missing ${env_file}.example"
      fi
      cp "${env_file}.example" "$env_file"
      log "Created $env_file from example"
    fi
  done
}

start_services() {
  log "Starting infrastructure services"
  yarn services:up
}

wait_for_postgres() {
  log "Waiting for PostgreSQL on localhost:${POSTGRES_PORT} (timeout: ${POSTGRES_TIMEOUT}s)"

  local elapsed=0
  while [[ "$elapsed" -lt "$POSTGRES_TIMEOUT" ]]; do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      log "PostgreSQL is ready"
      return 0
    fi

    if command -v nc >/dev/null 2>&1 && nc -z localhost "$POSTGRES_PORT" >/dev/null 2>&1; then
      log "PostgreSQL port is open"
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  die "PostgreSQL did not become ready within ${POSTGRES_TIMEOUT}s"
}

setup_database() {
  log "Generating Prisma client"
  yarn workspace @plunk/db db:generate

  log "Applying database migrations"
  yarn workspace @plunk/db migrate:dev
}

generate_wiki_docs() {
  log "Generating wiki OpenAPI docs (required for yarn build)"
  yarn workspace wiki generate-docs
}

build_workspace_packages() {
  log "Building API workspace dependencies"
  yarn build --filter="api..."
}

start_dev_servers() {
  log "Starting development servers"
  yarn dev
}

main() {
  parse_args "$@"

  check_prerequisites
  install_dependencies
  copy_env_if_missing

  if [[ "$SKIP_SERVICES" == false ]]; then
    start_services
    wait_for_postgres
  else
    log "Skipping Docker services"
  fi

  setup_database
  generate_wiki_docs

  if [[ "$SKIP_BUILD" == false ]]; then
    build_workspace_packages
  else
    log "Skipping workspace build"
  fi

  if [[ "$NO_DEV" == true ]]; then
    log "Setup complete (--no-dev)"
    exit 0
  fi

  start_dev_servers
}

main "$@"
