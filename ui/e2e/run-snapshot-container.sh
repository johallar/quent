#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail
shopt -s nullglob

restore_snapshot_ownership() {
  if [[ "${HOST_UID:-}" =~ ^[0-9]+$ && "${HOST_GID:-}" =~ ^[0-9]+$ ]]; then
    local snapshot_dirs=(/quent/ui/e2e/*-snapshots)
    ((${#snapshot_dirs[@]} == 0)) || chown -R "$HOST_UID:$HOST_GID" "${snapshot_dirs[@]}"
  fi
}

trap restore_snapshot_ownership EXIT

pnpm --dir /quent/ui exec playwright test --update-snapshots=all "$@"
