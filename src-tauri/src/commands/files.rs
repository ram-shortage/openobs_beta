use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::fs::{FileEntry, FileInfo, VaultFs};
use crate::indexer::Indexer;
use crate::state::AppState;

/// Response for file read operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub modified: Option<String>,
}

/// Read directory contents
#[tauri::command]
pub fn read_directory(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<FileEntry>, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    fs.read_directory(&path)
}

/// Read file contents
#[tauri::command]
pub fn read_file(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<FileContent, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    let content = fs.read_file(&path)?;
    let info = fs.get_file_info(&path)?;

    Ok(FileContent {
        path,
        content,
        modified: info.modified,
    })
}

/// Write file contents
#[tauri::command]
pub fn write_file(
    path: String,
    content: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());
    fs.write_file(&path, &content)?;

    // Re-index the file
    let indexer = Indexer::new();
    let full_path = vault_path.join(&path);
    indexer.index_file(&full_path, vault_path, db)?;

    Ok(())
}

/// Create a new file
#[tauri::command]
pub fn create_file(
    path: String,
    content: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());
    fs.create_file(&path, &content)?;

    // Index the new file
    let indexer = Indexer::new();
    let full_path = vault_path.join(&path);
    indexer.index_file(&full_path, vault_path, db)?;

    Ok(())
}

/// Create a new folder
#[tauri::command]
pub fn create_folder(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    fs.create_folder(&path)
}

/// Delete a file
#[tauri::command]
pub fn delete_file(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());
    fs.delete_file(&path)?;

    // Remove from index
    let indexer = Indexer::new();
    let full_path = vault_path.join(&path);
    indexer.remove_file(&full_path, vault_path, db)?;

    Ok(())
}

/// Delete a folder
#[tauri::command]
pub fn delete_folder(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    // Get all files in folder before deleting
    let fs = VaultFs::new(vault_path.clone());
    let files = fs.get_all_markdown_files()?;
    let folder_prefix = if path.ends_with('/') { path.clone() } else { format!("{}/", path) };

    // Delete folder
    fs.delete_folder(&path)?;

    // Remove all indexed files from that folder
    let indexer = Indexer::new();
    for file in files {
        if file.starts_with(&folder_prefix) || file == path {
            let full_path = vault_path.join(&file);
            let _ = indexer.remove_file(&full_path, vault_path, db);
        }
    }

    Ok(())
}

/// Rename a file or folder
#[tauri::command]
pub fn rename_file(
    old_path: String,
    new_path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());
    fs.rename(&old_path, &new_path)?;

    // Update index
    let indexer = Indexer::new();
    let old_full = vault_path.join(&old_path);
    let new_full = vault_path.join(&new_path);
    indexer.rename_file(&old_full, &new_full, vault_path, db)?;

    Ok(())
}

/// Move a file to a new directory
#[tauri::command]
pub fn move_file(
    source_path: String,
    dest_dir: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());
    let new_path = fs.move_file(&source_path, &dest_dir)?;

    // Update index
    let indexer = Indexer::new();
    let old_full = vault_path.join(&source_path);
    let new_full = vault_path.join(&new_path);
    indexer.rename_file(&old_full, &new_full, vault_path, db)?;

    Ok(new_path)
}

/// Get detailed file information
#[tauri::command]
pub fn get_file_info(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<FileInfo, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    fs.get_file_info(&path)
}
