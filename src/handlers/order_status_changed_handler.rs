use crate::models::FPMe;
use crate::models::strategy::Strategies;
use crate::plugins_py::Plugin;
use crate::plugins_py::utils::run_hook;
use crate::utils::*;
use funpay_client::FunPaySender;
use funpay_client::models::OrderShortcut;
use std::sync::Arc;

pub async fn order_status_changed_handler(
    order: OrderShortcut,
    _sender: &FunPaySender,
    me: &FPMe,
    _strategies: &Strategies,
    plugin: &Vec<Plugin>,
) {
    let order_for_plugins = Arc::new(order_to_json_value(&order).to_string());
    let me_for_plugins = Arc::new(funpay_me_to_json_value(&me).to_string());
    let args_py = (order_for_plugins.clone(), me_for_plugins.clone());
    for i in plugin.iter() {
        let args_py = args_py.clone();
        let osc_hook = match &i.order_status_changed {
            Some(hook) => hook,
            None => {
                continue;
            }
        };
        let con = match run_hook(osc_hook, args_py, &i.storage).await {
            Ok(b) => b,
            Err(e) => {
                println!(
                    "Plugin \"{}\" order status changed handler hook returned error, about message_handler!\nError: {:?}",
                    i.name, e
                );
                return;
            }
        };
        if con {
            return;
        }
    }
}
