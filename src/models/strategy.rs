use serde::{Serialize, Deserialize, Serializer, Deserializer};
use std::path::{Path, PathBuf};
use std::fs;
use std::sync::Mutex;
use parking_lot::RwLock;
use pyo3::PyResult;
use pyo3::types::PyDict;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StrategyText{
    pub key_word: Option<Vec<String>>,
    pub equals: Option<String>
}

impl StrategyText{
    pub fn check(&self, input: &String)->bool{
        let input = input.to_lowercase();
        if let Some(equals_str) = &self.equals {
            if equals_str.to_lowercase() == input {
                return true;
            }
        }
        let key_word=match &self.key_word {
            Some(k)=>k,
            None => {return false}
        };
        for i in key_word.iter(){
            match input.find(i){
                Some(_) => return true,
                None => {continue}
            };
        }
        false
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StrategyMessage{
    pub strategy_text: StrategyText,
    pub answer: String,

}

#[derive(Serialize, Deserialize, Debug)]
pub struct StrategyOrder{
    pub unique_prefix: String,
    pub static_data: Option<String>,
    pub availability_data: RwLock<Option<Vec<String>>>,
}
impl StrategyOrder {
    pub fn get_availability(&self) -> Option<String> {
        let mut data_guard = self.availability_data.write();
        if let Some(data) = data_guard.as_mut() {
            if !data.is_empty() {
                let response = data.remove(0);
                if data.is_empty() {
                    *data_guard = None;
                }
                return Some(response);
            }
        }
        None
    }
}
#[derive(Serialize, Deserialize)]
pub struct Strategies{
    pub message: Vec<StrategyMessage>,
    pub order: Vec<StrategyOrder>,
    #[serde(skip)]
    path_config: PathBuf,
}



impl Strategies {
    pub fn new(path_config: Option<String>) -> Result<Self, Box<dyn std::error::Error>> {
        let path = match path_config {
            Some(path) => Path::new(&path).to_path_buf(),
            None => PathBuf::from("./config.json"),
        };
        if !path.exists() {
            return Err(format!("File config no find {}", path.display()).into());
        }
        let text = fs::read_to_string(&path)?;
        let mut config: Strategies = serde_json::from_str(&text)?;
        config.path_config=path;
        Ok(config)
    }
    fn _reload(&self)  {
    }

    pub fn save(&self) {
        let config_json = serde_json::to_string_pretty(self).unwrap();
        fs::write(&self.path_config, config_json).unwrap();
    }

}