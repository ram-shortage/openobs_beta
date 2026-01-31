use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

/// Application settings structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    /// Editor theme (light, dark, system)
    pub theme: Option<String>,
    /// Font size for the editor
    pub font_size: Option<u32>,
    /// Font family for the editor
    pub font_family: Option<String>,
    /// Enable vim keybindings
    pub vim_mode: Option<bool>,
    /// Enable spell check
    pub spell_check: Option<bool>,
    /// Auto-save interval in seconds (0 = disabled)
    pub auto_save_interval: Option<u32>,
    /// Show line numbers in editor
    pub line_numbers: Option<bool>,
    /// Word wrap mode
    pub word_wrap: Option<bool>,
}

/// Vault-specific settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultSettings {
    /// Default folder for new notes
    pub default_note_folder: Option<String>,
    /// Daily notes folder
    pub daily_notes_folder: Option<String>,
    /// Templates folder
    pub templates_folder: Option<String>,
    /// Attachments folder
    pub attachments_folder: Option<String>,
    /// Date format for daily notes
    pub daily_note_format: Option<String>,
    /// Default template for new notes
    pub default_template: Option<String>,
    /// Excluded folders from search and graph
    pub excluded_folders: Option<Vec<String>>,
}

/// Get application settings
#[tauri::command]
pub fn get_settings(
    state: State<'_, Mutex<AppState>>,
) -> Result<AppSettings, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = match app_state.db() {
        Some(db) => db,
        None => {
            // Return default settings if no vault is open
            return Ok(AppSettings::default());
        }
    };

    // Load settings from database
    let settings = AppSettings {
        theme: db.get_setting("app.theme")?,
        font_size: db.get_setting("app.font_size")?
            .and_then(|s| s.parse().ok()),
        font_family: db.get_setting("app.font_family")?,
        vim_mode: db.get_setting("app.vim_mode")?
            .and_then(|s| s.parse().ok()),
        spell_check: db.get_setting("app.spell_check")?
            .and_then(|s| s.parse().ok()),
        auto_save_interval: db.get_setting("app.auto_save_interval")?
            .and_then(|s| s.parse().ok()),
        line_numbers: db.get_setting("app.line_numbers")?
            .and_then(|s| s.parse().ok()),
        word_wrap: db.get_setting("app.word_wrap")?
            .and_then(|s| s.parse().ok()),
    };

    Ok(settings)
}

/// Set a single application setting
#[tauri::command]
pub fn set_setting(
    key: String,
    value: JsonValue,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    // Validate key prefix
    if !key.starts_with("app.") {
        return Err(AppError::Custom(format!(
            "Invalid setting key: {}. App settings must start with 'app.'",
            key
        )));
    }

    // Convert value to string
    let value_str = match value {
        JsonValue::String(s) => s,
        JsonValue::Number(n) => n.to_string(),
        JsonValue::Bool(b) => b.to_string(),
        JsonValue::Null => String::new(),
        _ => serde_json::to_string(&value).unwrap_or_default(),
    };

    db.set_setting(&key, &value_str)?;

    Ok(())
}

/// Get vault-specific settings
#[tauri::command]
pub fn get_vault_settings(
    state: State<'_, Mutex<AppState>>,
) -> Result<VaultSettings, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    // Load vault settings from database
    let excluded_folders = db.get_setting("vault.excluded_folders")?
        .map(|s| serde_json::from_str(&s).unwrap_or_default());

    let settings = VaultSettings {
        default_note_folder: db.get_setting("vault.default_note_folder")?,
        daily_notes_folder: db.get_setting("vault.daily_notes_folder")?
            .or_else(|| Some("Daily Notes".to_string())),
        templates_folder: db.get_setting("vault.templates_folder")?
            .or_else(|| Some("Templates".to_string())),
        attachments_folder: db.get_setting("vault.attachments_folder")?
            .or_else(|| Some("Attachments".to_string())),
        daily_note_format: db.get_setting("vault.daily_note_format")?
            .or_else(|| Some("%Y-%m-%d".to_string())),
        default_template: db.get_setting("vault.default_template")?,
        excluded_folders,
    };

    Ok(settings)
}

/// Set a single vault-specific setting
#[tauri::command]
pub fn set_vault_setting(
    key: String,
    value: JsonValue,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    // Validate key prefix
    if !key.starts_with("vault.") {
        return Err(AppError::Custom(format!(
            "Invalid setting key: {}. Vault settings must start with 'vault.'",
            key
        )));
    }

    // Convert value to string
    let value_str = match value {
        JsonValue::String(s) => s,
        JsonValue::Number(n) => n.to_string(),
        JsonValue::Bool(b) => b.to_string(),
        JsonValue::Null => String::new(),
        JsonValue::Array(_) | JsonValue::Object(_) => {
            serde_json::to_string(&value).unwrap_or_default()
        }
    };

    db.set_setting(&key, &value_str)?;

    Ok(())
}
