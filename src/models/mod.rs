pub mod strategy;
use serde::{Serialize};

#[derive(Serialize, Clone)]
pub struct FPMe{
    pub id: i64,
    pub golden_key: String
}