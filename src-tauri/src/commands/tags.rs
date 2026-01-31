use std::sync::Mutex;
use serde::Serialize;
use tauri::State;

use crate::db::TagInfo;
use crate::error::AppError;
use crate::state::AppState;

/// Tag list response
#[derive(Debug, Clone, Serialize)]
pub struct TagListResponse {
    pub tags: Vec<TagInfo>,
    pub total: usize,
}

/// Notes by tag response
#[derive(Debug, Clone, Serialize)]
pub struct NotesByTagResponse {
    pub tag: String,
    pub paths: Vec<String>,
    pub count: usize,
}

/// Get all tags in the vault with their usage counts
#[tauri::command]
pub fn get_all_tags(
    state: State<'_, Mutex<AppState>>,
) -> Result<TagListResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let tags = db.get_all_tags()?;
    let total = tags.len();

    Ok(TagListResponse {
        tags,
        total,
    })
}

/// Get all notes that have a specific tag
#[tauri::command]
pub fn get_notes_by_tag(
    tag: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<NotesByTagResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let paths = db.get_notes_by_tag(&tag)?;
    let count = paths.len();

    Ok(NotesByTagResponse {
        tag,
        paths,
        count,
    })
}
