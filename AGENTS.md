# Hatchet Development Guide

## Cursor Cloud specific instructions

### Overview

Hatchet is a distributed task queue and workflow orchestration platform. The monorepo contains:
- **Go backend**: API server (`cmd/hatchet-api`, port 8080) and Engine (`cmd/hatchet-engine`, gRPC on port 7070)
- **React frontend**: Vite-based dashboard (`frontend/app`, port 5173)
- **SDKs**: Go, TypeScript, Python, Ruby (under `sdks/`)
- **CLI**: `cmd/hatchet-cli`

### Standard commands

All build/test/lint/run commands are defined in `Taskfile.yaml`. Always prefer `task <name>` over raw commands. See the workspace rule at `.cursor/rules/taskfile.mdc`.

### Infrastructure

Docker Compose manages Postgres (port 5431), PgBouncer (port 6431), and RabbitMQ (port 5672):
```
task start-db          # docker compose up -d
task stop-db           # docker compose down
```

### Starting services

After infrastructure is up and `task setup` has been run:
```
# In separate terminals/tmux panes:
set -a && . .env && set +a && go run ./cmd/hatchet-engine --no-graceful-shutdown
set -a && . .env && set +a && go run ./cmd/hatchet-api
cd frontend/app && pnpm run dev
```

Or use `task start-dev` / `task start-dev-tmux` (the latter uses tmux; the former requires Caddy for HTTPS).

### Gotchas

- **Cookie domain**: The `.env` sets `SERVER_AUTH_COOKIE_DOMAIN=app.dev.hatchet-tools.com`. To log into the dashboard, access via `http://app.dev.hatchet-tools.com:5173/` (not `localhost`). Add `127.0.0.1 app.dev.hatchet-tools.com` to `/etc/hosts` first (`task set-etc-hosts`).
- **Vite proxy**: The frontend's `vite.config.ts` proxies `/api` requests to `http://127.0.0.1:8080`, so Caddy is not strictly required for local development.
- **First Go compile**: Initial `go run` of engine/API takes several minutes due to compilation. Subsequent runs use the build cache.
- **Pre-commit golangci-lint**: The pre-commit hook pins its own golangci-lint version (v2.8.0 via `.pre-commit-config.yaml`). If your system Go version is newer than the hook's bundled binary supports, the hook may fail. The standalone `task lint-go` uses the system-installed golangci-lint and works independently.
- **Go lint issues**: `task lint-go` may report pre-existing issues in the codebase; these are not caused by your changes.
- **Default credentials**: After `task setup` + `task seed-dev`, log in with `admin@example.com` / `Admin123!!`.
- **Client tokens**: Generate SDK client credentials with `task init-dev-env`. Pipe to a `.env` file for examples: `task init-dev-env | tee ./examples/go/simple/.env`.
- **Docker in Cloud Agent VMs**: Requires `fuse-overlayfs` storage driver and `iptables-legacy`. See the Docker DinD setup in the system instructions.
