use serde::Deserialize;

#[derive(Deserialize)]
pub struct CallbackMenuPlugin {
    pub name: String,
    pub callback_id: u16,
    pub callback_type: String,
    pub data: Option<String>,
}

