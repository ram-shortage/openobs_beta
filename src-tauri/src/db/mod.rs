use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};

use crate::error::AppResult;

/// Database wrapper for SQLite with FTS5 full-text search
pub struct Database {
    conn: Connection,
    vault_path: PathBuf,
}

impl Database {
    /// Open or create a database for the given vault
    pub fn open(vault_path: &Path) -> AppResult<Self> {
        let db_path = vault_path.join(".openobs").join("openobs.db");

        // Ensure the .openobs directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        let db = Self {
            conn,
            vault_path: vault_path.to_path_buf(),
        };

        db.init_schema()?;
        Ok(db)
    }

    /// Initialize the database schema
    fn init_schema(&self) -> AppResult<()> {
        self.conn.execute_batch(
            r#"
            -- Notes table stores metadata about each note
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                frontmatter TEXT,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL
            );

            -- FTS5 virtual table for full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                path,
                title,
                content,
                content=notes,
                content_rowid=id,
                tokenize='porter unicode61'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(rowid, path, title, content)
                VALUES (new.id, new.path, new.title, new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, path, title, content)
                VALUES ('delete', old.id, old.path, old.title, old.content);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, path, title, content)
                VALUES ('delete', old.id, old.path, old.title, old.content);
                INSERT INTO notes_fts(rowid, path, title, content)
                VALUES (new.id, new.path, new.title, new.content);
            END;

            -- Links table for wikilinks between notes
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                target_path TEXT NOT NULL,
                link_text TEXT,
                UNIQUE(source_path, target_path, link_text)
            );

            CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_path);
            CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);

            -- Tags table
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            -- Note-tag relationship
            CREATE TABLE IF NOT EXISTS note_tags (
                note_path TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_path, tag_id),
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_note_tags_path ON note_tags(note_path);
            CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

            -- Headings table for outline
            CREATE TABLE IF NOT EXISTS headings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_path TEXT NOT NULL,
                level INTEGER NOT NULL,
                text TEXT NOT NULL,
                line_number INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_headings_path ON headings(note_path);

            -- Settings table
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- Recent vaults (stored in app-level db, but we keep it here for simplicity)
            CREATE TABLE IF NOT EXISTS recent_vaults (
                path TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                last_opened TEXT NOT NULL
            );
            "#,
        )?;

        Ok(())
    }

    /// Get the vault path
    pub fn vault_path(&self) -> &Path {
        &self.vault_path
    }

    // ==================== Note Operations ====================

    /// Insert or update a note in the database
    pub fn upsert_note(
        &self,
        path: &str,
        title: &str,
        content: &str,
        frontmatter: Option<&str>,
        created_at: &str,
        modified_at: &str,
    ) -> AppResult<()> {
        self.conn.execute(
            r#"
            INSERT INTO notes (path, title, content, frontmatter, created_at, modified_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                frontmatter = excluded.frontmatter,
                modified_at = excluded.modified_at
            "#,
            params![path, title, content, frontmatter, created_at, modified_at],
        )?;
        Ok(())
    }

    /// Delete a note from the database
    pub fn delete_note(&self, path: &str) -> AppResult<()> {
        self.conn.execute("DELETE FROM notes WHERE path = ?1", params![path])?;
        self.conn.execute("DELETE FROM links WHERE source_path = ?1", params![path])?;
        self.conn.execute("DELETE FROM note_tags WHERE note_path = ?1", params![path])?;
        self.conn.execute("DELETE FROM headings WHERE note_path = ?1", params![path])?;
        Ok(())
    }

    /// Get a note by path
    pub fn get_note(&self, path: &str) -> AppResult<Option<NoteRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, title, content, frontmatter, created_at, modified_at FROM notes WHERE path = ?1"
        )?;

        let result = stmt.query_row(params![path], |row| {
            Ok(NoteRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                frontmatter: row.get(4)?,
                created_at: row.get(5)?,
                modified_at: row.get(6)?,
            })
        });

        match result {
            Ok(note) => Ok(Some(note)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Update note path (for rename/move operations)
    pub fn update_note_path(&self, old_path: &str, new_path: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE notes SET path = ?1 WHERE path = ?2",
            params![new_path, old_path],
        )?;
        self.conn.execute(
            "UPDATE links SET source_path = ?1 WHERE source_path = ?2",
            params![new_path, old_path],
        )?;
        self.conn.execute(
            "UPDATE links SET target_path = ?1 WHERE target_path = ?2",
            params![new_path, old_path],
        )?;
        self.conn.execute(
            "UPDATE note_tags SET note_path = ?1 WHERE note_path = ?2",
            params![new_path, old_path],
        )?;
        self.conn.execute(
            "UPDATE headings SET note_path = ?1 WHERE note_path = ?2",
            params![new_path, old_path],
        )?;
        Ok(())
    }

    // ==================== Search Operations ====================

    /// Full-text search using FTS5
    pub fn search(&self, query: &str, limit: usize) -> AppResult<Vec<SearchResult>> {
        let fts_query = format!("{}*", query.replace('"', "\"\""));

        let mut stmt = self.conn.prepare(
            r#"
            SELECT n.path, n.title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
            FROM notes_fts
            JOIN notes n ON notes_fts.rowid = n.id
            WHERE notes_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2
            "#
        )?;

        let results = stmt.query_map(params![fts_query, limit as i64], |row| {
            Ok(SearchResult {
                path: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
            })
        })?;

        let mut search_results = Vec::new();
        for result in results {
            search_results.push(result?);
        }

        Ok(search_results)
    }

    /// Search notes by tag
    pub fn search_by_tag(&self, tag: &str) -> AppResult<Vec<SearchResult>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT n.path, n.title, substr(n.content, 1, 100) as snippet
            FROM notes n
            JOIN note_tags nt ON n.path = nt.note_path
            JOIN tags t ON nt.tag_id = t.id
            WHERE t.name = ?1
            ORDER BY n.modified_at DESC
            "#
        )?;

        let results = stmt.query_map(params![tag], |row| {
            Ok(SearchResult {
                path: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
            })
        })?;

        let mut search_results = Vec::new();
        for result in results {
            search_results.push(result?);
        }

        Ok(search_results)
    }

    // ==================== Link Operations ====================

    /// Set links for a note (replaces existing links)
    pub fn set_links(&self, source_path: &str, links: &[(String, Option<String>)]) -> AppResult<()> {
        self.conn.execute("DELETE FROM links WHERE source_path = ?1", params![source_path])?;

        let mut stmt = self.conn.prepare(
            "INSERT OR IGNORE INTO links (source_path, target_path, link_text) VALUES (?1, ?2, ?3)"
        )?;

        for (target, text) in links {
            stmt.execute(params![source_path, target, text])?;
        }

        Ok(())
    }

    /// Get backlinks (notes that link to the given path)
    pub fn get_backlinks(&self, path: &str) -> AppResult<Vec<LinkInfo>> {
        // Normalize path for matching (remove .md extension if present)
        let path_without_ext = path.trim_end_matches(".md");

        let mut stmt = self.conn.prepare(
            r#"
            SELECT DISTINCT l.source_path, n.title, l.link_text
            FROM links l
            JOIN notes n ON l.source_path = n.path
            WHERE l.target_path = ?1 OR l.target_path = ?2
            "#
        )?;

        let results = stmt.query_map(params![path, path_without_ext], |row| {
            Ok(LinkInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                link_text: row.get(2)?,
            })
        })?;

        let mut links = Vec::new();
        for result in results {
            links.push(result?);
        }

        Ok(links)
    }

    /// Get outgoing links from a note
    pub fn get_outgoing_links(&self, path: &str) -> AppResult<Vec<LinkInfo>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT l.target_path, COALESCE(n.title, l.target_path), l.link_text
            FROM links l
            LEFT JOIN notes n ON l.target_path = n.path OR l.target_path || '.md' = n.path
            WHERE l.source_path = ?1
            "#
        )?;

        let results = stmt.query_map(params![path], |row| {
            Ok(LinkInfo {
                path: row.get(0)?,
                title: row.get(1)?,
                link_text: row.get(2)?,
            })
        })?;

        let mut links = Vec::new();
        for result in results {
            links.push(result?);
        }

        Ok(links)
    }

    /// Get all links in the vault (for graph visualization)
    pub fn get_all_links(&self) -> AppResult<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare("SELECT source_path, target_path FROM links")?;

        let results = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut links = Vec::new();
        for result in results {
            links.push(result?);
        }

        Ok(links)
    }

    /// Get all links with their raw target paths (for concept detection)
    /// This returns the original wikilink target, not resolved to existing notes
    pub fn get_all_links_with_targets(&self) -> AppResult<Vec<(String, String)>> {
        let mut stmt = self.conn.prepare("SELECT source_path, target_path FROM links")?;

        let results = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut links = Vec::new();
        for result in results {
            links.push(result?);
        }

        Ok(links)
    }

    /// Get all note paths
    pub fn get_all_note_paths(&self) -> AppResult<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT path FROM notes")?;

        let results = stmt.query_map([], |row| row.get(0))?;

        let mut paths = Vec::new();
        for result in results {
            paths.push(result?);
        }

        Ok(paths)
    }

    // ==================== Tag Operations ====================

    /// Set tags for a note (replaces existing tags)
    pub fn set_tags(&self, note_path: &str, tags: &[String]) -> AppResult<()> {
        self.conn.execute("DELETE FROM note_tags WHERE note_path = ?1", params![note_path])?;

        for tag in tags {
            // Insert tag if not exists
            self.conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
                params![tag],
            )?;

            // Get tag id and link to note
            let tag_id: i64 = self.conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![tag],
                |row| row.get(0),
            )?;

            self.conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_path, tag_id) VALUES (?1, ?2)",
                params![note_path, tag_id],
            )?;
        }

        Ok(())
    }

    /// Get all tags with their usage count
    pub fn get_all_tags(&self) -> AppResult<Vec<TagInfo>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT t.name, COUNT(nt.note_path) as count
            FROM tags t
            LEFT JOIN note_tags nt ON t.id = nt.tag_id
            GROUP BY t.id
            ORDER BY count DESC, t.name ASC
            "#
        )?;

        let results = stmt.query_map([], |row| {
            Ok(TagInfo {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })?;

        let mut tags = Vec::new();
        for result in results {
            tags.push(result?);
        }

        Ok(tags)
    }

    /// Get notes that have a specific tag
    pub fn get_notes_by_tag(&self, tag: &str) -> AppResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT nt.note_path
            FROM note_tags nt
            JOIN tags t ON nt.tag_id = t.id
            WHERE t.name = ?1
            "#
        )?;

        let results = stmt.query_map(params![tag], |row| row.get(0))?;

        let mut paths = Vec::new();
        for result in results {
            paths.push(result?);
        }

        Ok(paths)
    }

    // ==================== Heading Operations ====================

    /// Set headings for a note
    pub fn set_headings(&self, note_path: &str, headings: &[(i32, String, i32)]) -> AppResult<()> {
        self.conn.execute("DELETE FROM headings WHERE note_path = ?1", params![note_path])?;

        let mut stmt = self.conn.prepare(
            "INSERT INTO headings (note_path, level, text, line_number) VALUES (?1, ?2, ?3, ?4)"
        )?;

        for (level, text, line_number) in headings {
            stmt.execute(params![note_path, level, text, line_number])?;
        }

        Ok(())
    }

    // ==================== Settings Operations ====================

    /// Get a setting value
    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        let result = self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Set a setting value
    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    // ==================== Recent Vaults ====================

    /// Add or update a recent vault
    pub fn add_recent_vault(&self, path: &str, name: &str) -> AppResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT OR REPLACE INTO recent_vaults (path, name, last_opened) VALUES (?1, ?2, ?3)",
            params![path, name, now],
        )?;
        Ok(())
    }

    /// Get recent vaults
    pub fn get_recent_vaults(&self) -> AppResult<Vec<RecentVault>> {
        let mut stmt = self.conn.prepare(
            "SELECT path, name, last_opened FROM recent_vaults ORDER BY last_opened DESC LIMIT 10"
        )?;

        let results = stmt.query_map([], |row| {
            Ok(RecentVault {
                path: row.get(0)?,
                name: row.get(1)?,
                last_opened: row.get(2)?,
            })
        })?;

        let mut vaults = Vec::new();
        for result in results {
            vaults.push(result?);
        }

        Ok(vaults)
    }
}

// ==================== Data Types ====================

#[derive(Debug, Clone)]
pub struct NoteRecord {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub content: String,
    pub frontmatter: Option<String>,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LinkInfo {
    pub path: String,
    pub title: String,
    pub link_text: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TagInfo {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RecentVault {
    pub path: String,
    pub name: String,
    pub last_opened: String,
}
