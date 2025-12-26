use pyo3::prelude::*;
use std::sync::Arc;

async fn call_hook(
    py_func: Py<PyAny>,
    args: (Arc<String>, Arc<String>),
    storage: Option<Py<PyAny>>,
) -> PyResult<bool> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            if storage.is_some() {
                let globals = PyModule::import(py, "__main__")?;
                let _ = globals.setattr("storage", storage.unwrap()).unwrap();
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
        if storage.is_some() {
            strg = Some(storage.as_ref().unwrap().clone_ref(py));
        }
        pyo3_async_runtimes::tokio::run(
            py,
            async move { call_hook(hook_clone, args_clone, strg).await },
        )
    })
}
