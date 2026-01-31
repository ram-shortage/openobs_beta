use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::db::Database;
use crate::error::AppResult;
use crate::parser::MarkdownParser;

/// Indexer for building and maintaining the note database
pub struct Indexer {
    parser: MarkdownParser,
}

impl Default for Indexer {
    fn default() -> Self {
        Self::new()
    }
}

impl Indexer {
    pub fn new() -> Self {
        Self {
            parser: MarkdownParser::new(),
        }
    }

    /// Index all markdown files in a vault
    pub fn index_vault(&self, vault_path: &Path, db: &Database) -> AppResult<IndexStats> {
        let mut stats = IndexStats::default();

        for entry in WalkDir::new(vault_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip hidden directories and files
            if path.components().any(|c| {
                c.as_os_str()
                    .to_string_lossy()
                    .starts_with('.')
            }) {
                continue;
            }

            // Only index markdown files
            if path.extension().map_or(false, |ext| ext == "md") {
                match self.index_file(path, vault_path, db) {
                    Ok(_) => stats.files_indexed += 1,
                    Err(e) => {
                        stats.errors += 1;
                        eprintln!("Error indexing {:?}: {}", path, e);
                    }
                }
            }
        }

        // Clean up orphaned entries
        self.cleanup_orphaned_entries(vault_path, db)?;

        Ok(stats)
    }

    /// Index a single file
    pub fn index_file(&self, file_path: &Path, vault_path: &Path, db: &Database) -> AppResult<()> {
        let content = std::fs::read_to_string(file_path)?;
        let relative_path = self.get_relative_path(file_path, vault_path);

        let parsed = self.parser.parse(&content);

        // Get file metadata for timestamps
        let metadata = std::fs::metadata(file_path)?;
        let modified = metadata.modified()
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339());
        let created = metadata.created()
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|_| modified.clone());

        // Determine title (from frontmatter, first heading, or filename)
        let title = if !parsed.title.is_empty() {
            parsed.title.clone()
        } else {
            file_path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default()
        };

        // Store note in database
        db.upsert_note(
            &relative_path,
            &title,
            &parsed.content,
            parsed.frontmatter_raw.as_deref(),
            &created,
            &modified,
        )?;

        // Store links
        let links: Vec<(String, Option<String>)> = parsed
            .wikilinks
            .iter()
            .map(|l| (l.target.clone(), l.display.clone()))
            .collect();
        db.set_links(&relative_path, &links)?;

        // Store tags
        db.set_tags(&relative_path, &parsed.tags)?;

        // Store headings
        let headings: Vec<(i32, String, i32)> = parsed
            .headings
            .iter()
            .map(|h| (h.level, h.text.clone(), h.line as i32))
            .collect();
        db.set_headings(&relative_path, &headings)?;

        Ok(())
    }

    /// Remove a file from the index
    pub fn remove_file(&self, file_path: &Path, vault_path: &Path, db: &Database) -> AppResult<()> {
        let relative_path = self.get_relative_path(file_path, vault_path);
        db.delete_note(&relative_path)?;
        Ok(())
    }

    /// Update the index when a file is renamed/moved
    pub fn rename_file(&self, old_path: &Path, new_path: &Path, vault_path: &Path, db: &Database) -> AppResult<()> {
        let old_relative = self.get_relative_path(old_path, vault_path);
        let new_relative = self.get_relative_path(new_path, vault_path);
        db.update_note_path(&old_relative, &new_relative)?;
        Ok(())
    }

    /// Get relative path from vault root
    fn get_relative_path(&self, file_path: &Path, vault_path: &Path) -> String {
        file_path
            .strip_prefix(vault_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string()
    }

    /// Clean up database entries for files that no longer exist
    fn cleanup_orphaned_entries(&self, vault_path: &Path, db: &Database) -> AppResult<()> {
        let indexed_paths = db.get_all_note_paths()?;

        for path in indexed_paths {
            let full_path = vault_path.join(&path);
            if !full_path.exists() {
                db.delete_note(&path)?;
            }
        }

        Ok(())
    }

    /// Get all markdown files in a directory
    pub fn get_markdown_files(&self, dir_path: &Path) -> Vec<PathBuf> {
        let mut files = Vec::new();

        for entry in WalkDir::new(dir_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip hidden directories and files
            if path.components().any(|c| {
                c.as_os_str()
                    .to_string_lossy()
                    .starts_with('.')
            }) {
                continue;
            }

            if path.extension().map_or(false, |ext| ext == "md") {
                files.push(path.to_path_buf());
            }
        }

        files
    }
}

