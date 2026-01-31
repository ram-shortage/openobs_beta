# OpenObs - Implementation Plan

> Obsidian-like note-taking app built with Tauri 2.0 + React

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.0 (Rust backend, native webview) |
| Frontend | React 18 + TypeScript + Vite |
| Editor (Source) | CodeMirror 6 |
| Editor (WYSIWYG) | ProseMirror |
| State | Zustand |
| Database | SQLite with FTS5 |
| Storage | Plain .md files on disk |
| Graph | D3.js force-directed |
| Canvas | React Flow |

---

## Phase 1: Project Foundation

### 1.1 Initialize Tauri + React Project
**Goal**: Scaffold the project with Tauri 2.0 and React

**Tasks**:
- [ ] Create Tauri app with React template: `npm create tauri-app@latest`
- [ ] Configure TypeScript strict mode
- [ ] Set up Vite with path aliases (`@/components`, `@/lib`, etc.)
- [ ] Add ESLint + Prettier configuration
- [ ] Create folder structure:
  ```
  src-tauri/src/
    ├── commands/
    ├── db/
    ├── fs/
    ├── indexer/
    └── parser/
  src/
    ├── components/
    ├── hooks/
    ├── store/
    ├── lib/
    └── types/
  ```

**Verification**:
- Run `npm run tauri dev` - app window opens
- React hot reload works

---

### 1.2 Rust Backend Foundation
**Goal**: Set up core Rust dependencies and module structure

**Tasks**:
- [ ] Add Cargo dependencies to `src-tauri/Cargo.toml`:
  ```toml
  [dependencies]
  tauri = { version = "2", features = ["devtools"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  tokio = { version = "1", features = ["full"] }
  rusqlite = { version = "0.31", features = ["bundled", "fts5"] }
  notify = "6"
  pulldown-cmark = "0.10"
  serde_yaml = "0.9"
  uuid = { version = "1", features = ["v4"] }
  thiserror = "1"
  ```
- [ ] Create error handling module (`src-tauri/src/error.rs`)
- [ ] Create app state struct for Tauri
- [ ] Set up module files (mod.rs for each folder)

**Verification**:
- `cargo check` passes in `src-tauri/`
- `cargo test` runs (even if no tests yet)

---

### 1.3 React Frontend Foundation
**Goal**: Set up React with required dependencies

**Tasks**:
- [ ] Install npm dependencies:
  ```bash
  npm install zustand @tauri-apps/api lucide-react date-fns clsx
  npm install -D tailwindcss postcss autoprefixer @types/node
  ```
- [ ] Configure Tailwind CSS
- [ ] Create Zustand store skeleton (`src/store/index.ts`)
- [ ] Create Tauri API wrapper (`src/lib/tauri.ts`)
- [ ] Set up base layout component with sidebar placeholder

**Verification**:
- App renders with sidebar and main content area
- Tailwind styles apply correctly

---

## Phase 2: Vault & File System

### 2.1 Vault Selection
**Goal**: Allow users to open/create vaults (folders)

**Rust Tasks**:
- [ ] Create `commands/vault.rs`:
  - `open_vault(path: String)` - validate folder, create `.openobs/` if missing
  - `create_vault(path: String, name: String)` - create folder + init
  - `get_recent_vaults()` - read from app config
  - `save_recent_vault(path: String)` - persist to app config
- [ ] Create vault config structure (`.openobs/config.json`)

**React Tasks**:
- [ ] Create `VaultPicker` component (modal/page)
- [ ] Create vault store slice in Zustand
- [ ] Handle "Open Folder" dialog via Tauri
- [ ] Persist last opened vault

**Verification**:
- Can select a folder as vault
- `.openobs/` folder created inside vault
- Reopening app returns to last vault

---

### 2.2 File Tree
**Goal**: Display vault contents in a tree sidebar

**Rust Tasks**:
- [ ] Create `commands/files.rs`:
  - `read_directory(path: String)` - returns files/folders with metadata
  - `watch_directory(path: String)` - start file watcher
- [ ] Create `fs/watcher.rs` using `notify` crate
- [ ] Emit events to frontend on file changes

**React Tasks**:
- [ ] Create `FileTree` component (recursive)
- [ ] Create `FileTreeItem` component (file/folder)
- [ ] Handle expand/collapse folders
- [ ] Handle file selection (open in editor)
- [ ] Show file icons (folder, markdown, image, etc.)
- [ ] Context menu (right-click): New File, New Folder, Rename, Delete

