#!/bin/sh
if [ -x backend/.venv/bin/ruff ]; then
  backend/.venv/bin/ruff check --fix "$@"
elif command -v ruff >/dev/null 2>&1; then
  ruff check --fix "$@"
else
  echo "ruff is not installed; skip Python lint on this machine"
fi
