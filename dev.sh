#!/usr/bin/env bash
set -u

repo_root="$(cd "$(dirname "$0")" && pwd)"
backend_pid=""
frontend_pid=""

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [[ -n "$frontend_pid" ]]; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
  [[ -z "$backend_pid" ]] || wait "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || wait "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$repo_root/backend" && exec go run ./cmd/api) &
backend_pid=$!
(cd "$repo_root/frontend" && exec bun run dev) &
frontend_pid=$!

printf '前端: http://localhost:5173\n后端: http://127.0.0.1:8080\n按 Ctrl+C 停止前后端\n'

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done
