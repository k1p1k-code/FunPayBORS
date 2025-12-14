use funpay_client::FunPaySender;
use funpay_client::models::Message;
use crate::models::{
    FPMe,
    strategy::Strategies
};


pub async fn message_handler(message: Message, sender: &FunPaySender, me: &FPMe, strategies: &Strategies) {
    if me.id == message.author_id{return;}
    let text = match &message.text {
        Some(text) => text,
        None => return,
    };
    for i in strategies.message.iter() {
        if i.strategy_text.check(text){sender.send_chat_message(&message.chat_id, &i.answer).await.unwrap();}
    }

}