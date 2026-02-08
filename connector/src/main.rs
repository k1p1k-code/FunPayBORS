mod args;
mod handlers;
mod utils;

use args::ArgsOption;
use funpay_client::events::Event;
use funpay_client::{FunPayAccount, FunPayError};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use models::{AppState, EventServer, strategy::Strategies, FPMe};
use server;
use crate::utils::print_project;

//noinspection SpellCheckingInspection
#[tokio::main]
async fn main() -> Result<(), FunPayError> {
    print_project();
    let args_option = ArgsOption::new();
    let golden_key = args_option.golden_key.unwrap_or_else(|| {
        std::env::var("GOLDEN_KEY").unwrap_or_else(|_| {
            let reader=std::io::stdin();
            let mut golden_key=String::new();
            println!("Enter Golden Key:");
            reader.read_line(&mut golden_key).expect("Error reading Golden Key");
            golden_key.trim().to_string()
        })
    });
    println!("Current directory: {}", std::env::current_dir().expect("Error init").display());
    let plugins_python_sync = Arc::new(Mutex::new(
        python_plugins::loader_plugins(false).unwrap_or_else(|m| {
            println!("{}", m);
            vec![]
        })
    ));
    let mut account = FunPayAccount::new(golden_key.clone());
    account.init().await?;
    let sender = FunPayAccount::create_sender(&account).expect("Error creating sender");
    let funpay_me: FPMe = FPMe {
        id: account
            .id
            .expect("Error get info me, mb no valid golden key"),
        golden_key: golden_key.clone(),
    };
    let strategies = Arc::new(Mutex::new(Strategies::new(args_option.path_config).expect("Error")));
    let mut rx_fupay = account.subscribe();
    let app_state = Arc::new(Mutex::new(AppState::new(
        plugins_python_sync.clone(),
        strategies.clone(),
    )));

    let plugins_python_funpay= plugins_python_sync.clone();
    let strategies_funpay=strategies.clone();
    let event_handler_funpay = tokio::spawn(async move {
        println!("connector handler run");
        while let Ok(event) = rx_fupay.recv().await {
            let plugins_python_funpay=plugins_python_funpay.clone();
            let strategies=strategies_funpay.lock().await;
            match event {
                Event::NewMessage { message } => {
                    handlers::message_handler(
                        message,
                        &sender,
                        &funpay_me,
                        &strategies,
                        plugins_python_funpay,
                    )
                    .await
                }
                Event::NewOrder { order } => {
                    handlers::order_handler(
                        order,
                        &sender,
                        &funpay_me,
                        &strategies,
                        plugins_python_funpay,
                    )
                    .await
                }
                Event::OrderStatusChanged { order } => {
                    handlers::order_status_changed_handler(
                        order,
                        &sender,
                        &funpay_me,
                        &strategies,
                        plugins_python_funpay,
                    )
                    .await
                }
                _ => {}
            }
        }
    });



    if args_option.server.is_some() {
        std::fs::write("./api_key", app_state.clone().lock().await.api_key.clone()).expect("Error writing api key");
        println!("\nYour api key: {}\n", app_state.clone().lock().await.api_key);
        let (router, mut server_rx) = server::build_router(app_state).await;
        let listener_server = TcpListener::bind("0.0.0.0:58899").await?;
        let _server = tokio::spawn(  async move {
            println!("Server start on 127.0.0.1:58899");
            if let Err(e) = axum::serve(listener_server, router).await {
                eprintln!("Server error: {}", e);
            }
        });


        let _event_handler_server=tokio::spawn(async move {
            let plugins_python_server=plugins_python_sync.clone();
            println!("  Server handler run");
            while let Some(event) = server_rx.recv().await {
                match event {
                    EventServer::ReloadPlugins => {
                        let mut python_plugin = plugins_python_server.lock().await;
                        *python_plugin = python_plugins::loader_plugins(true).unwrap_or_else(|m| {
                            println!("{}", m);
                            vec![]
                        });

                    }

                }
            }
        });

        tokio::select! {

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
            _ = event_handler_funpay => {
                println!("connector event handler stopped");
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
