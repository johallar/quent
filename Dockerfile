# syntax=docker/dockerfile:1

FROM rust:1.97.0-trixie AS builder

WORKDIR /quent

COPY . .

# Build simulator executables with cached target dir and cargo registry
RUN --mount=type=cache,target=/quent/target \
    --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release -p quent-simulator-server -p quent-simulator -p quent-mcp && \
    cp target/release/quent-simulator-server target/release/quent-simulator \
        target/release/quent-mcp /quent/

FROM debian:trixie AS runtime

WORKDIR /quent

COPY --from=builder /quent/quent-simulator-server /quent/quent-simulator-server
COPY --from=builder /quent/quent-simulator /quent/quent-simulator
COPY --from=builder /quent/quent-mcp /quent/quent-mcp

EXPOSE 8080
EXPOSE 7836
EXPOSE 8081
