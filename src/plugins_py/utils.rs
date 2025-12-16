use std::sync::Arc;
use pyo3::prelude::*;

async fn call_hook(
    py_func: Py<PyAny>,
    args: (Arc<String>, Arc<String>, )
) -> PyResult<bool> {
    let future = async move {
        Python::attach(|py| {
            let locals = pyo3_async_runtimes::tokio::get_current_locals(py)?;
            let bound_func = py_func.bind(py);
            //Большой пик потребленее Ресурсов
            let plain_args: (String, String) = (args.0.as_ref().clone(), args.1.as_ref().clone());
            let py_future = bound_func.call1(plain_args)?;
            pyo3_async_runtimes::into_future_with_locals(&locals, py_future)
            // До сюда
            // Данный коментарий написан руками, так что не надо говорить, то что это ИИ пж 
        })
    };

    let rust_future = future.await?;
    let result = rust_future.await?;

    Python::attach(|py| {
        result.bind(py).extract::<bool>()
    })
}

pub async fn run_hook(
    hook: &Py<PyAny>,
    args: (Arc<String>, Arc<String>)  // Разделяемое владение
) -> PyResult<bool> {
    pyo3::prepare_freethreaded_python();
    Python::attach(|py| {
        let hook_clone = hook.clone_ref(py);
        let args_clone = args.clone();
        pyo3_async_runtimes::tokio::run(py, async move {
            call_hook(hook_clone, args_clone).await
        })
    })
}