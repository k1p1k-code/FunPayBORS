use std::sync::Arc;
use tokio::sync::Mutex;
use serde::Serialize;
use pyo3::{prelude::*};

pub struct Plugin {
    #[warn(unused_variables)]
    pub name: String,
    pub storage: Option<Py<PyAny>>,
    pub build_menu: Option<Py<PyAny>>,
    pub message_hook: Option<Py<PyAny>>,
    pub order_hook: Option<Py<PyAny>>,
    pub order_status_changed: Option<Py<PyAny>>,
}

#[derive(FromPyObject)]
pub struct PluginMenuOptionText{
    pub value: String,
}
#[derive(FromPyObject)]
pub struct PluginMenuOptionButton{
    pub value: String,
    pub callback: Py<PyAny>,
}

#[derive(FromPyObject)]
pub struct PluginMenuOptionInput{
    pub value_placeholder: String,
    pub value_button: String,
    pub callback: Py<PyAny>,
}

#[derive(FromPyObject)]
pub struct PluginMenu{
    pub text: Option<Vec<PluginMenuOptionText>>,
    pub button: Option<Vec<PluginMenuOptionButton>>,
    pub input: Option<Vec<PluginMenuOptionInput>>,
}

#[derive(Serialize, Clone)]
pub struct FPMe {
    pub id: i64,
    pub golden_key: String,
}

#[derive(Debug)]
pub enum State {
    RELOAD,
    DEFAULT,
}

pub struct AppState {
    pub app_state: State,
    pub plugins: Arc<Mutex<Vec<Plugin>>>
}

impl AppState {
    pub fn new(plugins: Arc<Mutex<Vec<Plugin>>>) -> AppState {
        AppState {
            app_state: State::DEFAULT,
            plugins
        }
    }
}