**Verification**:
- File tree shows vault contents
- Clicking file opens it (placeholder for now)
- Creating file externally updates tree

---

### 2.3 File Operations
**Goal**: CRUD operations for notes

**Rust Tasks**:
- [ ] Add to `commands/files.rs`:
  - `create_file(path: String, content: String)`
  - `read_file(path: String)` -> String
  - `write_file(path: String, content: String)`
  - `delete_file(path: String)`
  - `rename_file(old: String, new: String)`
  - `move_file(from: String, to: String)`
  - `create_folder(path: String)`
  - `delete_folder(path: String)`

**React Tasks**:
- [ ] Create file operations in store
- [ ] Wire up context menu actions
- [ ] Add "New Note" button to sidebar header
- [ ] Add keyboard shortcuts (Ctrl+N for new note)

**Verification**:
- Create, rename, delete files from UI
- Changes persist to disk
- File tree updates accordingly

---

## Phase 3: Markdown Editor

### 3.1 Source Mode Editor (CodeMirror)
**Goal**: Basic markdown editing with syntax highlighting

**Tasks**:
- [ ] Install CodeMirror packages:
  ```bash
  npm install @codemirror/view @codemirror/state @codemirror/commands
  npm install @codemirror/lang-markdown @codemirror/language-data
  npm install @codemirror/theme-one-dark
  ```
- [ ] Create `Editor` component wrapping CodeMirror
- [ ] Configure markdown language support
- [ ] Add syntax highlighting for code blocks
- [ ] Implement auto-save (debounced write to disk)
- [ ] Handle undo/redo
- [ ] Add basic toolbar (bold, italic, heading, list, etc.)

**Verification**:
- Open .md file, edit, auto-saves
- Syntax highlighting works
- Code blocks have language highlighting

---

### 3.2 Live Preview Mode (ProseMirror)
**Goal**: Obsidian-style inline rendering while editing

**Tasks**:
- [ ] Install ProseMirror packages:
  ```bash
  npm install prosemirror-state prosemirror-view prosemirror-model
  npm install prosemirror-markdown prosemirror-commands prosemirror-keymap
  npm install prosemirror-history prosemirror-inputrules
  ```
- [ ] Create ProseMirror schema for markdown
- [ ] Create `LivePreviewEditor` component
- [ ] Implement inline rendering:
  - Headers render as styled headings
  - Bold/italic render inline
  - Links render as clickable
  - Images render inline
  - Code blocks render with highlighting
  - Checkboxes render as interactive
- [ ] Sync ProseMirror state back to markdown

**Verification**:
- Toggle between source and live preview
- Edits in live preview save as valid markdown
- Formatting renders inline while typing

---

### 3.3 Reading Mode
**Goal**: Fully rendered, non-editable view

**Tasks**:
- [ ] Create `ReadingView` component
- [ ] Use `remark` + `rehype` for markdown → HTML
- [ ] Style rendered output
- [ ] Make links clickable (internal + external)
- [ ] Add mode toggle button (source / live / reading)

**Verification**:
- Reading mode shows fully rendered note
- Cannot edit in reading mode
- Toggle between all three modes works

---

### 3.4 Advanced Editor Features
**Goal**: Full markdown support

**Tasks**:
- [ ] Math/LaTeX support:
  ```bash
  npm install katex remark-math rehype-katex
  ```
- [ ] Tables (GFM-style)
- [ ] Callouts/admonitions (Obsidian-style `> [!note]`)
- [ ] Footnotes
- [ ] Task lists with checkboxes
- [ ] Horizontal rules
- [ ] Find & replace within note (Ctrl+F, Ctrl+H)

**Verification**:
- Math equations render
- Tables render correctly
- Callouts display styled boxes

---

## Phase 4: Wikilinks & Backlinks

### 4.1 Wikilink Syntax
**Goal**: Support `[[wikilink]]` syntax

**Tasks**:
- [ ] Add wikilink parsing to CodeMirror (custom syntax extension)
- [ ] Add wikilink rendering to ProseMirror
- [ ] Implement link formats:
  - `[[note]]` - basic link
  - `[[note|alias]]` - aliased link
  - `[[note#heading]]` - heading link
  - `[[note#^blockid]]` - block reference
