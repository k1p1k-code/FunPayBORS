use funpay_client::{events, Event};
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::task::Context;
use std::fs;



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
pub struct Strategy{
    pub strategy_text: StrategyText,
    pub answer: String,
    // event: Event,

}

#[derive(Serialize, Deserialize, Debug)]
pub struct Strategies{
    pub strategies: Vec<Strategy>,
}
impl Strategies {
    pub fn new(path_config: Option<&str>) -> Self {
        let path=match path_config {
            Some(path) => Path::new(path),
            None => Path::new("./config.json"),
        };
        let file=fs::read_to_string(&path);
        let text=file.unwrap();
        let config: Strategies = serde_json::from_str(&text).unwrap();
        config

    }

    fn reload(){

    }

}