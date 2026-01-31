use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use walkdir::WalkDir;

use crate::error::{AppError, AppResult};

/// Represents a file or directory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub extension: Option<String>,
    pub size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub children: Option<Vec<FileEntry>>,
}

/// Detailed file information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub is_markdown: bool,
    pub word_count: Option<usize>,
    pub character_count: Option<usize>,
}

/// File system operations for the vault
pub struct VaultFs {
    vault_path: PathBuf,
}

impl VaultFs {
    pub fn new(vault_path: PathBuf) -> Self {
        Self { vault_path }
    }

    /// Read directory contents recursively
    pub fn read_directory(&self, relative_path: &str) -> AppResult<Vec<FileEntry>> {
        let full_path = self.resolve_path(relative_path)?;
        self.read_directory_internal(&full_path, &self.vault_path)
    }

    /// Internal recursive directory reading
    fn read_directory_internal(&self, dir_path: &Path, vault_root: &Path) -> AppResult<Vec<FileEntry>> {
        let mut entries = Vec::new();

        let read_dir = fs::read_dir(dir_path)?;

        for entry in read_dir {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and directories
            if file_name.starts_with('.') {
                continue;
            }

            let metadata = entry.metadata()?;
            let relative_path = path
                .strip_prefix(vault_root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            let is_dir = metadata.is_dir();
            let extension = if is_dir {
                None
            } else {
                path.extension().map(|e| e.to_string_lossy().to_string())
            };

            let created = metadata.created().ok().map(|t| {
                DateTime::<Utc>::from(t).to_rfc3339()
            });
            let modified = metadata.modified().ok().map(|t| {
                DateTime::<Utc>::from(t).to_rfc3339()
            });

            let children = if is_dir {
                Some(self.read_directory_internal(&path, vault_root)?)
            } else {
                None
            };

            entries.push(FileEntry {
                name: file_name,
                path: relative_path,
                is_directory: is_dir,
                extension,
                size: metadata.len(),
                created,
                modified,
                children,
            });
        }

        // Sort: directories first, then alphabetically
        entries.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        Ok(entries)
    }

    /// Read file contents
    pub fn read_file(&self, relative_path: &str) -> AppResult<String> {
        let full_path = self.resolve_path(relative_path)?;

        if !full_path.exists() {
            return Err(AppError::FileNotFound(relative_path.to_string()));
        }

        Ok(fs::read_to_string(full_path)?)
    }

    /// Write file contents
    pub fn write_file(&self, relative_path: &str, content: &str) -> AppResult<()> {
        let full_path = self.resolve_path(relative_path)?;

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(full_path, content)?;
        Ok(())
    }

    /// Create a new file
    pub fn create_file(&self, relative_path: &str, content: &str) -> AppResult<()> {
        let full_path = self.resolve_path(relative_path)?;

        if full_path.exists() {
            return Err(AppError::AlreadyExists(relative_path.to_string()));
        }

        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(full_path, content)?;
        Ok(())
    }

    /// Create a new folder
    pub fn create_folder(&self, relative_path: &str) -> AppResult<()> {
        let full_path = self.resolve_path(relative_path)?;

        if full_path.exists() {
            return Err(AppError::AlreadyExists(relative_path.to_string()));
        }

        fs::create_dir_all(full_path)?;
        Ok(())
    }

    /// Delete a file
    pub fn delete_file(&self, relative_path: &str) -> AppResult<()> {
        let full_path = self.resolve_path(relative_path)?;

        if !full_path.exists() {
            return Err(AppError::FileNotFound(relative_path.to_string()));
        }

        if full_path.is_dir() {
            return Err(AppError::InvalidPath("Cannot delete directory with delete_file".to_string()));
        }

        fs::remove_file(full_path)?;
        Ok(())
    }

    /// Delete a folder and its contents
    pub fn delete_folder(&self, relative_path: &str) -> AppResult<()> {
        let full_path = self.resolve_path(relative_path)?;

        if !full_path.exists() {
            return Err(AppError::FileNotFound(relative_path.to_string()));
        }

        if !full_path.is_dir() {
            return Err(AppError::InvalidPath("Cannot delete file with delete_folder".to_string()));
        }

        fs::remove_dir_all(full_path)?;
        Ok(())
    }

    /// Rename a file or folder
    pub fn rename(&self, old_path: &str, new_path: &str) -> AppResult<()> {
        let old_full = self.resolve_path(old_path)?;
        let new_full = self.resolve_path(new_path)?;

        if !old_full.exists() {
            return Err(AppError::FileNotFound(old_path.to_string()));
        }

        if new_full.exists() {
            return Err(AppError::AlreadyExists(new_path.to_string()));
        }

        // Ensure parent directory exists for new path
        if let Some(parent) = new_full.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(old_full, new_full)?;
        Ok(())
    }

    /// Move a file to a new location
    pub fn move_file(&self, source_path: &str, dest_dir: &str) -> AppResult<String> {
        let source_full = self.resolve_path(source_path)?;

        if !source_full.exists() {
            return Err(AppError::FileNotFound(source_path.to_string()));
        }

        let file_name = source_full
            .file_name()
            .ok_or_else(|| AppError::InvalidPath("Invalid source path".to_string()))?;

        let dest_full = self.resolve_path(dest_dir)?.join(file_name);

        if dest_full.exists() {
            return Err(AppError::AlreadyExists(dest_full.to_string_lossy().to_string()));
        }

        // Ensure destination directory exists
        if let Some(parent) = dest_full.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(source_full, &dest_full)?;

        let new_relative_path = dest_full
            .strip_prefix(&self.vault_path)
            .unwrap_or(&dest_full)
            .to_string_lossy()
            .to_string();

        Ok(new_relative_path)
    }

    /// Get detailed file information
    pub fn get_file_info(&self, relative_path: &str) -> AppResult<FileInfo> {
        let full_path = self.resolve_path(relative_path)?;

        if !full_path.exists() {
            return Err(AppError::FileNotFound(relative_path.to_string()));
        }

        let metadata = fs::metadata(&full_path)?;
        let file_name = full_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let created = metadata.created().ok().map(|t| {
            DateTime::<Utc>::from(t).to_rfc3339()
        });
        let modified = metadata.modified().ok().map(|t| {
            DateTime::<Utc>::from(t).to_rfc3339()
        });

        let is_markdown = full_path
            .extension()
            .map_or(false, |ext| ext == "md");

        let (word_count, character_count) = if is_markdown {
            let content = fs::read_to_string(&full_path)?;
            let words = content.split_whitespace().count();
            let chars = content.chars().count();
            (Some(words), Some(chars))
        } else {
            (None, None)
        };

        Ok(FileInfo {
            name: file_name,
            path: relative_path.to_string(),
            size: metadata.len(),
            created,
            modified,
            is_markdown,
            word_count,
            character_count,
        })
    }

    /// Check if a path exists
    pub fn exists(&self, relative_path: &str) -> bool {
        self.resolve_path(relative_path)
            .map(|p| p.exists())
            .unwrap_or(false)
    }

    /// Resolve a relative path to an absolute path within the vault
    fn resolve_path(&self, relative_path: &str) -> AppResult<PathBuf> {
        let clean_path = relative_path.trim_start_matches('/');
        let full_path = self.vault_path.join(clean_path);

        // Security check: ensure the path is within the vault
        let canonical = if full_path.exists() {
            full_path.canonicalize()?
        } else {
            // For non-existent paths, canonicalize the parent
            if let Some(parent) = full_path.parent() {
                if parent.exists() {
                    let canonical_parent = parent.canonicalize()?;
                    canonical_parent.join(full_path.file_name().unwrap_or_default())
                } else {
                    full_path.clone()
                }
            } else {
                full_path.clone()
            }
        };

        let vault_canonical = self.vault_path.canonicalize()?;
        if !canonical.starts_with(&vault_canonical) {
            return Err(AppError::InvalidPath(
                "Path is outside vault".to_string()
            ));
        }

        Ok(full_path)
    }

    /// Get vault path
    pub fn vault_path(&self) -> &Path {
        &self.vault_path
    }

    /// Get all markdown files in the vault
    pub fn get_all_markdown_files(&self) -> AppResult<Vec<String>> {
        let mut files = Vec::new();

        for entry in WalkDir::new(&self.vault_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip hidden files/directories
            if path.components().any(|c| {
                c.as_os_str().to_string_lossy().starts_with('.')
            }) {
                continue;
            }

            if path.extension().map_or(false, |ext| ext == "md") {
                let relative = path
                    .strip_prefix(&self.vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();
                files.push(relative);
            }
        }

        Ok(files)
    }
}

/// Create the initial vault structure
pub fn init_vault(vault_path: &Path) -> AppResult<()> {
    // Create main vault directory
    fs::create_dir_all(vault_path)?;

    // Create .openobs directory for app data
    fs::create_dir_all(vault_path.join(".openobs"))?;

    // Create default folders
    fs::create_dir_all(vault_path.join("Daily Notes"))?;
    fs::create_dir_all(vault_path.join("Templates"))?;
    fs::create_dir_all(vault_path.join("Attachments"))?;

    // Create a welcome note
    let welcome_content = r#"---
title: Welcome to OpenObs
---

# Welcome to OpenObs

Welcome to **OpenObs**, your personal knowledge management system. OpenObs helps you capture, organize, and connect your thoughts using the power of linked notes and markdown.

---

## Getting Started

Here are the basics to help you get up and running:

- **Create a new note** - Press `Ctrl/Cmd + N`
- **Search your vault** - Press `Ctrl/Cmd + P` to quickly find notes
- **Add tags** - Use `#hashtags` to categorize your notes
- **View connections** - Open the graph view to visualize how your notes link together

---

## Creating Links

One of the most powerful features of OpenObs is the ability to link notes together using **wikilinks**. This creates a web of connected ideas that grows with your knowledge.

### Basic Links

To link to another note, wrap the note name in double square brackets:

```
[[Note Name]]
```

For example, `[[My Ideas]]` creates a link to a note called "My Ideas". If the note doesn't exist yet, clicking the link will create it for you.

### Aliased Links

Sometimes you want the link text to be different from the note name. Use the pipe character `|` to set display text:

```
[[Note Name|Display Text]]
```

For example, `[[Meeting Notes 2024-01-15|Monday's Meeting]]` will display as "Monday's Meeting" but link to the full note name.

### Links to Headings

You can link directly to a specific section within a note using the `#` symbol:

```
[[Note Name#Heading]]
```

For example, `[[Project Plan#Timeline]]` links to the "Timeline" section of the "Project Plan" note.

You can also combine this with aliases:

```
[[Project Plan#Timeline|See the timeline]]
```

---

## Features

OpenObs includes everything you need for effective note-taking:

- **Markdown Editing** - Write in plain text with live preview
- **Bidirectional Links** - See which notes link to the current note
- **Full-Text Search** - Find anything in your vault instantly
- **Daily Notes** - Create a new note for each day to capture thoughts and tasks
- **Templates** - Use templates for consistent note structures
- **Graph View** - Visualize your knowledge as an interactive network
- **Tags** - Organize notes with hierarchical tags like `#project/work`

---

## Tips for Building Your Knowledge Base

1. **Start small** - Don't worry about perfect organization. Just start writing.
2. **Link liberally** - When you mention a concept, link to it. Links are free!
3. **Use daily notes** - Capture fleeting thoughts in daily notes, then extract ideas into permanent notes.
4. **Review and connect** - Periodically review your notes and add links between related ideas.
5. **Let structure emerge** - Your organizational system will evolve naturally as you write.

---

Happy note-taking! Start by creating your first note with `Ctrl/Cmd + N`.
"#;

    let welcome_path = vault_path.join("Welcome.md");
    if !welcome_path.exists() {
        fs::write(welcome_path, welcome_content)?;
    }

    // Create a default daily note template
    let daily_template = r#"---
title: "{{title}}"
created: {{datetime}}
tags: [daily-note]
---

# {{title}}

## Tasks

- [ ]

## Notes

"#;

    let template_path = vault_path.join("Templates").join("Daily Note.md");
    if !template_path.exists() {
        fs::write(template_path, daily_template)?;
    }

    Ok(())
}

/// Check if a directory is a valid vault
pub fn is_valid_vault(path: &Path) -> bool {
    path.is_dir()
}

/// Get vault name from path
pub fn get_vault_name(path: &Path) -> String {
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled Vault".to_string())
}
