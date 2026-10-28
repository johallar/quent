<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Question CLI

Experimental Quent CLI for answering registered profiling questions, comparing
query bundles, and opening supporting evidence in the UI.

This project has the unstable, agent-authored status described by the parent
[`vibe`](../README.md) directory.

## Setup

From the repository root:

```sh
pixi run pnpm --dir experimental/vibe/quent-cli install
```

## Usage

Launch the interactive command selector:

```sh
pixi run pnpm --dir experimental/vibe/quent-cli ask --help
```

Answer the initial resource question:

```sh
pixi run pnpm --dir experimental/vibe/quent-cli ask longest-resource-users
```

Compare query bundles:

```sh
pixi run pnpm --dir experimental/vibe/quent-cli ask query-diff
```

`--json` controls the output format; question commands still open the selector
when IDs are omitted. Pass explicit IDs with `--json` for non-interactive
automation. Discovery commands are available for engines and queries:

```sh
pixi run pnpm --silent --dir experimental/vibe/quent-cli ask engines --json
pixi run pnpm --silent --dir experimental/vibe/quent-cli ask queries \
  --engine ENGINE_ID --json
```

See [Question-driven CLI plan](./question-cli-plan.md) and
[Query diff CLI](./query-diff-cli.md) for the detailed contracts.

## Validation

```sh
pixi run pnpm --dir experimental/vibe/quent-cli check
```
