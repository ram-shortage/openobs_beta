mod commands;
mod db;
mod error;
mod fs;
mod indexer;
mod parser;
mod state;

use state::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::vault::open_vault,
            commands::vault::create_vault,
            commands::vault::get_vault_info,
            commands::vault::get_recent_vaults,
            // File commands
            commands::files::read_directory,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::create_file,
            commands::files::create_folder,
            commands::files::delete_file,
            commands::files::delete_folder,
            commands::files::rename_file,
            commands::files::move_file,
            commands::files::get_file_info,
            // Search commands
            commands::search::search_notes,
            commands::search::search_by_tag,
            // Link commands
            commands::links::get_backlinks,
            commands::links::get_outgoing_links,
            commands::links::get_all_links,
            // Tag commands
            commands::tags::get_all_tags,
            commands::tags::get_notes_by_tag,
            // Graph commands
            commands::graph::get_graph_data,
            commands::graph::get_local_graph,
            // Daily notes commands
            commands::daily::get_daily_note,
            commands::daily::get_daily_notes_list,
            // Template commands
            commands::templates::get_templates,
            commands::templates::apply_template,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::get_vault_settings,
            commands::settings::set_vault_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
