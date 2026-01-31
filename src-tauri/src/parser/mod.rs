use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Parsed representation of a markdown note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedNote {
    /// The note title (from frontmatter or first heading)
    pub title: String,
    /// The raw content without frontmatter
    pub content: String,
    /// Parsed frontmatter as key-value pairs
    pub frontmatter: Option<HashMap<String, serde_yaml::Value>>,
    /// Raw frontmatter YAML string
    pub frontmatter_raw: Option<String>,
    /// Wikilinks found in the note [[target]] or [[target|display]]
    pub wikilinks: Vec<WikiLink>,
    /// Tags found in the note (#tag)
    pub tags: Vec<String>,
    /// Headings found in the note
    pub headings: Vec<Heading>,
}

/// A wikilink [[target]] or [[target|display]]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiLink {
    /// The target of the link (note name or path)
    pub target: String,
    /// Optional display text
    pub display: Option<String>,
    /// Line number where the link appears
    pub line: usize,
}

/// A heading in the document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heading {
    /// Heading level (1-6)
    pub level: i32,
    /// Heading text
    pub text: String,
    /// Line number
    pub line: usize,
}

/// Parser for markdown notes with Obsidian-style features
pub struct MarkdownParser {
    wikilink_re: Regex,
    tag_re: Regex,
    heading_re: Regex,
    frontmatter_re: Regex,
}

impl Default for MarkdownParser {
    fn default() -> Self {
        Self::new()
    }
}

impl MarkdownParser {
    pub fn new() -> Self {
        Self {
            // Match [[target]] or [[target|display]]
            wikilink_re: Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap(),
            // Match #tag (but not in code blocks or URLs)
            tag_re: Regex::new(r"(?:^|[\s\[])#([a-zA-Z][a-zA-Z0-9_/-]*)").unwrap(),
            // Match headings
            heading_re: Regex::new(r"^(#{1,6})\s+(.+)$").unwrap(),
            // Match frontmatter block
            frontmatter_re: Regex::new(r"(?s)^---\r?\n(.+?)\r?\n---\r?\n?").unwrap(),
        }
    }

    /// Parse a markdown note
    pub fn parse(&self, content: &str) -> ParsedNote {
        let (frontmatter, frontmatter_raw, content_without_fm) = self.parse_frontmatter(content);
        let wikilinks = self.extract_wikilinks(&content_without_fm);
        let tags = self.extract_tags(&content_without_fm, &frontmatter);
        let headings = self.extract_headings(&content_without_fm);

        // Determine title from frontmatter, first heading, or empty
        let title = self.determine_title(&frontmatter, &headings);

        ParsedNote {
            title,
            content: content_without_fm,
            frontmatter,
            frontmatter_raw,
            wikilinks,
            tags,
            headings,
        }
    }

    /// Parse frontmatter from the beginning of the content
    fn parse_frontmatter(&self, content: &str) -> (Option<HashMap<String, serde_yaml::Value>>, Option<String>, String) {
        if let Some(captures) = self.frontmatter_re.captures(content) {
            let yaml_content = captures.get(1).map(|m| m.as_str()).unwrap_or("");
            let full_match = captures.get(0).map(|m| m.as_str()).unwrap_or("");

            // Parse YAML
            let frontmatter: Option<HashMap<String, serde_yaml::Value>> =
                serde_yaml::from_str(yaml_content).ok();

            // Content after frontmatter
            let content_without_fm = content[full_match.len()..].to_string();

            (frontmatter, Some(yaml_content.to_string()), content_without_fm)
        } else {
            (None, None, content.to_string())
        }
    }

    /// Extract wikilinks from content
    fn extract_wikilinks(&self, content: &str) -> Vec<WikiLink> {
        let mut links = Vec::new();

        for (line_num, line) in content.lines().enumerate() {
            // Skip code blocks (basic check)
            if line.trim_start().starts_with("```") || line.trim_start().starts_with('`') {
                continue;
            }

            for captures in self.wikilink_re.captures_iter(line) {
                let target = captures.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                let display = captures.get(2).map(|m| m.as_str().trim().to_string());

                if !target.is_empty() {
                    links.push(WikiLink {
                        target,
                        display,
                        line: line_num + 1,
                    });
                }
            }
        }

        links
    }

