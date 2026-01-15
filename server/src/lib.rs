mod models_response;
mod models_reqwest;
mod plugins;
mod message;

use std::sync::Arc;
use models::{AppState, EventServer};
use tokio::sync::{Mutex, mpsc};
use axum::{
    Router,
    extract::State as StateAxum,
    routing::{post, get},
    http::{Method, StatusCode, Request, HeaderValue},
    middleware::{self, Next},
    response::Response,
};
use axum::body::Body;
use tower_http::{
    cors::{CorsLayer, Any},
    services::ServeDir,
};
use tower::ServiceBuilder;
use plugins::{ list_plugins, reload_plugins, callback_plugin, install_plugin_web, delete_plugin_web};
use crate::message::{list_auto_replies, update_auto_replies};

async fn check_panel_key(
    StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let provided_key = req.headers()
        .get("X-Panel-Key")
        .and_then(|value: &HeaderValue| value.to_str().ok());
    match provided_key {
        Some(key) if key == app_state.lock().await.api_key => Ok(next.run(req).await),
        _ => {
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}

//Слой проверяет
pub async fn pass_check(StateAxum(_app_state): StateAxum<Arc<Mutex<AppState>>>){}

pub async fn build_router(app_state: Arc<Mutex<AppState>>) -> (Router, mpsc::Receiver<EventServer>) {
    let (tx, rx) = mpsc::channel::<EventServer>(100);

    let cors_layer = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ]);

    let static_files = ServeDir::new("html")
        .append_index_html_on_directories(true);

    let app=Router::new()
        // Plugins
        .route("/plugins/installation", post(install_plugin_web))
        .route("/plugins/delete", post(delete_plugin_web))
        .route("/plugins/reload", post(reload_plugins))
        // Message
        .with_state(tx)

        // Plugins
        .route("/login", post(pass_check))
        .route("/plugins/callback", post(callback_plugin))
        .route("/plugins/list", get(list_plugins))

        // Message
        .route("/messages/list", get(list_auto_replies))
        .route("/messages/update", post(update_auto_replies))

        .layer(middleware::from_fn_with_state(app_state.clone(), check_panel_key))
        .with_state(app_state)
        .fallback_service(static_files)
        .layer(ServiceBuilder::new().layer(cors_layer));

    (app, rx)


}