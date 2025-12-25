use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tokio::sync::Mutex;
use crate::models::{AppState, State};

pub async fn get_socket_handler(
    listener_sock: TcpListener,
    state_app: Arc<Mutex<AppState>>,
) -> JoinHandle<()> {
    let socket_handler = tokio::spawn(async move {
        println!("Socket server started on 127.0.0.1:58899");
        loop {
            match listener_sock.accept().await {
                Ok((mut socket, _addr)) => {
                    let state_app = Arc::clone(&state_app);
                    tokio::spawn(async move {
                        let mut buf = [0; 1024];
                        loop {
                            match socket.read(&mut buf).await {
                                Ok(0) => break,
                                Ok(n) => {
                                    let received = String::from_utf8_lossy(&buf[..n]);
                                    let received = received.trim();
                                    if received == "reload" {
                                        let mut state = state_app.lock().await;
                                        state.app_state = State::RELOAD;
                                    } else {
                                        println!("Received unknown command: {:?}", received);
                                    }
                                    let response = format!("Echo: {}", received);
                                    if let Err(e) = socket.write_all(response.as_bytes()).await {
                                        println!("Failed to send response: {}", e);
                                    }
                                }
                                Err(_) => {break}
                            }
                        }
                    });
                }
                Err(_) => {}
            }
        }
    });
    socket_handler
}