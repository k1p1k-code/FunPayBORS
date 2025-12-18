pub mod strategy;
use serde::{Serialize};

#[derive(Serialize, Clone)]
pub struct FPMe{
    pub id: i64,
    pub golden_key: String
}


#[derive(Debug)]
pub enum State{
    RELOAD,
    DEFAULT
}

#[derive(Debug)]
pub struct AppState{
    pub app_state: State,
}