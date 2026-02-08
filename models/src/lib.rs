use std::sync::Arc;
use tokio::sync::Mutex;
use serde::Serialize;
use pyo3::{prelude::*};
use rand::RngExt;
use crate::strategy::Strategies;

pub mod strategy;


pub struct Plugin {
    #[warn(unused_variables)]
    pub name: String,
    pub error: Option<String>,
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
pub enum EventServer {
    ReloadPlugins,
}

pub struct AppState {
    pub plugins: Arc<Mutex<Vec<Plugin>>>,
    pub strategies: Arc<Mutex<Strategies>>,
    pub api_key: String,

}

impl AppState {
    pub fn new(plugins: Arc<Mutex<Vec<Plugin>>>, strategies: Arc<Mutex<Strategies>>) -> AppState {

        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                            abcdefghijklmnopqrstuvwxyz";
        const STR_LEN: usize = 20;
        let mut rng = rand::rng();
        let api_key: String = (0..STR_LEN)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect();
        AppState {
            plugins,
            strategies,
            api_key,
        }
    }
}
