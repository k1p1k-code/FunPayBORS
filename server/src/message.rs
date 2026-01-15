use std::sync::Arc;
use models::{AppState, strategy::StrategyMessage};
use crate::models_response::{Response, ResponseStatus};
use crate::models_reqwest::UpdateAutoReply;
use tokio::{
    sync::{Mutex},
};
use axum::{
    extract::State as StateAxum,
    Json

};

pub async fn list_auto_replies(
    StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>,
) -> Json<Vec<StrategyMessage>>{
    Json(app_state.lock().await.strategies.lock().await.message.clone())
}

pub async fn update_auto_replies(
    StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>,
    Json(update_data): Json<UpdateAutoReply>,
) -> Json<Response>{
    let app_state_guard = app_state.lock().await;
    let mut strategies_guard = app_state_guard.strategies.lock().await;

    match strategies_guard.message.get_mut(update_data.id) {
        Some(message) => {
            *message = update_data.strategy_text;
        }
        None => {
            return Json(
                Response{
                    message: Some("Index out of bounds".to_string()),
                    status: ResponseStatus::Error
                }
            )
        }
    }
    Json(
        Response{
            message: Some("Successfully updated".to_string()),
            status: ResponseStatus::Successfully
        }
    )
}