    /// Extract tags from content and frontmatter
    fn extract_tags(&self, content: &str, frontmatter: &Option<HashMap<String, serde_yaml::Value>>) -> Vec<String> {
        let mut tags = Vec::new();
        let mut seen = std::collections::HashSet::new();

        // Extract tags from frontmatter
        if let Some(fm) = frontmatter {
            if let Some(fm_tags) = fm.get("tags") {
                match fm_tags {
                    serde_yaml::Value::Sequence(seq) => {
                        for tag in seq {
                            if let serde_yaml::Value::String(s) = tag {
                                let normalized = s.trim_start_matches('#').to_string();
                                if !seen.contains(&normalized) {
                                    seen.insert(normalized.clone());
                                    tags.push(normalized);
                                }
                            }
                        }
                    }
                    serde_yaml::Value::String(s) => {
                        // Handle comma-separated tags
                        for tag in s.split(',') {
                            let normalized = tag.trim().trim_start_matches('#').to_string();
                            if !normalized.is_empty() && !seen.contains(&normalized) {
                                seen.insert(normalized.clone());
                                tags.push(normalized);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // Extract inline tags from content
        let mut in_code_block = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("```") {
                in_code_block = !in_code_block;
                continue;
            }

            if in_code_block {
                continue;
            }

            for captures in self.tag_re.captures_iter(line) {
                if let Some(tag_match) = captures.get(1) {
                    let tag = tag_match.as_str().to_string();
                    if !seen.contains(&tag) {
                        seen.insert(tag.clone());
                        tags.push(tag);
                    }
                }
            }
        }

        tags
    }

    /// Extract headings from content
    fn extract_headings(&self, content: &str) -> Vec<Heading> {
        let mut headings = Vec::new();
        let mut in_code_block = false;

        for (line_num, line) in content.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.starts_with("```") {
                in_code_block = !in_code_block;
                continue;
            }

            if in_code_block {
                continue;
            }

            if let Some(captures) = self.heading_re.captures(line) {
                let hashes = captures.get(1).map(|m| m.as_str()).unwrap_or("");
                let text = captures.get(2).map(|m| m.as_str().trim()).unwrap_or("");

                if !text.is_empty() {
                    headings.push(Heading {
                        level: hashes.len() as i32,
                        text: text.to_string(),
                        line: line_num + 1,
                    });
                }
            }
        }

        headings
    }

    /// Determine the note title from frontmatter or first heading
    fn determine_title(&self, frontmatter: &Option<HashMap<String, serde_yaml::Value>>, headings: &[Heading]) -> String {
        // Check frontmatter for title
        if let Some(fm) = frontmatter {
            if let Some(serde_yaml::Value::String(title)) = fm.get("title") {
                return title.clone();
            }
        }

        // Use first heading as title
        if let Some(heading) = headings.first() {
            return heading.text.clone();
        }

        String::new()
    }

    /// Convert parsed note back to markdown with frontmatter
    pub fn to_markdown(&self, note: &ParsedNote) -> String {
        let mut result = String::new();

        if let Some(ref fm) = note.frontmatter {
            if !fm.is_empty() {
                result.push_str("---\n");
                if let Ok(yaml) = serde_yaml::to_string(fm) {
                    result.push_str(&yaml);
                }
                result.push_str("---\n\n");
            }
        }

        result.push_str(&note.content);
        result
    }
}

/// Template processing for daily notes and other templates
pub struct TemplateProcessor;

impl TemplateProcessor {
    /// Process template variables in content
    pub fn process(template: &str, variables: &HashMap<String, String>) -> String {
        let mut result = template.to_string();

        // Process standard date variables
        let now = chrono::Local::now();

        // {{date}} - current date in YYYY-MM-DD format
        result = result.replace("{{date}}", &now.format("%Y-%m-%d").to_string());

        // {{time}} - current time in HH:MM format
        result = result.replace("{{time}}", &now.format("%H:%M").to_string());

        // {{datetime}} - full datetime
        result = result.replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M").to_string());

        // {{title}} - note title
        if let Some(title) = variables.get("title") {
            result = result.replace("{{title}}", title);
        }

        // {{date:FORMAT}} - custom date format
        let date_format_re = Regex::new(r"\{\{date:([^}]+)\}\}").unwrap();
        result = date_format_re.replace_all(&result, |caps: &regex::Captures| {
            let format = caps.get(1).map(|m| m.as_str()).unwrap_or("%Y-%m-%d");
            now.format(format).to_string()
        }).to_string();

        // Process custom variables
        for (key, value) in variables {
            result = result.replace(&format!("{{{{{}}}}}", key), value);
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let parser = MarkdownParser::new();
        let content = r#"---
title: Test Note
tags: [rust, programming]
---

# Hello World

This is a test note."#;

        let parsed = parser.parse(content);

        assert_eq!(parsed.title, "Test Note");
        assert!(parsed.frontmatter.is_some());
        assert!(parsed.tags.contains(&"rust".to_string()));
        assert!(parsed.tags.contains(&"programming".to_string()));
    }

    #[test]
    fn test_extract_wikilinks() {
        let parser = MarkdownParser::new();
        let content = "Check out [[Another Note]] and [[Folder/Note|Display Text]]";

        let parsed = parser.parse(content);

        assert_eq!(parsed.wikilinks.len(), 2);
        assert_eq!(parsed.wikilinks[0].target, "Another Note");
        assert_eq!(parsed.wikilinks[1].target, "Folder/Note");
        assert_eq!(parsed.wikilinks[1].display, Some("Display Text".to_string()));
    }

    #[test]
    fn test_extract_tags() {
        let parser = MarkdownParser::new();
        let content = "This is a #test note with #multiple/nested tags";

        let parsed = parser.parse(content);

        assert!(parsed.tags.contains(&"test".to_string()));
        assert!(parsed.tags.contains(&"multiple/nested".to_string()));
    }

    #[test]
    fn test_extract_headings() {
        let parser = MarkdownParser::new();
        let content = r#"# Main Title

Some content

## Section 1

More content

### Subsection

Even more"#;

        let parsed = parser.parse(content);

        assert_eq!(parsed.headings.len(), 3);
        assert_eq!(parsed.headings[0].level, 1);
        assert_eq!(parsed.headings[0].text, "Main Title");
        assert_eq!(parsed.headings[1].level, 2);
        assert_eq!(parsed.headings[2].level, 3);
    }
}