- [ ] Make wikilinks clickable (Ctrl+click or regular click)
- [ ] Navigate to linked note on click

**Verification**:
- Wikilinks highlight in editor
- Clicking opens target note
- Aliased text displays correctly

---

### 4.2 Link Auto-complete
**Goal**: Suggest notes while typing `[[`

**Tasks**:
- [ ] Detect `[[` trigger in editor
- [ ] Query available notes from backend
- [ ] Show dropdown with fuzzy-matched suggestions
- [ ] Include headings for `#` completion
- [ ] Insert selected note and close `]]`

**Verification**:
- Type `[[` and see suggestions
- Fuzzy search filters results
- Tab/Enter inserts link

---

### 4.3 Link Indexing (Rust)
**Goal**: Build index of all links in vault

**Rust Tasks**:
- [ ] Create `indexer/links.rs`:
  - Parse all markdown files for wikilinks
  - Extract outgoing links per file
  - Store in SQLite `links` table
- [ ] Create `commands/links.rs`:
  - `get_backlinks(path: String)` - notes linking to this file
  - `get_outgoing_links(path: String)` - links from this file
  - `get_unlinked_mentions(path: String)` - text matching filename
- [ ] Update index on file save/delete

**Verification**:
- Backlinks query returns correct notes
- Index updates when files change

---

### 4.4 Backlinks Panel
**Goal**: Show notes linking to current note

**React Tasks**:
- [ ] Create `BacklinksPanel` component
- [ ] Display list of linking notes
- [ ] Show context snippet around link
- [ ] Click to navigate to linking note
- [ ] Show count badge in panel header

**Verification**:
- Panel shows all backlinks
- Context helps understand link usage
- Navigation works

---

### 4.5 Outgoing Links & Unlinked Mentions
**Goal**: Complete link panels

**Tasks**:
- [ ] Create `OutgoingLinksPanel` component
- [ ] Create `UnlinkedMentionsPanel` component
- [ ] Add "Link" button to convert mention to wikilink
- [ ] Tab interface for Backlinks / Outgoing / Unlinked

**Verification**:
- All three panels functional
- Can create links from unlinked mentions

---

## Phase 5: Search

### 5.1 SQLite + FTS5 Setup
**Goal**: Full-text search infrastructure

**Rust Tasks**:
- [ ] Create `db/mod.rs` with SQLite connection
- [ ] Create tables:
  ```sql
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    created_at INTEGER,
    modified_at INTEGER
  );

  CREATE VIRTUAL TABLE notes_fts USING fts5(
    title, content, tags,
    content='notes', content_rowid='rowid'
  );

  CREATE TABLE links (
    source_id TEXT,
    target_path TEXT,
    link_type TEXT
  );

  CREATE TABLE tags (
    note_id TEXT,
    tag TEXT
  );
  ```
- [ ] Index all notes on vault open
- [ ] Update index on file changes

**Verification**:
- Database created in `.openobs/`
- Notes indexed on vault open

---

### 5.2 Search Commands
**Goal**: Search API

**Rust Tasks**:
- [ ] Create `commands/search.rs`:
  - `search(query: String)` - full-text search
  - `search_by_tag(tag: String)`
  - `search_by_path(path_pattern: String)`
- [ ] Implement FTS5 query building
- [ ] Return results with snippets (FTS5 `snippet()` function)
- [ ] Sort by relevance (BM25)

**Verification**:
- Search returns relevant results
- Snippets show context

---

### 5.3 Search UI
**Goal**: Search interface

**React Tasks**:
- [ ] Create `SearchPanel` component (sidebar)
- [ ] Create `SearchModal` component (quick switcher style)
- [ ] Search input with debounce
- [ ] Results list with:
  - File name
  - Path
  - Context snippet
  - Match highlighting
- [ ] Keyboard navigation (up/down arrows, enter to open)
- [ ] Search operators help tooltip

**Verification**:
- Search as you type
- Results update live
- Can open results with keyboard

---

### 5.4 Quick Switcher
**Goal**: Fast file switching (Ctrl+O)

**Tasks**:
- [ ] Create `QuickSwitcher` modal component
- [ ] Fuzzy file name matching
- [ ] Show recent files first
- [ ] Keyboard shortcut to open (Ctrl+O / Cmd+O)

**Verification**:
- Ctrl+O opens switcher
- Typing filters files
- Enter opens selected file

