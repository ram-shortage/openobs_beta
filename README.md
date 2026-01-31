# OpenObs

A modern, open-source note-taking application inspired by Obsidian. Built with Tauri, React, and TypeScript for a fast, native desktop experience.

## Features

- **Markdown Editor** - Write in plain text with live preview, source mode, or split view
- **Wikilinks** - Link notes together with `[[wikilinks]]` - clicking a link to a non-existent note automatically creates it
- **Graph View** - Visualize connections between your notes as an interactive network
- **Canvas** - Organize ideas visually with draggable text cards, images, and note embeds
- **Backlinks & Outgoing Links** - See which notes link to and from the current note
- **Full-Text Search** - Find anything in your vault instantly
- **Daily Notes** - Create a new note for each day to capture thoughts and tasks
- **Templates** - Use templates for consistent note structures
- **Tags** - Organize notes with hashtags like `#project/work`
- **Command Palette** - Quick access to all commands with `Cmd/Ctrl + P`
- **Keyboard Shortcuts** - Efficient navigation and editing with customizable hotkeys

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Tauri (Rust)
- **Editor**: CodeMirror 6
- **Graph**: D3.js with force-directed layout
- **Canvas**: React Flow

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Installation

```bash
# Clone the repository
git clone https://github.com/ram-shortage/openobs_beta.git
cd openobs_beta

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Usage

1. **Open or Create a Vault** - Select a folder to use as your vault (where notes are stored)
2. **Create Notes** - Use `Cmd/Ctrl + N` or click the + button
3. **Link Notes** - Type `[[` to create a wikilink to another note
4. **Navigate** - Use `Cmd/Ctrl + O` for quick switcher, `Cmd/Ctrl + P` for command palette
5. **Explore** - Check the graph view to see how your notes connect

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Note | `Cmd/Ctrl + N` |
| Quick Switcher | `Cmd/Ctrl + O` |
| Command Palette | `Cmd/Ctrl + P` |
| Save | `Cmd/Ctrl + S` |
| Search | `Cmd/Ctrl + Shift + F` |
| Toggle Sidebar | `Cmd/Ctrl + \` |
| Toggle Preview | `Cmd/Ctrl + E` |
| Close File | `Cmd/Ctrl + W` |

## Project Structure

```
openobs_beta/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and Tauri bindings
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri command handlers
│       ├── db/             # SQLite database
│       ├── fs/             # File system operations
│       └── indexer/        # Note indexing
└── public/                 # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Obsidian](https://obsidian.md/)
- Built with [Tauri](https://tauri.app/)
