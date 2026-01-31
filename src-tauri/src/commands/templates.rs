use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::fs::VaultFs;
use crate::parser::TemplateProcessor;
use crate::state::AppState;

/// Template information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateInfo {
    pub name: String,
    pub path: String,
}

/// List of templates response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplatesResponse {
    pub templates: Vec<TemplateInfo>,
}

/// Applied template result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppliedTemplate {
    pub content: String,
    pub template_name: String,
}

/// Get all available templates
#[tauri::command]
pub fn get_templates(
    state: State<'_, Mutex<AppState>>,
) -> Result<TemplatesResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    let templates_dir = "Templates";

    // Read the Templates directory
    let entries = match fs.read_directory(templates_dir) {
        Ok(entries) => entries,
        Err(_) => {
            // Directory doesn't exist, return empty list
            return Ok(TemplatesResponse { templates: Vec::new() });
        }
    };

    // Filter to only markdown files
    let templates: Vec<TemplateInfo> = entries
        .into_iter()
        .filter(|e| !e.is_directory && e.extension.as_deref() == Some("md"))
        .map(|e| TemplateInfo {
            name: e.name.trim_end_matches(".md").to_string(),
            path: e.path,
        })
        .collect();

    Ok(TemplatesResponse { templates })
}

/// Apply a template with optional variables
#[tauri::command]
pub fn apply_template(
    template_path: String,
    variables: Option<HashMap<String, String>>,
    state: State<'_, Mutex<AppState>>,
) -> Result<AppliedTemplate, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    // Read the template content
    let template_content = fs.read_file(&template_path)?;

    // Get template name from path
    let template_name = std::path::Path::new(&template_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    // Process template variables
    let vars = variables.unwrap_or_default();
    let content = TemplateProcessor::process(&template_content, &vars);

    Ok(AppliedTemplate {
        content,
        template_name,
    })
}
