use serde::Deserialize;
use models::strategy::StrategyMessage;

#[derive(Deserialize)]
pub struct DeletePlugin {
    pub name: String,
}



#[derive(Deserialize)]
pub struct CallbackMenuPlugin {
    pub name: String,
    pub callback_id: u16,
    pub callback_type: String,
    pub data: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateAutoReply {
    pub strategy_message: StrategyMessage,
    pub id: usize
}

#[derive(Deserialize)]
pub struct UpdateField {
    pub update: usize
}
