<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Quent MCP

Experimental Model Context Protocol bridge for a running Quent REST API. It is
a standalone proxy: enabling it does not add routes or dependencies to the
production query-engine server.

The tools mirror REST operations and return raw JSON facts:

- `list_engines`
- `get_engine`
- `list_engine_contexts`
- `list_query_groups`
- `list_queries`
- `get_query`
- `single_timeline`
- `bulk_timelines`
- `data_flow_timeline`
- `list_entities`

Deterministic summaries, rankings, joins, and comparisons belong in
`quent-cli`; interpretation belongs in the calling agent.

## Stdio

Start Quent's analyzer server, then configure an MCP client to run:

```sh
cargo run -p quent-mcp -- \
  --transport stdio \
  --api-base http://localhost:8080/api
```

Logs go to stderr because stdout carries the MCP protocol.

## Streamable HTTP

```sh
cargo run -p quent-mcp -- \
  --transport http \
  --api-base http://localhost:8080/api \
  --listen 127.0.0.1:8081
```

The endpoint is `http://127.0.0.1:8081/mcp`. The underlying MCP transport keeps
its loopback-only Host allowlist by default. For a non-local deployment, set
`QUENT_MCP_ALLOWED_HOSTS` to a comma-separated allowlist. Setting it to `*`
disables the check and should only be used behind an authenticating proxy.

Set `QUENT_MCP_CORS_ORIGIN` only when a browser MCP client needs access. The
bridge does not add authentication; do not expose it or the Quent API to
untrusted networks.

## Validation

```sh
cargo test -p quent-mcp
cargo clippy -p quent-mcp --all-targets -- -D warnings
```
