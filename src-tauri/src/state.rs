use crate::db::Database;
use std::path::PathBuf;

#[derive(Default)]
pub struct AppState {
    pub vault_path: Option<PathBuf>,
    pub db: Option<Database>,
}

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_vault(&mut self, path: PathBuf, db: Database) {
        self.vault_path = Some(path);
        self.db = Some(db);
    }

    pub fn vault_path(&self) -> Option<&PathBuf> {
        self.vault_path.as_ref()
    }

    pub fn db(&self) -> Option<&Database> {
        self.db.as_ref()
    }

    pub fn db_mut(&mut self) -> Option<&mut Database> {
        self.db.as_mut()
    }

    pub fn is_vault_open(&self) -> bool {
        self.vault_path.is_some()
    }
}
