<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Deep links

Quent deep links are snapshots created by the **Copy Link** action. Opening a snapshot restores
its saved state, but subsequent interactions do not rewrite the browser URL.

Deep links store the route and the non-default state needed to reconstruct the shared view:

```json
{
  "route": {
    "engineId": "engine-a",
    "queryId": "query-a",
    "tab": "operators"
  },
  "timeline": {
    "zoomRange": {
      "start": 12.5,
      "end": 48.75
    }
  },
  "selection": {
    "planId": "plan-a",
    "operatorNodeIds": ["operator-a"]
  },
  "resources": {
    "expandedRowIds": ["resource-a"],
    "rootResourceType": "channel"
  },
  "dag": {
    "nodeColorField": "duration_s"
  },
  "dataFlow": {
    "measure": "bytes",
    "dimensions": ["filesystem"]
  },
  "operatorTable": {
    "enabledGroups": ["partition", "item_type"],
    "visibleStats": ["duration_s", "spill_bytes"],
    "aggregation": "sum",
    "sort": [{ "id": "spill_bytes", "desc": true }]
  }
}
```

The zoom and playhead values are seconds relative to the query start. Engine, query, and active
tab remain readable in the route and are repeated in the payload so mismatched or transplanted
state can be rejected:

```text
/profile/engine/ENGINE/query/QUERY/timeline?s=v2.COMPRESSED_STATE
```

Incoming state is treated as untrusted data and validated with the same Zod schema used by the
UI and command-line tool. Arrays and identifier lengths have individual caps, and the complete
absolute URL is limited to 2,048 characters. Existing `v1` viewport/resource links remain
decodable.

Default DAG, resource, data-flow, and table controls are omitted. Hover, playback, open popovers,
and other transient state are not shared.

## Agent commands

Create a relative timeline link:

```sh
pixi run pnpm --dir ui deep-link create \
  --engine ENGINE \
  --query QUERY \
  --tab timeline \
  --start 12.5 \
  --end 48.75
```

Add `--base http://localhost:5173` to emit an absolute URL. A JSON state file may be supplied
instead. The command injects the route from `--engine`, `--query`, and `--tab`, so the state file
may contain the remaining v2 fields:

```sh
pixi run pnpm --dir ui deep-link create \
  --engine ENGINE \
  --query QUERY \
  --tab timeline \
  --state state.json
```

Decode a generated link:

```sh
pixi run pnpm --dir ui deep-link decode 'URL'
```

Agents should use these commands rather than recreating the compression format.