---

## Phase 6: Graph View

### 6.1 Graph Data Structure
**Goal**: Prepare graph data from links

**Rust Tasks**:
- [ ] Create `commands/graph.rs`:
  - `get_graph_data()` - all nodes and edges
  - `get_local_graph(path: String, depth: u32)` - subgraph around note
- [ ] Node data: id, path, title, link count
- [ ] Edge data: source, target, type

**Verification**:
- API returns graph structure
- Local graph respects depth

---

### 6.2 Graph Visualization
**Goal**: Interactive graph view

**React Tasks**:
- [ ] Install D3:
  ```bash
  npm install d3 @types/d3
  ```
- [ ] Create `GraphView` component
- [ ] Implement force-directed layout
- [ ] Node sizing based on connection count
- [ ] Edge drawing between linked nodes
- [ ] Pan and zoom (D3 zoom behavior)
- [ ] Click node to open note
- [ ] Hover to highlight connections

**Verification**:
- Graph renders all notes
- Layout stabilizes
- Interactions work

---

### 6.3 Graph Controls
**Goal**: Filter and customize graph

**Tasks**:
- [ ] Create `GraphControls` panel:
  - Filter by folder path
  - Filter by tag
  - Show/hide orphan nodes
  - Depth slider for local graph
- [ ] Node color coding options (by folder, by tag)
- [ ] Search/highlight specific node
- [ ] Local graph toggle

**Verification**:
- Filters update graph
- Colors apply correctly

---

## Phase 7: Tags

### 7.1 Tag Parsing
**Goal**: Extract and index tags

**Rust Tasks**:
- [ ] Add tag extraction to indexer
- [ ] Support `#tag` and `#parent/child` nested tags
- [ ] Store in `tags` table
- [ ] Create `commands/tags.rs`:
  - `get_all_tags()` - list with counts
  - `get_notes_by_tag(tag: String)`

**Verification**:
- Tags extracted from notes
- Nested tags indexed correctly

---

### 7.2 Tag Panel
**Goal**: Tag browser sidebar

**React Tasks**:
- [ ] Create `TagsPanel` component
- [ ] Tree view for nested tags
- [ ] Show count per tag
- [ ] Click tag to search/filter
- [ ] Tag in editor clickable

**Verification**:
- Tags panel shows all tags
- Clicking filters notes

---

## Phase 8: Daily Notes & Templates

### 8.1 Daily Notes
**Goal**: Date-based note creation

**Rust Tasks**:
- [ ] Create `commands/daily.rs`:
  - `get_daily_note(date: String)` - get or create
  - `get_daily_notes_list()` - all daily notes
- [ ] Configurable date format
- [ ] Configurable daily notes folder

**React Tasks**:
- [ ] Add "Today's Daily Note" button
- [ ] Keyboard shortcut (Alt+D or similar)
- [ ] Previous/next daily note navigation
- [ ] Optional: Calendar picker

**Verification**:
- Creates today's note if missing
- Opens if exists
- Navigate between days

---

### 8.2 Templates
**Goal**: Reusable note templates

**Rust Tasks**:
- [ ] Create `commands/templates.rs`:
  - `get_templates()` - list template files
  - `apply_template(template: String, variables: HashMap)`
- [ ] Template variable substitution:
  - `{{date}}`, `{{date:format}}`
  - `{{time}}`
  - `{{title}}`

**React Tasks**:
- [ ] Configure templates folder in settings
- [ ] "Insert Template" command
- [ ] Template picker modal
- [ ] "New Note from Template" option

**Verification**:
- Templates listed from folder
- Variables substituted correctly

---

## Phase 9: Tabs & Split Panes

### 9.1 Tab System
**Goal**: Multiple notes open in tabs

**React Tasks**:
- [ ] Create `TabBar` component
- [ ] Tab state in Zustand (open tabs, active tab)
- [ ] Click tab to switch
- [ ] Close button on tabs
- [ ] Tab context menu (Close, Close Others, Close All)
- [ ] Drag to reorder tabs

**Verification**:
- Multiple files open as tabs
- Switching tabs works
- State persists on reload

---

### 9.2 Split Panes
**Goal**: View multiple notes side by side

**Tasks**:
- [ ] Install split pane library or implement custom
- [ ] Horizontal and vertical splits
- [ ] Split current tab to right/below
- [ ] Resize handles
- [ ] Close pane

