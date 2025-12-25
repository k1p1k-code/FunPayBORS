use std::sync::Arc;

use crate::models::{AppState, State};
use axum::{Router, routing::post};
use tokio::sync::Mutex;

pub async fn build_router(app_state: Arc<Mutex<AppState>>) -> Router {
    let app = Router::new().route(
        "/reload",
        post(|| async move {
            let mut h = app_state.lock().await;
            h.app_state = State::RELOAD;
        }),
    );

    app
}
