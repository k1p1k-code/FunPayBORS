pub(crate) use serde_json::{Value, Map};
use funpay_client::models::{Message, OrderShortcut};
use crate::models::FPMe;
use serde_json::{Number, };

pub fn print_project(){
    let rep=String::from("Repository: https://github.com/k1p1k-code/FunPayBORS");
    let support=String::from("Support: https://t.me/FunPayBors");

    let mut len_line={
      if rep > support{
          rep.len()
      }
      else if rep < support{
            support.len()
        }
      else {
          rep.len()
        }
    };
    len_line=len_line*2-10;
    let mut string_line=String::new();
    for _ in 0..len_line{
        string_line.push_str("_");
    }


    println!("&{}&", string_line);
    println!("|- {}", rep);
    println!("|- {}", support);
    println!("&{}&", string_line);

}

pub fn funpay_me_to_json_value(fpme: &FPMe) -> Value {
    let mut map = Map::new();
    map.insert("id".to_string(), Value::Number(Number::from(fpme.id)));
    map.insert("golden_key".to_string(), Value::String(fpme.golden_key.clone()));
    Value::Object(map)
}

pub fn message_to_json_value(msg: &Message) -> Value {
    let mut map = Map::new();
    map.insert("id".to_string(), Value::Number(Number::from(msg.id)));
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
        Some(id) => map.insert("interlocutor_id".to_string(), Value::Number(Number::from(*id))),
        None => map.insert("interlocutor_id".to_string(), Value::Null),
    };
    map.insert("author_id".to_string(), Value::Number(Number::from(msg.author_id)));
    Value::Object(map)
}


pub fn order_to_json_value(order: &OrderShortcut) -> Value {
    let mut map = Map::new();

    // OrderId как строка (предполагая, что OrderId имеет метод to_string() или From/Into для String)
    map.insert("id".to_string(), Value::String(order.id.to_string()));

    // chat_id как строка
    map.insert("chat_id".to_string(), Value::String(order.chat_id.to_string()));

    map.insert("description".to_string(), Value::String(order.description.clone()));

    // price как число (f64)
    map.insert("price".to_string(), Value::Number(
        Number::from_f64(order.price).unwrap_or(Number::from(0))
    ));

    map.insert("currency".to_string(), Value::String(order.currency.clone()));
    map.insert("buyer_username".to_string(), Value::String(order.buyer_username.clone()));

    // buyer_id как число
    map.insert("buyer_id".to_string(), Value::Number(Number::from(order.buyer_id)));

    // status - можно как строку, либо как объект, в зависимости от формата OrderStatus
    map.insert("status".to_string(), Value::String(format!("{:?}", order.status)));

    map.insert("date_text".to_string(), Value::String(order.date_text.clone()));

    // subcategory как объект
    let mut subcategory_map = Map::new();
    match &order.subcategory.id {
        Some(id) => subcategory_map.insert("id".to_string(), Value::Number(Number::from(*id))),
        None => subcategory_map.insert("id".to_string(), Value::Null),
    };
    subcategory_map.insert("name".to_string(), Value::String(order.subcategory.name.clone()));

    map.insert("subcategory".to_string(), Value::Object(subcategory_map));

    // amount как число
    map.insert("amount".to_string(), Value::Number(Number::from(order.amount)));

    Value::Object(map)
}