**Verification**:
- Can split view
- Each pane has its own tabs
- Resize works smoothly

---

## Phase 10: Canvas

### 10.1 Canvas Foundation
**Goal**: Infinite canvas workspace

**Tasks**:
- [ ] Install React Flow:
  ```bash
  npm install reactflow
  ```
- [ ] Create `.canvas` file format (JSON)
- [ ] Create `CanvasView` component
- [ ] Implement pan and zoom
- [ ] Add text card nodes
- [ ] Add note embed nodes (renders note content)

**Verification**:
- Can create canvas file
- Add cards and notes
- Pan/zoom works

---

### 10.2 Canvas Features
**Goal**: Full canvas functionality

**Tasks**:
- [ ] Connection arrows between nodes
- [ ] Image/PDF embed nodes
- [ ] Color coding for cards
- [ ] Grouping/frames
- [ ] Minimap
- [ ] Export canvas as image

**Verification**:
- All node types work
- Connections persist
- Export produces image

---

## Phase 11: Settings & Appearance

### 11.1 Settings System
**Goal**: App and vault settings

**Rust Tasks**:
- [ ] Create `commands/settings.rs`:
  - `get_settings()` - merged app + vault settings
  - `set_setting(key: String, value: Value)`
- [ ] App-level settings (`.openobs/` in app data)
- [ ] Vault-level settings (`.openobs/config.json`)

**React Tasks**:
- [ ] Create `SettingsModal` component
- [ ] Organized sections:
  - Editor (font, size, line height, vim mode)
  - Files (auto-save, default location)
  - Appearance (theme, accent color)
  - Hotkeys
- [ ] Settings sync to backend

**Verification**:
- Settings persist
- Changes apply immediately

---

### 11.2 Themes
**Goal**: Light/dark mode and customization

**Tasks**:
- [ ] Light and dark theme CSS
- [ ] System theme detection
- [ ] Theme toggle in UI
- [ ] Custom CSS file support (`.openobs/custom.css`)
- [ ] CSS variables for easy theming

**Verification**:
- Theme toggles correctly
- System preference respected
- Custom CSS applies

---

### 11.3 Hotkeys
**Goal**: Configurable keyboard shortcuts

**Tasks**:
- [ ] Default hotkey mappings
- [ ] Hotkey settings UI
- [ ] Conflict detection
- [ ] Reset to defaults option
- [ ] Common hotkeys:
  - Ctrl+N: New note
  - Ctrl+O: Quick switcher
  - Ctrl+P: Command palette
  - Ctrl+S: Save (even with auto-save)
  - Ctrl+F: Find in note
  - Ctrl+Shift+F: Global search

**Verification**:
- All hotkeys work
- Can customize and save

---

### 11.4 Command Palette
**Goal**: Searchable command interface

**Tasks**:
- [ ] Create `CommandPalette` modal
- [ ] Register all commands with metadata
- [ ] Fuzzy search commands
- [ ] Show hotkey hints
- [ ] Ctrl+P / Cmd+P to open

**Verification**:
- All commands accessible
- Search filters correctly
- Execution works

---

## Phase 12: Export & Import

### 12.1 Export
**Goal**: Export notes in various formats

**Rust Tasks**:
- [ ] Create `commands/export.rs`:
  - `export_to_pdf(path: String, output: String)`
  - `export_to_html(path: String, output: String)`
  - `export_vault_zip(output: String)`

**React Tasks**:
- [ ] Export menu in note actions
- [ ] Export dialog with options
- [ ] Progress indicator for vault export

**Verification**:
- PDF export renders correctly
- HTML export is standalone
- Zip includes all files

---

## Phase 13: Polish & Performance

### 13.1 Performance Optimization
**Goal**: Handle large vaults smoothly

**Tasks**:
- [ ] Virtual scrolling for file tree
- [ ] Lazy loading for graph (visible nodes only)
- [ ] Debounce search indexing
- [ ] Background indexing on vault open
- [ ] Memoization in React components

**Verification**:
- Test with 10,000+ notes
- No UI lag
- Search remains fast

---

### 13.2 Error Handling & UX
**Goal**: Graceful error handling

**Tasks**:
- [ ] Error boundary components
- [ ] Toast notifications for errors
- [ ] Confirmation dialogs for destructive actions
- [ ] Loading states throughout app
- [ ] Empty states with helpful prompts

