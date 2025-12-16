mod handlers;
mod models;
mod args;
mod plugins;

use funpay_client::events::Event;
use funpay_client::{FunPayAccount, FunPayError};
use models::strategy::Strategies;
use args::ArgsOption;


#[tokio::main]
async fn main() -> Result<(), FunPayError> {

    let args_option = ArgsOption::new();
    let golden_key = args_option.golden_key.unwrap_or_else(|| std::env::var("GOLDEN_KEY").expect("Golden key not found in env and args"));
    let mut account = FunPayAccount::new(golden_key);
    account.init().await?;
    
    let sender=FunPayAccount::create_sender(&account).expect("Error creating sender");
    let funpay_me=models::FPMe{id: account.id.expect("Error get info me, mb no valid golden key")};

    let strategies=Strategies::new(args_option.path_config).expect("Error");
    let mut rx = account.subscribe();

    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            match event {
                Event::NewMessage { message } => handlers::message_handler(message, &sender, &funpay_me, &strategies).await,
                Event::NewOrder { order } => {handlers::order_handler(order, &sender, &funpay_me, &strategies).await},
                // Event::OrderStatusChanged { order } => {handlers::order_handler(order, &sender, &funpay_me, &strategies).await},
                // Event::NewOrder { order } => {handlers::order_handler(order, &sender, &funpay_me, &strategies).await},

                _ => {}
            }
        }
    });

    account.start_polling_loop().await?;
    Ok(())
}
