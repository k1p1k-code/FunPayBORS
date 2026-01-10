mod models_response;
mod models_reqwest;
mod plugins;
use std::sync::Arc;
use models::AppState;
use tokio::sync::Mutex;
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
use plugins::{ list_plugins, reload_plugins, callback_plugin};

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

pub async fn build_router(app_state: Arc<Mutex<AppState>>) -> Router {
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

    Router::new()
        .route("/plugins/callback", post(callback_plugin))
        .route("/plugins/list", get(list_plugins))
        .route("/plugins/reload", post(reload_plugins))
        .route("/login", post(pass_check))
        .layer(middleware::from_fn_with_state(app_state.clone(), check_panel_key))
        .with_state(app_state)
        .fallback_service(static_files)
        .layer(ServiceBuilder::new().layer(cors_layer))


}