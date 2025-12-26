pub mod utils;

use pyo3::types::PyDict;
use pyo3::{IntoPyObjectExt, prelude::*};
use std::ffi::CString;
use std::fs;
use std::path::PathBuf;

pub struct Plugin {
    #[warn(unused_variables)]
    pub name: String,
    pub storage: Option<Py<PyAny>>,
    pub message_hook: Option<Py<PyAny>>,
    pub order_hook: Option<Py<PyAny>>,
    pub order_status_changed: Option<Py<PyAny>>,
}

#[derive(Debug)]
pub struct InfoPlugin {
    name: String,
    path_plugin: PathBuf,
}

fn extruct_plugin(info_plugin: InfoPlugin) -> Plugin {
    Python::attach(|py| {
        let plugin_dir = info_plugin
            .path_plugin
            .parent()
            .expect("Failed to get plugin directory");
        let sys = py.import("sys").unwrap();
        let binding = sys.getattr("path").unwrap();
        #[allow(deprecated)]
        let path = binding.downcast().unwrap();

        let plugin_dir_str = plugin_dir.to_str().unwrap();
        path.insert(0, plugin_dir_str).unwrap();

        let mut packeage_venv = PathBuf::from(plugin_dir)
            .parent()
            .unwrap()
            .canonicalize()
            .unwrap()
            .join("venv");
        #[cfg(unix)]
        {
            packeage_venv.push("lib");
        }
        #[cfg(windows)]
        {
            packeage_venv.push("Lib");
        }
        let python_name = fs::read_dir(&packeage_venv)
            .expect("No find site-packages in venv")
            .filter_map(Result::ok)
            .find(|entry| {
                entry.path().is_dir() && entry.file_name().to_string_lossy().starts_with("python")
            })
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .expect("Invalid venv");

        packeage_venv.push(python_name);
        packeage_venv.push("site-packages");
        path.insert(0, packeage_venv.to_str()).unwrap();

        let locals = PyDict::new(py);
        let plugin_code = fs::read_to_string(&info_plugin.path_plugin).expect(&format!(
            "Failed to read plugin: {:?}",
            info_plugin.path_plugin
        ));

        let c_plugin_code = CString::new(plugin_code).expect(&format!(
            "Failed to convert plugin code to CString: {:?}",
            info_plugin.path_plugin
        ));

        py.run(&c_plugin_code, None, Some(&locals)).expect(&format!(
            "Failed to run plugin: {:?}",
            info_plugin.path_plugin
        ));

        let storage: Option<Py<PyAny>> = match locals.get_item("storage") {
            Ok(s) => Some(s.into_bound_py_any(py).unwrap().into()),
            Err(_) => None,
        };

        let plugin_class = locals
            .get_item("Plugin")
            .expect("No \"Plugin\" class found")
            .expect("No \"Plugin\" class found.");

        let plugin_instance = plugin_class
            .call0()
            .expect("Failed to create Plugin instance");

        let message_hook: Option<Py<PyAny>> = match plugin_instance.getattr("message_hook") {
            Ok(hook) => Some(hook.into()),
            Err(_) => None,
        };

        let order_hook: Option<Py<PyAny>> = match plugin_instance.getattr("order_hook") {
            Ok(hook) => Some(hook.into()),
            Err(_) => None,
        };

        let order_status_changed: Option<Py<PyAny>> =
            match plugin_instance.getattr("order_status_changed_hook") {
                Ok(hook) => Some(hook.into()),
                Err(_) => None,
            };

        let load = plugin_instance
            .getattr("load")
            .expect("No \"load\" method in Plugin found");
        load.call0().expect("Failed to call load method");

        Plugin {
            storage,
            name: info_plugin.name,
            message_hook,
            order_hook,
            order_status_changed,
        }
    })
}

pub fn loader_plugins() -> Result<Vec<Plugin>, String> {
    let current_dir = std::env::current_dir().unwrap();
    let path_plugins = current_dir.join("plugins");
    let path_venv = path_plugins.join("venv");
    unsafe {
        std::env::set_var("VIRTUAL_ENV", &path_venv);
    }
    let mut plugins = Vec::new();
    if !path_plugins.exists() {
        Err("\"/plugins\" directory does not exist.".to_string())?
    }

    if !path_venv.exists() {
        Err("Warning: \"/plugins/venv\" directory does not exist, use global interpreter.")?
    }

    let entries = fs::read_dir(&path_plugins).expect("Failed to read plugins directory");

    for entry in entries {
        let entry = entry.expect("Failed to read directory entry");
        if entry.path().is_dir() && entry.file_name() != "venv" {
            let plugin_name = entry.file_name().to_string_lossy().to_string();
            println!("\nLoad plugin: {} ", plugin_name);
            let path_plugin = entry.path().join("plugin.py");
            if !path_plugin.exists() {
                Err(format!("Plugin file not exist {:?}", path_plugin))?
            }
            let plugin = extruct_plugin(InfoPlugin {
                path_plugin: entry.path().join("plugin.py"),
                name: plugin_name,
            });
            plugins.push(plugin);
        }
    }

    Ok(plugins)
}
