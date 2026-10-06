// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

use std::net::SocketAddr;

use axum::{
    Router,
    http::{HeaderName, HeaderValue, Method, header::CONTENT_TYPE},
};
use clap::{Parser, ValueEnum};
use quent_mcp::{http_service, serve_stdio};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone, Copy, Debug, ValueEnum)]
enum Transport {
    Stdio,
    Http,
}

#[derive(Debug, Parser)]
#[command(about = "Experimental MCP bridge for the Quent REST API")]
struct Args {
    /// MCP transport to serve.
    #[arg(long, env = "QUENT_MCP_TRANSPORT", value_enum, default_value = "stdio")]
    transport: Transport,

    /// Quent REST API base URL.
    #[arg(
        long,
        env = "QUENT_API_BASE_URL",
        default_value = "http://localhost:8080/api"
    )]
    api_base: String,

    /// Address for the standalone streamable-HTTP MCP server.
    #[arg(
        long,
        env = "QUENT_MCP_LISTEN_ADDRESS",
        default_value = "127.0.0.1:8081"
    )]
    listen: SocketAddr,

    /// Optional browser origin allowed to call the HTTP MCP endpoint.
    #[arg(long, env = "QUENT_MCP_CORS_ORIGIN")]
    cors_origin: Option<String>,

    /// Tracing filter used when RUST_LOG is unset.
    #[arg(long, default_value = "info")]
    log_level: String,
}

fn initialize_tracing(log_level: &str) {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level)))
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .init();
}

fn cors_layer(origin: &str) -> Result<CorsLayer, Box<dyn std::error::Error>> {
    const MCP_SESSION_ID: HeaderName = HeaderName::from_static("mcp-session-id");
    const MCP_PROTOCOL_VERSION: HeaderName = HeaderName::from_static("mcp-protocol-version");
    const LAST_EVENT_ID: HeaderName = HeaderName::from_static("last-event-id");

    let origin: HeaderValue = origin.parse()?;
    Ok(CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            CONTENT_TYPE,
            MCP_SESSION_ID,
            MCP_PROTOCOL_VERSION,
            LAST_EVENT_ID,
        ])
        .expose_headers([MCP_SESSION_ID]))
}

async fn serve_http(
    api_base: &str,
    listen: SocketAddr,
    cors_origin: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut app = Router::new().nest_service("/mcp", http_service(api_base)?);
    if let Some(origin) = cors_origin {
        app = app.layer(cors_layer(origin)?);
    }

    let listener = TcpListener::bind(listen).await?;
    tracing::info!(address = %listener.local_addr()?, "serving MCP over streamable HTTP");
    axum::serve(listener, app).await?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    initialize_tracing(&args.log_level);

    match args.transport {
        Transport::Stdio => {
            tracing::info!("serving MCP over stdio");
            serve_stdio(&args.api_base).await
        }
        Transport::Http => {
            serve_http(&args.api_base, args.listen, args.cors_origin.as_deref()).await
        }
    }
}
