pub(crate) use serde_json::{Value, Map};
use funpay_client::models::Message;
use crate::models::FPMe;

pub fn message_to_json_value(msg: &Message) -> Value {
    let mut map = Map::new();
    map.insert("id".to_string(), Value::Number(serde_json::Number::from(msg.id)));
    map.insert("chat_id".to_string(), Value::String(msg.chat_id.to_string()));
    match &msg.chat_name {
        Some(name) => map.insert("chat_name".to_string(), Value::String(name.clone())),
        None => map.insert("chat_name".to_string(), Value::Null),
    };
    match &msg.text {
        Some(text) => map.insert("text".to_string(), Value::String(text.clone())),
        None => map.insert("text".to_string(), Value::Null),
    };
    match &msg.interlocutor_id {
        Some(id) => map.insert("interlocutor_id".to_string(), Value::Number(serde_json::Number::from(*id))),
        None => map.insert("interlocutor_id".to_string(), Value::Null),
    };
    map.insert("author_id".to_string(), Value::Number(serde_json::Number::from(msg.author_id)));
    Value::Object(map)
}

pub fn funpay_me_to_json_value(fpme: &FPMe) -> Value {
    let mut map = Map::new();
    map.insert("id".to_string(), Value::Number(serde_json::Number::from(fpme.id)));
    map.insert("golden_key".to_string(), Value::String(fpme.golden_key.clone()));
    Value::Object(map)
}