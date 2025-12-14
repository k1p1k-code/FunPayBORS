use funpay_client::FunPaySender;
use funpay_client::models::{OrderShortcut};
use crate::models::FPMe;
use crate::models::strategy::Strategies;

pub async fn order_handler(order: OrderShortcut, sender: &FunPaySender, me: &FPMe, strategies: &Strategies) {
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