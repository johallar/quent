# NVTX query-engine simulator

This experimental simulator emits query-engine and NVTX telemetry for UI and
analysis development. It models NVTX domains, categories, marks, nested ranges,
resources, and ranges associated with simulated query execution.

## Run

Start the server from the repository root:

```bash
pixi run cargo run -p quent-simulator-server -- --cors-address http://localhost:5173
```

Generate a dataset from another shell:

```bash
pixi run cargo run -p quent-simulator -- --exporter collector
```

See the [simulator documentation](../../../docs/domains/query_engine/examples/simulator.md)
for the query-engine model and
[`DEVELOPMENT.md`](../../../DEVELOPMENT.md) for frontend workflows.

The complete Docker example can be started from the repository root:

```bash
docker compose -f experimental/vibe/simulator/docker-compose.yml up --build
```
