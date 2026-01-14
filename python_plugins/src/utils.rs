use pyo3::prelude::*;
use std::sync::Arc;
use models::{PluginMenu};


async fn call_hook(
    py_func: Py<PyAny>,
    args: (Arc<String>, Arc<String>),
    storage: Option<Py<PyAny>>,
) -> PyResult<bool> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            if let Some(s) = storage {
                let globals = PyModule::import(py, "__main__")?;
                let _ = globals.setattr("storage", s).unwrap();
            }
            let plain_args: (String, String) = (args.0.as_ref().clone(), args.1.as_ref().clone());
            let py_future = bound_func.call1(plain_args)?;
            pyo3_async_runtimes::into_future_with_locals(&locals, py_future)
        })
    };

    let rust_future = future.await?;
    let result = rust_future.await?;

    Python::attach(|py| result.bind(py).extract::<bool>())
}

pub async fn run_hook(
    hook: &Py<PyAny>,
    args: (Arc<String>, Arc<String>),
    storage: &Option<Py<PyAny>>,
) -> PyResult<bool> {

    pyo3::Python::initialize();
    Python::attach(|py| {
        let hook_clone = hook.clone_ref(py);

        let args_clone = args.clone();
        let mut strg: Option<Py<PyAny>> = None;
        if let Some(s) = storage {
            strg = Some(s.clone_ref(py));
        }
        pyo3_async_runtimes::tokio::run(
            py,
            async move { call_hook(hook_clone, args_clone, strg).await },
        )
    })
}


async fn call_menu_build(
    py_func: Py<PyAny>,
) -> PyResult<PluginMenu> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            let py_future = bound_func.call0()?;
            pyo3_async_runtimes::into_future_with_locals(&locals, py_future)
        })
    };

    let rust_future = future.await?;
    let result = rust_future.await?;

    Python::attach(|py| result.bind(py).extract::<PluginMenu>())
}
pub async fn run_menu_build(
    hook: &Py<PyAny>,
) -> PyResult<PluginMenu> {
    pyo3::Python::initialize();

    Python::attach(|py| {
        let hook_clone = hook.clone_ref(py);


        pyo3_async_runtimes::tokio::run(
            py,
            async move { call_menu_build(hook_clone).await },
        )
    })
}

async fn call_hook_no_args(
    py_func: Py<PyAny>,
    storage: Option<Py<PyAny>>,
) -> PyResult<()> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            let py_future = bound_func.call0()?;
            if let Some(s) = storage {
                let globals = PyModule::import(py, "__main__")?;
                let _ = globals.setattr("storage", s).unwrap();
            }
            pyo3_async_runtimes::into_future_with_locals(&locals, py_future)
        })
    };

    let rust_future = future.await?;
    let _ = rust_future.await?;
    Ok(())
}
pub async fn run_hook_no_args(
    hook: &Py<PyAny>,
    storage: &Option<Py<PyAny>>,
) -> PyResult<()> {
    pyo3::Python::initialize();

    Python::attach(|py| {
        let hook_clone = hook.clone_ref(py);
        let mut strg: Option<Py<PyAny>> = None;
        if let Some(s) = storage {
            strg = Some(s.clone_ref(py));
        }
        pyo3_async_runtimes::tokio::run(
            py,
            async move { call_hook_no_args(hook_clone, strg).await },
        )
    })
}


async fn call_hook_input(
    py_func: Py<PyAny>,
    args: (String,),
    storage: Option<Py<PyAny>>,
) -> PyResult<String> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            if let Some(s) = storage {
                let globals = PyModule::import(py, "__main__")?;
                let _ = globals.setattr("storage", s).unwrap();
            }
            let py_future = bound_func.call1(args)?;
            pyo3_async_runtimes::into_future_with_locals(&locals, py_future)
        })
    };

    let rust_future = future.await?;
    let result = rust_future.await?;
    let response=Python::attach(|py| result.bind(py).extract::<String>()).unwrap_or_default();
    Ok(response)
}

pub async fn run_hook_input(
    hook: &Py<PyAny>,
    args: (String, ),
    storage: &Option<Py<PyAny>>,
) -> PyResult<String> {
    pyo3::Python::initialize();

    Python::attach(|py| {
        let hook_clone = hook.clone_ref(py);


        let mut strg: Option<Py<PyAny>> = None;
        if let Some(s) = storage {
            strg = Some(s.clone_ref(py));
        }
        pyo3_async_runtimes::tokio::run(
            py,
            async move { call_hook_input(hook_clone, args, strg).await },
        )
    })
}