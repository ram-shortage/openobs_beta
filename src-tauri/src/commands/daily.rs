use std::collections::HashMap;
use std::sync::Mutex;
use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::AppError;
use crate::fs::VaultFs;
use crate::indexer::Indexer;
use crate::parser::TemplateProcessor;
use crate::state::AppState;

/// Daily note information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNote {
    pub path: String,
    pub date: String,
    pub exists: bool,
    pub content: Option<String>,
}

/// List of daily notes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNotesList {
    pub notes: Vec<DailyNote>,
}

/// Get or create a daily note for a specific date
#[tauri::command]
pub fn get_daily_note(
    date: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<DailyNote, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let db = app_state.db().ok_or(AppError::VaultNotOpen)?;

    let fs = VaultFs::new(vault_path.clone());

    // Parse date or use today
    let target_date = if let Some(date_str) = date {
        NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
            .map_err(|e| AppError::Custom(format!("Invalid date format: {}", e)))?
    } else {
        Local::now().date_naive()
    };

    let date_str = target_date.format("%Y-%m-%d").to_string();
    let note_path = format!("Daily Notes/{}.md", date_str);

    // Check if the daily note exists
    if fs.exists(&note_path) {
        let content = fs.read_file(&note_path)?;
        Ok(DailyNote {
            path: note_path,
            date: date_str,
            exists: true,
            content: Some(content),
        })
    } else {
        // Try to find and apply the daily note template
        let template_path = "Templates/Daily Note.md";
        let content = if fs.exists(template_path) {
            let template = fs.read_file(template_path)?;
            let mut vars = HashMap::new();
            vars.insert("title".to_string(), date_str.clone());
            TemplateProcessor::process(&template, &vars)
        } else {
            // Default daily note template
            format!(
                r#"---
title: "{}"
created: {}
tags: [daily-note]
---

# {}

## Notes

"#,
                date_str,
                Local::now().format("%Y-%m-%d %H:%M"),
                date_str
            )
        };

        // Create the daily note
        fs.create_file(&note_path, &content)?;

        // Index the new file
        let indexer = Indexer::new();
        let full_path = vault_path.join(&note_path);
        indexer.index_file(&full_path, vault_path, db)?;

        Ok(DailyNote {
            path: note_path,
            date: date_str,
            exists: true,
            content: Some(content),
        })
    }
}

/// Get a list of all daily notes
#[tauri::command]
pub fn get_daily_notes_list(
    limit: Option<usize>,
    state: State<'_, Mutex<AppState>>,
) -> Result<DailyNotesList, AppError> {
    let app_state = state.lock().map_err(|_| {
        AppError::Custom("Failed to acquire state lock".to_string())
    })?;

    let vault_path = app_state.vault_path().ok_or(AppError::VaultNotOpen)?;
    let fs = VaultFs::new(vault_path.clone());

    let daily_notes_dir = "Daily Notes";

    // Read the Daily Notes directory
    let entries = match fs.read_directory(daily_notes_dir) {
        Ok(entries) => entries,
        Err(_) => {
            // Directory doesn't exist, return empty list
            return Ok(DailyNotesList { notes: Vec::new() });
        }
    };

    // Filter and sort daily notes
    let mut daily_notes: Vec<DailyNote> = entries
        .into_iter()
        .filter(|e| !e.is_directory && e.extension.as_deref() == Some("md"))
        .filter_map(|e| {
            // Try to parse the filename as a date
            let date_str = e.name.trim_end_matches(".md");
            if NaiveDate::parse_from_str(date_str, "%Y-%m-%d").is_ok() {
                Some(DailyNote {
                    path: e.path,
                    date: date_str.to_string(),
                    exists: true,
                    content: None,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort by date descending (most recent first)
    daily_notes.sort_by(|a, b| b.date.cmp(&a.date));

    // Apply limit if specified
    if let Some(limit) = limit {
        daily_notes.truncate(limit);
    }

    Ok(DailyNotesList { notes: daily_notes })
}
