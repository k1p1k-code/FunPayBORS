use std::fmt::Formatter;
use zip_extract::ZipExtractError;

pub enum ErrorPlugins {
    ExtractError(ZipExtractError),
    InstallError(String),
    DeleteError(String),
    IoError(std::io::Error),
    RequirementsNotFound,
    VenvNotFound,
    PipExecutionFailed(String),
    CleanupFailed(String),
}

impl From<std::io::Error> for ErrorPlugins {
    fn from(err: std::io::Error) -> Self {
        ErrorPlugins::IoError(err)
    }
}

impl std::fmt::Display for ErrorPlugins {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match &self {
            ErrorPlugins::ExtractError(e) => write!(f, "{}", e),
            ErrorPlugins::InstallError(e) => write!(f, "{}", e),
            ErrorPlugins::DeleteError(e) => write!(f, "{}", e),
            ErrorPlugins::IoError(e) => write!(f, "{}", e),
            ErrorPlugins::RequirementsNotFound => write!(f, "Requirements not found"),
            ErrorPlugins::VenvNotFound => write!(f, "Venv error, please restart application"),
            ErrorPlugins::PipExecutionFailed(e) => write!(f, "{}", e),
            ErrorPlugins::CleanupFailed(e) => write!(f, "{}", e),
        }

    }
}