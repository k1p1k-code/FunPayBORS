mod handlers;
mod models;
mod args;
mod plugins_py;
mod utils;
mod sock;

use std::sync::Arc;
use funpay_client::events::Event;
use funpay_client::{FunPayAccount, FunPayError};
use tokio::io::{AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use models::strategy::Strategies;
use args::ArgsOption;

use crate::plugins_py::Plugin;
use crate::models::{AppState, State};


#[tokio::main]
async fn main() -> Result<(), FunPayError> {
    let args_option = ArgsOption::new();
    if !args_option.reload.is_none(){
        let mut stream = TcpStream::connect("127.0.0.1:58899").await.expect("Failed to connect to the server, mb run application with --server");
        stream.write_all(b"reload").await.expect("Failed to write to server");
        println!("Wait for any FunPay event to reload plugins");
        std::process::exit(0);
    }

    let mut plugins_python: Vec<Plugin> = plugins_py::loader_plugins().unwrap_or_else(|m| {
        println!("{}", m);
        vec![]
    });

    let golden_key = args_option.golden_key.unwrap_or_else(|| {
        std::env::var("GOLDEN_KEY").expect("Golden key not found in env and args")
    });
    let mut account = FunPayAccount::new(golden_key.clone());
    account.init().await?;

    let sender = FunPayAccount::create_sender(&account).expect("Error creating sender");
    let funpay_me = models::FPMe {
        id: account.id.expect("Error get info me, mb no valid golden key"),
        golden_key: golden_key.clone()
    };
    let strategies = Strategies::new(args_option.path_config).expect("Error");
    let mut rx = account.subscribe();
    let app_state = Arc::new(Mutex::new(AppState { app_state: State::DEFAULT }));

    let event_handler_app_state=app_state.clone();
    let event_handler = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let state=event_handler_app_state.clone();
            let mut state=state.lock().await;
            match state.app_state {
                State::RELOAD => {
                    println!("---------------\nReloading plugin...");
                    plugins_python=plugins_py::loader_plugins().unwrap_or_else(|m| {
                        println!("! Reload ! {}", m);
                        vec![]
                    });
                    state.app_state = State::DEFAULT;
                }
                State::DEFAULT => {}
            }

            match event {
                Event::NewMessage { message } => {
                    handlers::message_handler(message, &sender, &funpay_me, &strategies, &plugins_python).await
                }
                Event::NewOrder { order } => {
                    handlers::order_handler(order, &sender, &funpay_me, &strategies).await
                }
                // Event::OrderStatusChanged { order } => {
                //     handlers::order_handler(order, &sender, &funpay_me, &strategies).await
                // }
                _ => {}
            }
        }
    });

    if args_option.server.is_some() {
        let listener_sock = TcpListener::bind("127.0.0.1:58899").await?;
        let socket_handler = sock::get_socket_handler(listener_sock, app_state.clone()).await;
        tokio::select! {
            _ = socket_handler => {
                println!("Socket server stopped");
            }
            _ = event_handler => {
                println!("FunPay event handler stopped");
            }
            result = account.start_polling_loop() => {
                if let Err(e) = result {
                    eprintln!("Polling loop error: {}", e);
                }
            }
            else => {
                println!("All tasks completed");
            }
        }
    } else {
        tokio::select! {
            _ = event_handler => {
                println!("FunPay event handler stopped");
            }
            result = account.start_polling_loop() => {
                if let Err(e) = result {
                    eprintln!("Polling loop error: {}", e);
                }
            }
            else => {
                println!("All tasks completed");
            }
        }
    }
    Ok(())
}