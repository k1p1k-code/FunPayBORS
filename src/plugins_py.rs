use std::ffi::CString;
use pyo3::prelude::*;
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub struct Plugin {
    name: String,
    message_hook: Py<PyAny>,
    order_hook: Py<PyAny>,
}



#[derive(Debug)]
pub struct InfoPlugin {
    path_venv: PathBuf,
    path_plugin: PathBuf,
}


fn extruct_plugin(info_plugin: InfoPlugin) -> Plugin {
    unsafe { std::env::set_var("VIRTUAL_ENV", &info_plugin.path_venv); }

    #[cfg(windows)]
    {
        let scripts_path = info_plugin.path_venv.join("Scripts");
        if scripts_path.exists() {
            let mut path = std::env::var("PATH").expect("Failed to get PATH");
            path = format!("{};{}", scripts_path.display(), path);
            unsafe { std::env::set_var("PATH", path); }
        }
    }

    #[cfg(unix)]
    {
        let bin_path = info_plugin.path_venv.join("bin");
        if bin_path.exists() {
            let mut path = std::env::var("PATH").expect("Failed to get PATH");
            path = format!("{}:{}", bin_path.display(), path);
            std::env::set_var("PATH", path);
        }
    }

    Python::attach(|py| {
        let locals = pyo3::types::PyDict::new(py);

        let plugin_code = fs::read_to_string(&info_plugin.path_plugin)
            .expect(&format!("Failed to read plugin: {:?}", info_plugin.path_plugin));

        let c_plugin_code = CString::new(plugin_code)
            .expect(&format!("Failed to convert plugin code to CString: {:?}", info_plugin.path_plugin));

        py.run(c_plugin_code.as_c_str(), None, Some(&locals))
            .expect(&format!("Failed to run plugin: {:?}", info_plugin.path_plugin));

        let plugin_class = locals.get_item("Plugin")
            .expect("No \"Plugin\" class found")
            .expect("No \"Plugin\" class found.");

        let plugin_instance = plugin_class.call0()
            .expect("Failed to create Plugin instance");

        let name = info_plugin.path_venv.file_name().expect("No \"name\" attribute in Plugin found").to_str().unwrap();
        let name=String::from(name);
        let message_hook = plugin_instance.getattr("message_hook")
            .expect("No \"message_hook\" method in Plugin found")
            .into();

        let order_hook = plugin_instance.getattr("order_hook")
            .expect("No \"order_hook\" method in Plugin found")
            .into();

        let load = plugin_instance.getattr("load")
            .expect("No \"load\" method in Plugin found");
        load.call0()
            .expect("Failed to call load method");

        Plugin {
            name,
            message_hook,
            order_hook,
        }
    })
}

fn loader_plugins() -> Vec<Plugin> {
    let current_dir = std::env::current_dir().unwrap();
    let path_plugins = current_dir.join("plugins");

    if !path_plugins.exists() {
        panic!("Directory 'plugins' not found in {:?}", current_dir);
    }

    let mut plugins = Vec::new();

    let entries = fs::read_dir(&path_plugins)
        .expect("Failed to read plugins directory");

    for entry in entries {
        let entry = entry.expect("Failed to read directory entry");

        if entry.path().is_dir() {
            let plugin_name = entry.file_name().to_string_lossy().to_string();
            println!("\n=== Processing plugin: {} ===", plugin_name);

            let path_venv = entry.path().join("venv");
            let path_plugin = entry.path().join("plugin.py");

            if !path_venv.exists() {
                panic!("Virtual environment not found at {:?}", path_venv);
            }

            if !path_plugin.exists() {
                panic!("Plugin file not found at {:?}", path_plugin);
            }

            let plugin = extruct_plugin(InfoPlugin { path_venv, path_plugin });
            plugins.push(plugin);
        }
    }

    plugins
}

