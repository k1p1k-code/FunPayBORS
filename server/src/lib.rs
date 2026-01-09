mod models_response;
mod models_reqwest;
mod plugins;

use std::sync::Arc;
use models::{AppState};
use tokio::sync::Mutex;
use axum::{
    Router,
    routing::{post, get},
    http::Method,
};
use tower_http::cors::{CorsLayer, Any};
use tower::ServiceBuilder;
use plugins::{ list_plugins, reload_plugins, callback_plugin};

pub async fn build_router(app_state: Arc<Mutex<AppState>>) -> Router {
    let cors_layer = CorsLayer::new()
        .allow_origin(Any)  // Open access to selected route
        .allow_headers(Any)  // ← Разрешаем ВСЕ заголовки
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,  // Важно для CORS preflight
        ]);


    let app = Router::new()
        .route("/plugins/callback", post(callback_plugin))
        .route("/plugins/list", get(list_plugins))
        .route("/plugins/reload", post(reload_plugins))
        .with_state(app_state)
        .layer(ServiceBuilder::new().layer(cors_layer));

    app
}