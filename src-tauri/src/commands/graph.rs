use std::sync::Mutex;
use tauri::State;

use crate::error::AppError;
use crate::indexer::{build_graph_data, build_local_graph, GraphData};
use crate::state::AppState;

/// Get graph data for the entire vault
#[tauri::command]
pub fn get_graph_data(
    state: State<'_, Mutex<AppState>>,
) -> Result<GraphData, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    build_graph_data(db)
}

/// Get local graph data centered on a specific note
#[tauri::command]
pub fn get_local_graph(
    path: String,
    depth: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<GraphData, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let graph_depth = depth.unwrap_or(1);
    build_local_graph(db, &path, graph_depth)
}
