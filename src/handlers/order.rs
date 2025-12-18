use std::sync::Arc;
use funpay_client::FunPaySender;
use funpay_client::models::{OrderShortcut};
use crate::models::FPMe;
use crate::models::strategy::Strategies;
use crate::plugins_py::Plugin;
use crate::plugins_py::utils::run_hook;
use crate::utils::*;

pub async fn order_handler(order: OrderShortcut, sender: &FunPaySender, me: &FPMe, strategies: &Strategies, plugin: &Vec<Plugin>){
    let order_for_plugins=Arc::new(
        order_to_json_value(&order).to_string()
    );
    let me_for_plugins=Arc::new(
        funpay_me_to_json_value(&me).to_string()
    );
    let args_py = (
        order_for_plugins.clone(),
        me_for_plugins.clone()
    );
    for i in plugin.iter() {
        let args_py=args_py.clone();
        let order_hook=match &i.order_hook {
            Some(hook) => {hook},
            None => {continue;}
        };
        let con=match run_hook(order_hook, args_py).await {
            Ok(b) => b,
            Err(e) => {println!("Plugin \"{}\" message hook returned error, about message_handler!\nError: {:?}", i.name, e); return;},
        };
        if !con{
            return;
        }
    }
    for i in &strategies.order{
        if  order.description.starts_with(i.unique_prefix.as_str()){
            if let Some(static_data) = &i.static_data {
                sender.send_chat_message(&order.chat_id, static_data.as_str()).await.unwrap();
            }
            if let Some(availability) = &i.get_availability() {
                sender.send_chat_message(&order.chat_id, availability.as_str()).await.unwrap();
            }
            break
        }
    }
    strategies.save();
}