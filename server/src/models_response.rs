use serde::{Serialize};

#[derive(Serialize, Debug)]
pub struct ButtonOption{
    pub value: String,
    pub callback_id: u16,
}

#[derive(Serialize, Debug)]
pub struct InputOption{
    pub value_placeholder: String,
    pub value_button: String,
    pub callback_id: u16,
}
#[derive(Serialize, Debug)]
pub struct ResponseListPlugins{
    pub name: String,
    pub texts: Vec<String>,
    pub buttons: Vec<ButtonOption>,
    pub inputs: Vec<InputOption>,
}

#[derive(Serialize, Debug)]
pub enum ResponseCallbackPluginStatus{
    Error,
    Warning,
    Successfully
}
#[derive(Serialize, Debug)]
pub struct ResponseCallbackPlugins{
    pub message: Option<String>,
    pub status: ResponseCallbackPluginStatus,
}
