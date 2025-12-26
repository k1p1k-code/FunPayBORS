mod args;
mod handlers;
mod models;
mod plugins_py;
mod server;
mod utils;

use args::ArgsOption;
use funpay_client::events::Event;
use funpay_client::{FunPayAccount, FunPayError};
use models::strategy::Strategies;
use reqwest;
use std::process::exit;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use crate::models::{AppState, State};
use crate::plugins_py::Plugin;
use crate::utils::print_project;

#[tokio::main]
async fn main() -> Result<(), FunPayError> {
    let args_option = ArgsOption::new();
    if !args_option.reload.is_none() {
        let client = reqwest::Client::new();
        client
            .post("http://127.0.0.1:58899/reload")
            .send()
            .await
            .expect("The request was not sent, make sure the application is running with the --server flag.");
        println!("Wait any event in FunPay");
        exit(1)
    }
    print_project();
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
        id: account
            .id
            .expect("Error get info me, mb no valid golden key"),
        golden_key: golden_key.clone(),
    };

    let strategies = Strategies::new(args_option.path_config).expect("Error");
    let mut rx = account.subscribe();
    let app_state = Arc::new(Mutex::new(AppState::new()));

    let event_handler_app_state = app_state.clone();
    let event_handler = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let state = event_handler_app_state.clone();
            let mut state = state.lock().await;
            match state.app_state {
                State::RELOAD => {
                    println!("---------------\nReloading plugin...");
                    plugins_python = plugins_py::loader_plugins().unwrap_or_else(|m| {
                        println!("! Reload ! {}", m);
                        vec![]
                    });
                    state.app_state = State::DEFAULT;
                }
                State::DEFAULT => {}
            }

            match event {
                Event::NewMessage { message } => {
                    handlers::message_handler(
                        message,
                        &sender,
                        &funpay_me,
                        &strategies,
                        &plugins_python,
                    )
                    .await
                }
                Event::NewOrder { order } => {
                    handlers::order_handler(
                        order,
                        &sender,
                        &funpay_me,
                        &strategies,
                        &plugins_python,
                    )
                    .await
                }
                Event::OrderStatusChanged { order } => {
                    handlers::order_status_changed_handler(
                        order,
                        &sender,
                        &funpay_me,
                        &strategies,
                        &plugins_python,
                    )
                    .await
                }
                _ => {}
            }
        }
    });

    if args_option.server.is_some() {
        #[warn(unused)]
        let router = server::build_router(app_state).await;
        let listener_server = TcpListener::bind("127.0.0.1:58899").await?;

        let _server_handle = tokio::spawn(async move {
            println!("Server start on 127.0.0.1:58899");
            if let Err(e) = axum::serve(listener_server, router).await {
                eprintln!("❌ Server error: {}", e);
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
