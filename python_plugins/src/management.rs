use std::io::Cursor;
use std::path::PathBuf;
use std::fs;
use crate::models_plugins::ErrorPlugins;
use std::process::Command;
use std::process::Stdio;
// use ruff_linter;

pub fn create_venv(venv_path: &PathBuf) -> Result<(), ErrorPlugins> {
    if venv_path.exists() {
        return Ok(());
    }

    if let Some(parent) = venv_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let output = Command::new("python")
        .arg("-m")
        .arg("venv")
        .arg(venv_path)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ErrorPlugins::InstallError(format!(
            "Failed to create virtual environment: {}",
            stderr
        )));
    }

    Ok(())
}

pub fn install_plugin(file_byte: Vec<u8>, file_name: String) -> Result<(), ErrorPlugins> {
    let path_plugins = PathBuf::from("plugins/");
    if !path_plugins.exists() {
        fs::create_dir_all(&path_plugins)?;
    }

    let target_dir = path_plugins.join(&file_name);

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)?;
    }

    #[allow(deprecated)]
    let result = zip_extract::extract(Cursor::new(file_byte), &target_dir, true);

    result.map_err(|e| {
        let _ = fs::remove_dir_all(&target_dir);
        ErrorPlugins::ExtractError(e)
    })?;

    let requirements_path = target_dir.join("requirements.txt");
    if !requirements_path.exists() {
        return Ok(());
    }


    let path_venv = target_dir.parent().unwrap().join("venv");
    if let Err(e) = create_venv(&path_venv) {
        let _ = fs::remove_dir_all(&target_dir);
        return Err(e);
    }

    let pip_path = if cfg!(windows) {
        path_venv.join("Scripts").join("pip.exe")
    } else {
        path_venv.join("bin").join("pip")
    };

    if !pip_path.exists() {
        let pip_alt_path = if cfg!(windows) {
            path_venv.join("Scripts").join("pip3.exe")
        } else {
            path_venv.join("bin").join("pip3")
        };

        if !pip_alt_path.exists() {
            let _ = fs::remove_dir_all(&target_dir);
            return Err(ErrorPlugins::PipExecutionFailed(
                "Pip not found in virtual environment".to_string()
            ));
        }
    }

    let output = Command::new(&pip_path)
        .arg("install")
        .arg("--quiet")
        .arg("-r")
        .arg(&requirements_path)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);

        let _ = fs::remove_dir_all(&target_dir);

        return Err(ErrorPlugins::PipExecutionFailed(format!(
            "Pip install failed: {}",
            stderr
        )));
    }

    Ok(())
}

pub fn delete_plugin(name: String) -> Result<(), ErrorPlugins> {
    let path_plugins = PathBuf::from("plugins/").join(&name);
    if !path_plugins.exists() {
        ErrorPlugins::DeleteError(format!("Plugin {} not found", name));
    }
    fs::remove_dir_all(path_plugins)?;
    Ok(())

}