/// Statistics from indexing operation
#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct IndexStats {
    pub files_indexed: usize,
    pub errors: usize,
}

/// Graph data structures for visualization
#[derive(Debug, Clone, serde::Serialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub path: String,
    pub connections: usize,
    /// Node type: "note" for actual notes, "concept" for shared wikilinks without a page
    #[serde(rename = "nodeType")]
    pub node_type: String,
}

/// Edge type for graph visualization
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    /// Direct link from one note to another existing note
    Direct,
    /// Link through a shared concept (both notes link to the same non-existent page)
    Concept,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    /// Type of edge: "direct" or "concept"
    #[serde(rename = "edgeType")]
    pub edge_type: EdgeType,
    /// For concept edges, the shared concept name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub concept: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    /// List of all concepts (wikilinks to non-existent pages) with the notes that reference them
    pub concepts: Vec<ConceptInfo>,
}

/// Information about a concept (shared wikilink to non-existent page)
#[derive(Debug, Clone, serde::Serialize)]
pub struct ConceptInfo {
    pub name: String,
    /// Number of notes that reference this concept
    pub count: usize,
    /// Paths of notes that reference this concept
    pub notes: Vec<String>,
}

/// Build graph data from the database
pub fn build_graph_data(db: &Database) -> AppResult<GraphData> {
    let note_paths = db.get_all_note_paths()?;
    let all_links = db.get_all_links()?;
    let all_links_with_targets = db.get_all_links_with_targets()?;

    // Create a set of existing note paths for quick lookup
    let existing_notes: std::collections::HashSet<String> = note_paths.iter().cloned().collect();

    // Also check for paths without .md extension
    let existing_notes_without_ext: std::collections::HashSet<String> = note_paths
        .iter()
        .map(|p| p.trim_end_matches(".md").to_string())
        .collect();

    // Build concepts: wikilinks that point to non-existent pages
    // Map from concept name -> list of source note paths
    let mut concept_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

    for (source_path, target) in &all_links_with_targets {
        // Check if target exists as a note
        let target_exists = existing_notes.contains(target)
            || existing_notes.contains(&format!("{}.md", target))
            || existing_notes_without_ext.contains(target);

        if !target_exists {
            // This is a concept (link to non-existent page)
            concept_map
                .entry(target.clone())
                .or_insert_with(Vec::new)
                .push(source_path.clone());
        }
    }

    // Remove duplicate sources for each concept
    for sources in concept_map.values_mut() {
        sources.sort();
        sources.dedup();
    }

    // Build concept info list
    let concepts: Vec<ConceptInfo> = concept_map
        .iter()
        .filter(|(_, notes)| notes.len() >= 1) // Keep all concepts, even with 1 note
        .map(|(name, notes)| ConceptInfo {
            name: name.clone(),
            count: notes.len(),
            notes: notes.clone(),
        })
        .collect();

    // Count connections for each node (including concept connections)
    let mut connection_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    // Count direct link connections
    for (source, target) in &all_links {
        *connection_counts.entry(source.clone()).or_insert(0) += 1;
        *connection_counts.entry(target.clone()).or_insert(0) += 1;
    }

    // Count concept connections (each shared concept adds connections)
    for concept_info in &concepts {
        if concept_info.notes.len() > 1 {
            let additional_connections = concept_info.notes.len() - 1;
            for note in &concept_info.notes {
                *connection_counts.entry(note.clone()).or_insert(0) += additional_connections;
            }
        }
    }

    // Build nodes
    let nodes: Vec<GraphNode> = note_paths
        .iter()
        .map(|path| {
            let label = path
                .trim_end_matches(".md")
                .rsplit('/')
                .next()
                .unwrap_or(path)
                .to_string();

            GraphNode {
                id: path.clone(),
                label,
                path: path.clone(),
                connections: *connection_counts.get(path).unwrap_or(&0),
                node_type: "note".to_string(),
            }
        })
        .collect();

    // Build edges
    let mut edges: Vec<GraphEdge> = Vec::new();

    // Add direct edges (links between existing notes)
    for (source, target) in &all_links {
        // Only add edge if both source and target exist as notes
        if existing_notes.contains(target)
            || existing_notes.contains(&format!("{}.md", target))
        {
            edges.push(GraphEdge {
                source: source.clone(),
                target: target.clone(),
                edge_type: EdgeType::Direct,
                concept: None,
            });
        }
    }

    // Add concept edges (connect notes that share a concept)
    for concept_info in &concepts {
        if concept_info.notes.len() > 1 {
            // Create edges between all pairs of notes sharing this concept
            for i in 0..concept_info.notes.len() {
                for j in (i + 1)..concept_info.notes.len() {
                    edges.push(GraphEdge {
                        source: concept_info.notes[i].clone(),
                        target: concept_info.notes[j].clone(),
                        edge_type: EdgeType::Concept,
                        concept: Some(concept_info.name.clone()),
                    });
                }
            }
        }
    }

    Ok(GraphData { nodes, edges, concepts })
}

