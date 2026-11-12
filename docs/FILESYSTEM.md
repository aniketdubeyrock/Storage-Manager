# File System Access Engine Documentation

## 1. Instant Progressive Scanning Architecture

Storage Manager features an **Instant Progressive Scanning Engine** to completely eliminate scan loading delays on large directories (e.g. `Downloads` with 1,000+ files or deep drive hierarchies):

```
                                  ┌──────────────────────────────┐
                                  │       User Selects Folder    │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                           ┌────────────────────────────────────────────┐
                           │   Tier 1: Instant Shallow Discovery        │
                           │   (< 100ms first paint)                    │
                           └─────────────────────┬──────────────────────┘
                                                 │
                                                 ▼
                           ┌────────────────────────────────────────────┐
                           │ • Immediate UI Render of all direct files  │
                           │ • Folders marked as "Calculating..."       │
                           │ • User can browse, preview, search NOW!    │
                           └─────────────────────┬──────────────────────┘
                                                 │
                                                 ▼
                           ┌────────────────────────────────────────────┐
                           │   Tier 2: Background Folder-by-Folder      │
                           │   Calculation Queue (SSE Stream)           │
                           └─────────────────────┬──────────────────────┘
                                                 │
                                                 ▼
                           ┌────────────────────────────────────────────┐
                           │ • Dispatches "folder_resolved" per folder  │
                           │ • Sizes & file counts update dynamically   │
                           │ • Parent sums bubble up reactively         │
                           └────────────────────────────────────────────┘
```

---

## 2. Why Chrome Blocks `Downloads` and `C:\`

Chromium (Google Chrome and Microsoft Edge) implements hardcoded restricted path blocks for `window.showDirectoryPicker()`:
- `C:\Users\<user>\Downloads`
- `C:\`
- `C:\Windows`, `C:\Program Files`, etc.

When a user tries to open `Downloads` via the browser's file picker, Chromium blocks it at the OS level with:
> **"Can't open this folder: http://localhost:5173 can't open this folder because it contains system files"**

### How Storage Manager Solves This
1. **Local System Companion Engine**:
   - Integrated directly into Vite server middleware (`/api/system/quick-folders`, `/api/system/shallow-list`, and `/api/system/scan-stream`).
   - Direct access to `C:\Users\<user>\Downloads` (1,120 items).
   - Fast 1-click scanning for Downloads, Documents, Desktop, and physical drives C: and D:.
2. **Instant Surface Discovery**:
   - Returns all direct files and folders within milliseconds so you never wait on a blank loading screen.
3. **Background Sizing Queue**:
   - Computes recursive subfolder sizes in the background with non-blocking micro-yields.
