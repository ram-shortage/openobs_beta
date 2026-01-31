use std::sync::Mutex;
use serde::Serialize;
use tauri::State;

use crate::db::LinkInfo;
use crate::error::AppError;
use crate::state::AppState;

/// Links response containing backlinks and outgoing links
#[derive(Debug, Clone, Serialize)]
pub struct LinksResponse {
    pub path: String,
    pub links: Vec<LinkInfo>,
}

/// Get all notes that link to the specified note (backlinks)
#[tauri::command]
pub fn get_backlinks(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<LinksResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let links = db.get_backlinks(&path)?;

    Ok(LinksResponse {
        path,
        links,
    })
}

/// Get all notes that the specified note links to
#[tauri::command]
pub fn get_outgoing_links(
    path: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<LinksResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let links = db.get_outgoing_links(&path)?;

    Ok(LinksResponse {
        path,
        links,
    })
}

/// Get all links in the vault
#[tauri::command]
pub fn get_all_links(
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<(String, String)>, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    db.get_all_links()
}