/// Build local graph data centered on a specific note
pub fn build_local_graph(db: &Database, center_path: &str, depth: usize) -> AppResult<GraphData> {
    let note_paths = db.get_all_note_paths()?;
    let existing_notes: std::collections::HashSet<String> = note_paths.iter().cloned().collect();

    let mut visited = std::collections::HashSet::new();
    let mut to_visit = vec![(center_path.to_string(), 0usize)];
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    // Get concept connections for the center note and its neighbors
    let all_links_with_targets = db.get_all_links_with_targets()?;

    // Build concept map
    let mut concept_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (source_path, target) in &all_links_with_targets {
        let target_exists = existing_notes.contains(target)
            || existing_notes.contains(&format!("{}.md", target));
        if !target_exists {
            concept_map
                .entry(target.clone())
                .or_insert_with(Vec::new)
                .push(source_path.clone());
        }
    }
    for sources in concept_map.values_mut() {
        sources.sort();
        sources.dedup();
    }

    while let Some((current_path, current_depth)) = to_visit.pop() {
        if visited.contains(&current_path) || current_depth > depth {
            continue;
        }
        visited.insert(current_path.clone());

        // Add node
        let label = current_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or(&current_path)
            .to_string();

        let backlinks = db.get_backlinks(&current_path)?;
        let outgoing = db.get_outgoing_links(&current_path)?;

        // Count concept connections
        let concept_connections: usize = concept_map
            .values()
            .filter(|notes| notes.contains(&current_path) && notes.len() > 1)
            .map(|notes| notes.len() - 1)
            .sum();

        nodes.push(GraphNode {
            id: current_path.clone(),
            label,
            path: current_path.clone(),
            connections: backlinks.len() + outgoing.len() + concept_connections,
            node_type: "note".to_string(),
        });

        // Add edges and queue neighbors
        for link in &backlinks {
            edges.push(GraphEdge {
                source: link.path.clone(),
                target: current_path.clone(),
                edge_type: EdgeType::Direct,
                concept: None,
            });
            if current_depth < depth {
                to_visit.push((link.path.clone(), current_depth + 1));
            }
        }

        for link in &outgoing {
            // Only add direct edges for existing notes
            if existing_notes.contains(&link.path) || existing_notes.contains(&format!("{}.md", link.path)) {
                edges.push(GraphEdge {
                    source: current_path.clone(),
                    target: link.path.clone(),
                    edge_type: EdgeType::Direct,
                    concept: None,
                });
                if current_depth < depth {
                    to_visit.push((link.path.clone(), current_depth + 1));
                }
            }
        }

        // Add concept neighbors (notes sharing concepts with current note)
        if current_depth < depth {
            for (_concept_name, concept_notes) in &concept_map {
                if concept_notes.contains(&current_path) && concept_notes.len() > 1 {
                    for other_note in concept_notes {
                        if other_note != &current_path && !visited.contains(other_note) {
                            to_visit.push((other_note.clone(), current_depth + 1));
                        }
                    }
                }
            }
        }
    }

    // Add concept edges between visited nodes
    for (concept_name, concept_notes) in &concept_map {
        let visited_notes: Vec<&String> = concept_notes
            .iter()
            .filter(|n| visited.contains(*n))
            .collect();

        if visited_notes.len() > 1 {
            for i in 0..visited_notes.len() {
                for j in (i + 1)..visited_notes.len() {
                    edges.push(GraphEdge {
                        source: visited_notes[i].clone(),
                        target: visited_notes[j].clone(),
                        edge_type: EdgeType::Concept,
                        concept: Some(concept_name.clone()),
                    });
                }
            }
        }
    }

    // Deduplicate edges
    let mut seen_edges = std::collections::HashSet::new();
    edges.retain(|e| {
        let key = format!("{}:{}:{:?}", e.source, e.target, e.edge_type);
        seen_edges.insert(key)
    });

    // Build concept info for visited nodes
    let concepts: Vec<ConceptInfo> = concept_map
        .iter()
        .filter(|(_, notes)| notes.iter().any(|n| visited.contains(n)))
        .map(|(name, notes)| ConceptInfo {
            name: name.clone(),
            count: notes.len(),
            notes: notes.clone(),
        })
        .collect();

    Ok(GraphData { nodes, edges, concepts })
}
