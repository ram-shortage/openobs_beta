use std::sync::Mutex;
use serde::Serialize;
use tauri::State;

use crate::db::SearchResult;
use crate::error::AppError;
use crate::state::AppState;

/// Search results response
#[derive(Debug, Clone, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub query: String,
    pub total: usize,
}

/// Full-text search across all notes
#[tauri::command]
pub fn search_notes(
    query: String,
    limit: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<SearchResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let search_limit = limit.unwrap_or(50);
    let results = db.search(&query, search_limit)?;
    let total = results.len();

    Ok(SearchResponse {
        results,
        query,
        total,
    })
}

/// Search notes by tag
#[tauri::command]
pub fn search_by_tag(
    tag: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<SearchResponse, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let results = db.search_by_tag(&tag)?;
    let total = results.len();

    Ok(SearchResponse {
        results,
        query: format!("#{}", tag),
        total,
    })
}
