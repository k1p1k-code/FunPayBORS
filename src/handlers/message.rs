use crate::models::{FPMe, strategy::Strategies};
use crate::plugins_py::Plugin;
use crate::plugins_py::utils::run_hook;
use crate::utils::*;
use funpay_client::models::Message;
use funpay_client::{FunPayError, FunPaySender};
use std::process::exit;
use std::sync::Arc;

pub async fn message_handler(
    message: Message,
    sender: &FunPaySender,
    me: &FPMe,
    strategies: &Strategies,
    plugin: &Vec<Plugin>,
) {
    let message_for_plugins = Arc::new(message_to_json_value(&message).to_string());
    let me_for_plugins = Arc::new(funpay_me_to_json_value(&me).to_string());
    let args_py = (message_for_plugins.clone(), me_for_plugins.clone());
    for i in plugin.iter() {
        let args_py = args_py.clone();
        let message_hook = match &i.message_hook {
            Some(hook) => hook,
            None => {
                continue;
            }
        };
        let con = match run_hook(message_hook, args_py).await {
            Ok(b) => b,
            Err(e) => {
                println!(
                    "Plugin \"{}\" message hook returned error, about message_handler!\nError: {:?}",
                    i.name, e
                );
                return;
            }
        };
        if con {
            return;
        }
    }

    if me.id == message.author_id {
        return;
    }

    let text = match message.text {
        Some(text) => text,
        None => return,
    };

    for i in strategies.message.iter() {
        if i.strategy_text.check(&text) {
            sender
                .send_chat_message(&message.chat_id, &i.answer)
                .await
                .unwrap_or_else(|m| match m {
                    FunPayError::Unauthorized => {
                        println!("The golden Key became invalid, exit");
                        exit(401)
                    }
                    _ => {
                        println!("Error send message {:?}", m);
                    }
                });
        }
    }
}
