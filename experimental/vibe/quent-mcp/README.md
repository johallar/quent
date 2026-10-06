<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Quent MCP

Experimental Model Context Protocol bridge for a running Quent REST API. It is
a standalone proxy: enabling it does not add routes or dependencies to the
production query-engine server.

The bridge is optional. Start the analyzer and generate any test data first,
then run `quent-mcp` only when an agent needs MCP access.

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
pixi run cargo run -p quent-mcp -- \
  --transport stdio \
  --api-base http://localhost:8080/api
```

Logs go to stderr because stdout carries the MCP protocol.

## Streamable HTTP

```sh
pixi run cargo run -p quent-mcp -- \
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

## Quent Open

`quent-open` starts one companion MCP endpoint for each generated viewer and
prints both URLs:

```text
ready: MODEL — 1 context(s)  http://127.0.0.1:49152/
mcp: MODEL — 1 context(s)  (host)  http://127.0.0.1:49153/mcp
```

The endpoint uses the same bind host as its viewer and stops when the viewer
exits or `quent-open` receives Ctrl-C. `quent-open` prefers the MCP package from
the artifact's pinned Quent revision so its tools match that revision's REST
contract. When the pinned revision predates MCP, cannot build its MCP bridge, or
cannot start it, `quent-open` falls back to the host checkout's MCP
implementation. The source is shown as `(pinned-revision)` or `(host)`.

The host fallback is enabled by the default `quent-open` `mcp` feature. If the
pinned revision has no MCP and the host binary was built without that feature,
the viewer still starts and prints a warning instead of an `mcp:` URL.

## Validation

```sh
cargo test -p quent-mcp
cargo clippy -p quent-mcp --all-targets -- -D warnings
```