**Verification**:
- Errors don't crash app
- User understands what happened

---

## Phase 14: Mobile (Future)

### 14.1 iOS Build
**Goal**: iOS app via Tauri 2.0

**Tasks**:
- [ ] Configure iOS target in Tauri
- [ ] Mobile-optimized UI components
- [ ] Touch gestures (swipe sidebar, etc.)
- [ ] iOS-specific file access

---

### 14.2 Android Build
**Goal**: Android app via Tauri 2.0

**Tasks**:
- [ ] Configure Android target in Tauri
- [ ] Handle Android file permissions
- [ ] Material Design adaptations

---

## Phase 15: Sync (Future)

### 15.1 CRDT Integration
**Goal**: Conflict-free sync foundation

**Tasks**:
- [ ] Integrate Yjs or Loro
- [ ] Add vector clocks to note model
- [ ] Design sync protocol
- [ ] Implement device pairing

---

## Appendix: Key File Paths

```
src-tauri/
├── src/
│   ├── main.rs                 # Tauri entry point
│   ├── lib.rs                  # Library root
│   ├── error.rs                # Error types
│   ├── state.rs                # App state
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── vault.rs            # Vault operations
│   │   ├── files.rs            # File CRUD
│   │   ├── search.rs           # Search queries
│   │   ├── links.rs            # Link/backlink queries
│   │   ├── graph.rs            # Graph data
│   │   ├── tags.rs             # Tag operations
│   │   ├── daily.rs            # Daily notes
│   │   ├── templates.rs        # Templates
│   │   ├── settings.rs         # Settings
│   │   └── export.rs           # Export functions
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs       # SQLite connection
│   │   ├── schema.rs           # Table definitions
│   │   └── queries.rs          # SQL queries
│   ├── fs/
│   │   ├── mod.rs
│   │   ├── operations.rs       # File operations
│   │   └── watcher.rs          # File watcher
│   ├── indexer/
│   │   ├── mod.rs
│   │   ├── links.rs            # Link extraction
│   │   ├── tags.rs             # Tag extraction
│   │   └── content.rs          # FTS indexing
│   └── parser/
│       ├── mod.rs
│       ├── markdown.rs         # Markdown parsing
│       └── frontmatter.rs      # YAML frontmatter

src/
├── components/
│   ├── editor/
│   │   ├── Editor.tsx          # Main editor wrapper
│   │   ├── SourceEditor.tsx    # CodeMirror
│   │   ├── LivePreview.tsx     # ProseMirror
│   │   ├── ReadingView.tsx     # Rendered view
│   │   └── Toolbar.tsx         # Editor toolbar
│   ├── sidebar/
│   │   ├── Sidebar.tsx         # Sidebar container
│   │   ├── FileTree.tsx        # File browser
│   │   ├── SearchPanel.tsx     # Search
│   │   ├── BacklinksPanel.tsx  # Backlinks
│   │   └── TagsPanel.tsx       # Tags
│   ├── graph/
│   │   ├── GraphView.tsx       # Graph visualization
│   │   └── GraphControls.tsx   # Graph filters
│   ├── canvas/
│   │   ├── CanvasView.tsx      # Canvas editor
│   │   └── nodes/              # Node components
│   ├── modals/
│   │   ├── QuickSwitcher.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── Settings.tsx
│   │   └── VaultPicker.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       └── Tabs.tsx
├── hooks/
│   ├── useNote.ts              # Note operations
│   ├── useSearch.ts            # Search
│   ├── useHotkeys.ts           # Keyboard shortcuts
│   └── useTauri.ts             # Tauri IPC wrapper
├── store/
│   ├── index.ts                # Root store
│   ├── vaultStore.ts           # Vault state
│   ├── editorStore.ts          # Editor state
│   ├── tabsStore.ts            # Tab state
│   └── settingsStore.ts        # Settings
├── lib/
│   ├── tauri.ts                # Tauri command wrappers
│   ├── markdown.ts             # Markdown utilities
│   └── utils.ts                # General utilities
└── types/
    ├── note.ts                 # Note types
    ├── link.ts                 # Link types
    └── settings.ts             # Settings types
```

---

## Getting Started

```bash
# Clone and install
cd openobs_beta
npm install
cd src-tauri && cargo fetch && cd ..

# Development
npm run tauri dev

# Build
npm run tauri build
```
