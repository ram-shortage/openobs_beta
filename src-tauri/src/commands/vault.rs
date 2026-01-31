use std::path::PathBuf;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Database;
use crate::error::AppError;
use crate::fs::{get_vault_name, init_vault, is_valid_vault};
use crate::indexer::Indexer;
use crate::state::AppState;

/// Information about the current vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub name: String,
    pub path: String,
    pub note_count: usize,
    pub is_open: bool,
}

/// Recent vault entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentVaultInfo {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

/// Open an existing vault
#[tauri::command]
pub fn open_vault(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<VaultInfo, AppError> {
    let vault_path = PathBuf::from(&path);

    if !is_valid_vault(&vault_path) {
        return Err(AppError::InvalidPath(format!(
            "Not a valid vault directory: {}",
            path
        )));
    }

    // Open or create the database
    let db = Database::open(&vault_path)?;

    // Index the vault
    let indexer = Indexer::new();
    let stats = indexer.index_vault(&vault_path, &db)?;

    // Get vault name
    let name = get_vault_name(&vault_path);

    // Add to recent vaults
    db.add_recent_vault(&path, &name)?;

    // Update state
    {
        let mut app_state = state.lock().map_err(|_| {
            AppError::Custom("Failed to acquire state lock".to_string())
        })?;
        app_state.set_vault(vault_path.clone(), db);
    }

    Ok(VaultInfo {
        name,
        path,
        note_count: stats.files_indexed,
        is_open: true,
    })
}

/// Create a new vault at the specified path
#[tauri::command]
pub fn create_vault(
    path: String,
    name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<VaultInfo, AppError> {
    let vault_path = PathBuf::from(&path).join(&name);

    if vault_path.exists() {
        return Err(AppError::AlreadyExists(format!(
            "Vault already exists at: {}",
            vault_path.display()
        )));
    }

    // Initialize vault structure
    init_vault(&vault_path)?;

    // Open the database
    let db = Database::open(&vault_path)?;

    // Index the vault (will index the welcome note)
    let indexer = Indexer::new();
    let stats = indexer.index_vault(&vault_path, &db)?;

    // Add to recent vaults
    let vault_path_str = vault_path.to_string_lossy().to_string();
    db.add_recent_vault(&vault_path_str, &name)?;

    // Update state
    {
        let mut app_state = state.lock().map_err(|_| {
            AppError::Custom("Failed to acquire state lock".to_string())
        })?;
        app_state.set_vault(vault_path.clone(), db);
    }

    Ok(VaultInfo {
        name,
        path: vault_path_str,
        note_count: stats.files_indexed,
        is_open: true,
    })
}

/// Get information about the current vault
#[tauri::command]
pub fn get_vault_info(
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<VaultInfo>, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    if !app_state.is_vault_open() {
        return Ok(None);
    }

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let name = get_vault_name(vault_path);
    let note_count = db.get_all_note_paths()?.len();

    Ok(Some(VaultInfo {
        name,
        path: vault_path.to_string_lossy().to_string(),
        note_count,
        is_open: true,
    }))
}

/// Get list of recently opened vaults
#[tauri::command]
pub fn get_recent_vaults(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<RecentVaultInfo>, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    // If a vault is open, use its database
    if let Some(db) = app_state.db() {
        let recent = db.get_recent_vaults()?;
        return Ok(recent
            .into_iter()
            .filter(|v| PathBuf::from(&v.path).exists())
            .map(|v| RecentVaultInfo {
                name: v.name,
                path: v.path,
                last_opened: v.last_opened,
            })
            .collect());
    }

    // If no vault is open, try to read from app data directory
    // For now, return empty list
    Ok(Vec::new())
}
