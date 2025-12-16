pub mod utils;

use std::ffi::CString;
use pyo3::prelude::*;
use std::fs;
use std::path::PathBuf;
use pyo3::types::PyDict;


pub struct Plugin {
    #[warn(unused_variables)]
    pub name: String,
    pub message_hook: Py<PyAny>,
    // pub order_hook: Py<PyAny>,
}


#[derive(Debug)]
pub struct InfoPlugin {
    name: String,
    path_plugin: PathBuf,
}

fn extruct_plugin(info_plugin: InfoPlugin) -> Plugin {
    Python::attach(|py| {
        let plugin_dir = info_plugin.path_plugin.parent()
            .expect("Failed to get plugin directory");
        let sys = py.import("sys").unwrap();
        let binding = sys.getattr("path").unwrap();
        let path=binding.downcast().unwrap();
        let plugin_dir_str = plugin_dir.to_str().unwrap();
        path.insert(0, plugin_dir_str).unwrap();

        let locals = PyDict::new(py);

        let plugin_code = fs::read_to_string(&info_plugin.path_plugin)
            .expect(&format!("Failed to read plugin: {:?}", info_plugin.path_plugin));

        let c_plugin_code = CString::new(plugin_code)
            .expect(&format!("Failed to convert plugin code to CString: {:?}", info_plugin.path_plugin));

        py.run(&c_plugin_code, None, Some(&locals))
            .expect(&format!("Failed to run plugin: {:?}", info_plugin.path_plugin));


        let plugin_class = locals.get_item("Plugin")
            .expect("No \"Plugin\" class found")
            .expect("No \"Plugin\" class found.");

        let plugin_instance = plugin_class.call0()
            .expect("Failed to create Plugin instance");

        let message_hook = plugin_instance.getattr("message_hook")
            .expect("No \"message_hook\" method in Plugin found")
            .into();

        // let order_hook = plugin_instance.getattr("order_hook")
        //     .expect("No \"order_hook\" method in Plugin found")
        //     .into();

        let load = plugin_instance.getattr("load")
            .expect("No \"load\" method in Plugin found");
        load.call0()
            .expect("Failed to call load method");

        Plugin {
            name: info_plugin.name,
            message_hook,
            // order_hook,
        }
    })
}

pub fn loader_plugins() -> Result<Vec<Plugin>, String> {
    let current_dir = std::env::current_dir().unwrap();
    let path_plugins = current_dir.join("plugins");
    let path_venv=path_plugins.join("venv");
    unsafe { std::env::set_var("VIRTUAL_ENV", &path_venv); }
    let mut plugins = Vec::new();
    if !path_plugins.exists() {
        Err("\"Plugins\" directory does not exist.".to_string())?
    }



    let entries = fs::read_dir(&path_plugins)
        .expect("Failed to read plugins directory");
    
    for entry in entries {
        let entry = entry.expect("Failed to read directory entry");
        if entry.path().is_dir() && entry.file_name() != "venv" {
            println!("{}", entry.path().display());
            let plugin_name = entry.file_name().to_string_lossy().to_string();
            println!("\n== Load plugin: {} ==", plugin_name);
            let path_plugin = entry.path().join("plugin.py");
            if !path_plugin.exists() {
                Err(format!("Plugin file not exist {:?}", path_plugin))?
            }
            let plugin = extruct_plugin(InfoPlugin {path_plugin: entry.path().join("plugin.py"), name: plugin_name});
            plugins.push(plugin);
        }
    }

    Ok(plugins)
}