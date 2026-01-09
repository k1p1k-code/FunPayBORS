use crate::{models_response, models_reqwest};
use std::sync::Arc;
use python_plugins::utils as python;
use models::{AppState, State};
use tokio::sync::Mutex;
use axum::{
    extract::State as StateAxum,
    Json,
};

pub async fn reload_plugins(StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>){
    let mut h = app_state.lock().await;
    h.app_state = State::RELOAD;
}


pub async fn callback_plugin(
    StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>,
    Json(plugin_callback): Json<models_reqwest::CallbackMenuPlugin>){
    let h=app_state.lock().await;
    let plugins=h.plugins.lock().await;
    let mut plugin_check=None;
    for i in plugins.iter(){
        if i.name == plugin_callback.name{
            plugin_check = Some(i);
            break;
        }
    }

    if let Some(plugin) = plugin_check{
        if let Some(build_menu) = &plugin.build_menu{
            let menu=python::run_menu_build(build_menu).await.expect(format!("cannot build menu in {}", plugin.name.to_string()).as_str());
            if let Some(buttons)=menu.button && plugin_callback.callback_type == "button".to_string(){
                if let Some(button) = buttons.get(plugin_callback.callback_id as usize).clone() {
                    let _=python::run_hook_no_args(&button.callback, &plugin.storage).await.unwrap();
                }
            }
            if let Some(inputs)=menu.input && plugin_callback.callback_type == "input".to_string(){
                if let Some(input) = inputs.get(plugin_callback.callback_id as usize).clone() {
                    if let Some(value) = plugin_callback.data{
                        let value = value.clone();
                        let _=python::run_hook_input(&input.callback, (value,), &plugin.storage).await.unwrap();
                    }

                }
            }
        }
    }
}


pub async fn list_plugins(StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>) -> Json<Vec<models_response::ResponseListPlugins>> {
    let m=app_state.lock().await;
    let plugins=m.plugins.lock().await;
    let mut result: Vec<models_response::ResponseListPlugins>=vec![];
    for i in plugins.iter(){
        let mut texts: Vec<String> = vec![];
        let mut buttons: Vec<models_response::ButtonOption> = vec![];
        let mut inputs: Vec<models_response::InputOption> = vec![];
        if let Some(menu) = &i.build_menu{
            let menu=python::run_menu_build(menu).await.expect(format!("cannot build menu in {}", i.name.to_string()).as_str());
            if let Some(text) = menu.text{
                for i in text{
                    texts.push(i.value);
                }
            }
            if let Some(button) = menu.button{
                let mut count: u16=0;
                for i in button{

                    let f=models_response::ButtonOption{
                        value: i.value,
                        callback_id: count
                    };
                    buttons.push(f);
                    count+=1;
                }
            }
            if let Some(input) = menu.input{
                let mut count: u16=0;
                for i in input{

                    let f=models_response::InputOption{
                        value_button: i.value_button,
                        value_placeholder: i.value_placeholder,
                        callback_id: count
                    };
                    inputs.push(f);
                    count+=1;
                }
            }
        }

        result.push(models_response::ResponseListPlugins{
            name: i.name.clone(),
            texts,
            buttons,
            inputs
        })
    }
    Json(
        result
    )
}

