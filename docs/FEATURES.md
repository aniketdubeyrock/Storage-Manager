# Storage Manager Features Specification

## 1. Core Feature Matrix

| Feature | Description | Support & Technical Details |
|---|---|---|
| **Folder-Wise Storage Analysis** | Real recursive calculation of folder sizes, direct file counts, and nested directory totals. | File System Access API (`FileSystemDirectoryHandle`) |
| **Recursive Directory Traversal** | Deep BFS traversal with batching, cancellation, and progress telemetry. | Non-blocking chunked traversal |
| **Interactive File Explorer** | Windows 11 / macOS Finder-style list view and grid view with breadcrumbs and tree navigation. | TanStack Table, custom breadcrumbs |
| **File & Folder Search** | Instant debounced multi-criteria search by name, extension, relative path, and size thresholds. | In-memory indexed search |
| **Largest Files Finder** | Quick detection of large disk-space consumers with size tier filters (>100MB, >500MB, >1GB, >5GB). | Linear sorting & filtering |
| **Largest Folders Finder** | Deep folder sizing hierarchy highlighting heavy nested directories with progress bars. | Hierarchical aggregation |
| **File Type Categorization** | Breakdown across 8 primary categories: Images, Videos, Audio, Documents, Archives, Code, Apps, Other. | Extension & MIME mapping |
| **Duplicate File Finder** | Multi-stage detection: exact size clustering followed by streaming SHA-256 hash comparison. | Web Crypto API (`crypto.subtle`) |
| **File & Folder Operations** | In-place Rename, Copy, Move, and Download (individual or multi-file ZIP archive). | Streaming file handles & JSZip |
| **Safe Deletion & App Trash** | Deletion moves files to recoverable application-managed trash ledger with original path tracking. | App-managed trash + IndexedDB |
| **Storage Visualizations** | Donut charts, bar charts, size distribution histograms, and an interactive drill-down Treemap. | Recharts + custom SVG Treemap |
| **Light & Dark Mode** | Premium desktop-first theme with high-contrast text and smooth transitions. | Tailwind CSS with CSS variables |
| **Handle Restoration** | Restores previously authorized directories across browser reloads when permission is granted. | IndexedDB handle persistence |
| **Browser Compatibility Detection** | Feature detection with clear diagnostic messaging and demo sandbox generator for unsupported engines. | Native API detection |

---

## 2. Safety & Operational Rules

1. **Confirmation Dialogs**: All destructive actions (Delete, Permanent Delete, Empty Trash, Move) require user confirmation showing exact item count and cumulative byte size.
2. **Root Directory Protection**: The root directory handle cannot be deleted, renamed, or moved into itself.
3. **Loop Prevention**: Folders cannot be moved into their own descendants.
4. **Name Collision Safeguards**: Renaming or moving checks if a target filename already exists in the destination folder, prompting for overwrite confirmation or auto-incrementing.
5. **No External Network Requests**: All scans and operations run entirely in the browser context. No file data is sent to external cloud servers.
