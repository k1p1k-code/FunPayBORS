use crate::{models_response, models_reqwest};
use std::sync::Arc;
use python_plugins::utils as python;
use models::{AppState, EventServer};
use tokio::{
    sync::{Mutex, mpsc::Sender},
};
use axum::{
    extract::State as StateAxum,
    Json

};
use axum::extract::Multipart;
use crate::models_response::{ResponseStatus, Response};
use async_zip::tokio::read::seek::ZipFileReader;
use std::io::Cursor;
use python_plugins::{install_plugin, delete_plugin};


pub async fn delete_plugin_web(
    StateAxum(tx): StateAxum<Sender<EventServer>>,
    Json(plugin_delete): Json<models_reqwest::DeletePlugin>,
) -> Json<Response>{
    match delete_plugin(plugin_delete.name){
        Ok(_) => {}
        Err(e) => {
            return Json(Response{
                message: Some(e.to_string()),
                status: ResponseStatus::Error
            })
        }
    }
    reload_plugins(StateAxum(tx.into())).await
}

pub async fn install_plugin_web(
    StateAxum(tx): StateAxum<Sender<EventServer>>,
    mut multipart: Multipart,
) -> Json<Response> {
    let mut file_byte: Option<Vec<u8>> = None;
    let mut plugin_name: Option<String> = None;
    while let Some(field) = multipart.next_field().await.unwrap() {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name == "file" || field.file_name().is_some() {
            if let Some(s) = field.file_name() {
                plugin_name = Some(s.to_string()[0..(s.len()-4)].to_string());
                if s.is_empty() {
                    return Json(Response {
                        message: Some("".to_string()),
                        status: ResponseStatus::Error
                    });
                }
            }
            file_byte = Some(field.bytes().await.unwrap().to_vec());
            break;
        }
    }
    let file_byte = file_byte.unwrap();
    let plugin_name = plugin_name.unwrap();
    let cursor = Cursor::new(file_byte.clone());
    let zip_plugin= match ZipFileReader::with_tokio(cursor).await{
        Ok(zip) => zip,
        Err(_) => {
            return Json(Response {
                message: Some("Error unzip file".to_string()),
                status: ResponseStatus::Error
            })}

    };


    let mut is_file_plugin=false;
    let mut is_file_requirements=false;

    for i in zip_plugin.file().entries().iter(){

        let data=i.filename().as_str().unwrap().split('/').collect::<Vec<&str>>();
        if let Some(file) = data.get(1){
            if *file == "plugin.py"{
                is_file_plugin=true;
            }
            if *file == "requirements.txt"{
                is_file_requirements=true;
            }
        }

    }

    if !is_file_plugin | !is_file_requirements{
        return Json(Response {
            message: Some("The file requirements.txt not found".to_string()),
            status: ResponseStatus::Error
        })
    }

    match install_plugin(file_byte, plugin_name){
        Ok(_) => {
            reload_plugins(StateAxum(tx.into())).await
        }
        Err(e) => {
            Json(Response {
                message: Some(format!("Failed installation, error: {}", e)),
                status: ResponseStatus::Error
            })

            }
    }


}

pub async fn reload_plugins(StateAxum(tx): StateAxum<Sender<EventServer>>) -> Json<Response> {
    match tx.send(EventServer::ReloadPlugins).await {
        Ok(_) => Json(Response{
            message: Some("Successfully send signal reload, wait please".to_string()),
            status: ResponseStatus::Successfully
        }),
        Err(e) => { Json(Response {
                message: Some(format!("Failed send signal reload: {}", e)),
                status: ResponseStatus::Error
            })
        },
    }

}


pub async fn callback_plugin(
    StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>,
    Json(plugin_callback): Json<models_reqwest::CallbackMenuPlugin>) -> Json<Response>{
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
                if let Some(button  ) = buttons.get(plugin_callback.callback_id as usize).clone() {
                    return match python::run_hook_no_args(&button.callback, &plugin.storage).await {
                        Ok(_) => {
                            Json(Response {
                                message: None,
                                status: ResponseStatus::Successfully
                            })
                        }
                        Err(e) => {
                            Json(Response {
                                message: Some(format!("The callback caused an error: {}", e)),
                                status: ResponseStatus::Error
                            })
                        }
                    }
                }
            }
            if let Some(inputs)=menu.input && plugin_callback.callback_type == "input".to_string(){
                if let Some(input) = inputs.get(plugin_callback.callback_id as usize).clone() {
                    if let Some(value) = plugin_callback.data{
                        let value = value.clone();
                        return match python::run_hook_input(&input.callback, (value,), &plugin.storage).await {
                            Ok(s) => {
                                if s.is_empty() {
                                    Json(Response {
                                        message: Some("Successful callback(no message)".to_string()),
                                        status: ResponseStatus::Warning
                                    })
                                } else {
                                    Json(Response {
                                        message: Some(s),
                                        status: ResponseStatus::Successfully
                                    })
                                }
                            }
                            Err(_) => {
                                Json(Response {
                                    message: Some("The callback completed its work with an error".to_string()),
                                    status: ResponseStatus::Error
                                })
                            }
                        }

                    }

                }
            }
        }
    }
    Json(Response{
        message: Some("Callback not find".to_string()),
        status: ResponseStatus::Error
    })
}


pub async fn list_plugins(StateAxum(app_state): StateAxum<Arc<Mutex<AppState>>>) -> Json<Vec<models_response::ResponseListPlugins>> {
    let m=app_state.lock().await;
    let plugins=m.plugins.lock().await;
    let mut result: Vec<models_response::ResponseListPlugins>=vec![];
    for i in plugins.iter(){
        let mut texts: Vec<String> = vec![];
        let mut buttons: Vec<models_response::ButtonOption> = vec![];
        let mut inputs: Vec<models_response::InputOption> = vec![];
        if let Some(error_py) = &i.error{
            result.push(models_response::ResponseListPlugins{
                name: i.name.clone(),
                error: Some(error_py.clone()),
                texts,
                buttons,    
                inputs
            });
            continue;
        }
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
            error: None,
            texts,
            buttons,
            inputs
        })
    }
    Json(
        result
    )
}
