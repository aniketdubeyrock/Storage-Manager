# Storage Manager Architecture

## 1. System Overview

Storage Manager is structured with a strict separation of concerns, decoupling raw filesystem I/O and handle management from application state and React presentation layers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Interface                                │
│   ┌──────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────┐   │
│   │  Dashboard   │ │ File Manager  │ │  Analytics    │ │   Trash   │   │
│   └──────────────┘ └───────────────┘ └───────────────┘ └───────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Hooks & Selectors
┌───────────────────────────────────▼────────────────────────────────────┐
│                       State Layer (Zustand)                            │
│   ┌─────────────────────┐ ┌───────────────────┐ ┌───────────────────┐  │
│   │ useFilesystemStore  │ │useFileManagerStore│ │   useTrashStore   │  │
│   └─────────────────────┘ └───────────────────┘ └───────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Service Invocations
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Core Service Layer                               │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────┐  │
│  │ Directory Scanner     │ │ File Operations       │ │Trash Provider│  │
│  │ (Recursive / Batched) │ │ (Rename, Copy, Move)  │ │(Meta & Revert│  │
│  └───────────────────────┘ └───────────────────────┘ └──────────────┘  │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────┐  │
│  │ Duplicate Analyzer    │ │ Permission Manager    │ │Export / ZIP  │  │
│  │ (Stream SHA-256)      │ │ (Query / Request)     │ │(JSZip stream)│  │
│  └───────────────────────┘ └───────────────────────┘ └──────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Web Platform APIs
┌───────────────────────────────────▼────────────────────────────────────┐
│                     Browser Sandbox Environment                        │
│   ┌───────────────────────────────┐  ┌──────────────────────────────┐  │
│   │   File System Access API      │  │        IndexedDB (idb)       │  │
│   │ (FileSystemDirectoryHandle)   │  │ (Handles, Metadata, Cache)   │  │
│   └───────────────────────────────┘  └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory and File Hierarchy

```
storage-manager/
├── src/
│   ├── app/
│   │   ├── App.tsx                     # Main layout & router outlet
│   │   ├── router.tsx                  # Client-side routing table
│   │   └── providers.tsx               # Context and Toast providers
│   │
│   ├── components/
│   │   ├── common/                     # Buttons, Modals, Badges, SearchInput
│   │   ├── layout/                     # Sidebar, Header, Breadcrumbs, ThemeToggle
│   │   ├── dashboard/                  # Metric cards, RecentScans, QuickStats
│   │   ├── filesystem/                 # FolderPicker, DirectoryTree, FilePreviewModal
│   │   ├── charts/                     # StorageTreemap, TypePieChart, FolderBarChart
│   │   ├── dialogs/                    # DeleteConfirmModal, RenameModal, MoveModal
│   │   └── tables/                     # FileTable, DuplicateTable, LargestTable
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx           # Global summary & analytics widgets
│   │   ├── FileManagerPage.tsx         # File explorer (list/grid, breadcrumbs, tree)
│   │   ├── StorageAnalysisPage.tsx     # Treemap, sizing distribution, charts
│   │   ├── LargestFilesPage.tsx        # High-capacity file filter & bulk actions
│   │   ├── LargestFoldersPage.tsx      # Deep directory sizing ranking
│   │   ├── FileTypesPage.tsx           # Type categorization & breakdown
│   │   ├── DuplicateFinderPage.tsx     # Exact byte & SHA-256 duplicate groups
│   │   ├── TrashPage.tsx               # App-managed trash view and restoration
│   │   └── SettingsPage.tsx            # Persistence options, units, safety rules
│   │
│   ├── services/
│   │   ├── filesystem/
│   │   │   ├── directoryPicker.ts      # showDirectoryPicker abstraction
│   │   │   ├── permissionManager.ts    # queryPermission / requestPermission
│   │   │   ├── directoryScanner.ts     # Recursive BFS/DFS scanner with AbortController
│   │   │   ├── directoryOperations.ts  # Folder creation, traversal, lookup
│   │   │   ├── fileReader.ts           # File preview streaming (text, blob, audio)
│   │   │   ├── fileWriter.ts           # Safe write, atomic swap where possible
│   │   │   ├── fileDeleter.ts          # Safe single and recursive deletion
│   │   │   ├── fileMover.ts            # Handle movement & ancestry validation
│   │   │   ├── fileRenamer.ts          # Safe rename & conflict detection
│   │   │   └── fileTypeDetector.ts     # Extension to Category & MIME mapping
│   │   ├── scanner/
│   │   │   └── scannerEngine.ts        # Batched traversal coordinator
│   │   ├── storage/
│   │   │   ├── storageAnalyzer.ts      # Aggregation, categorization, percentiles
│   │   │   └── treemapBuilder.ts       # Recursive treemap squarified node builder
│   │   ├── trash/
│   │   │   ├── trashProvider.ts        # Abstract trash contract
│   │   │   └── appTrashManager.ts      # Local directory & IDB trash provider
│   │   ├── duplicate/
│   │   │   └── duplicateDetector.ts    # Multi-stage sizing + streaming hash
│   │   └── persistence/
│   │       ├── idbDatabase.ts          # IndexedDB schema (v1)
│   │       └── handleStorage.ts        # Stored directory handles serializer
│   │
│   ├── stores/
│   │   ├── filesystem.store.ts         # Active directory, scan tree, progress, status
│   │   ├── fileManager.store.ts        # Current folder path, selection, view mode
│   │   ├── trash.store.ts              # Trash ledger items and recovery state
│   │   └── settings.store.ts           # Theme, confirmations, units (binary vs decimal)
│   │
│   ├── types/
│   │   ├── filesystem.types.ts         # FileNode, FolderNode, ScanProgress
│   │   ├── trash.types.ts              # TrashItem, TrashMetadata
│   │   └── analytics.types.ts          # CategoryBreakdown, DuplicateGroup
│   │
│   └── utils/
│       ├── formatters.ts               # Byte formatting (KB, MB, GB, GiB), dates
│       ├── pathUtils.ts                # Relative path splits, parent resolution
│       └── hashUtils.ts                # Streaming SHA-256 calculation
```

---

## 3. Data Flow & State Lifecycle

1. **Authorization**:
   - User triggers "Scan Folder".
   - `directoryPicker.pickDirectory()` calls `window.showDirectoryPicker({ mode: 'readwrite' })`.
   - The root `FileSystemDirectoryHandle` is received and stored in IndexedDB for session restoration.
2. **Recursive Traversal**:
   - `directoryScanner` initiates an asynchronous, batched scan.
   - For every entry:
     - `file`: queries `handle.getFile()` to obtain byte size, last modified timestamp, and type without reading whole content.
     - `directory`: queues sub-directory for recursive traversal, tracking depth and visited handles to avert circular references.
   - Updates `filesystem.store` every 200ms or 100 entries so the UI smoothly tracks file count and cumulative storage without main-thread jank.
3. **Storage Computation**:
   - Node sizes propagate upwards: folder size = sum of direct files + sum of direct subfolders.
   - Derived projections (Largest Files list, Largest Folders list, Category aggregations) are memoized for fast filtering and chart rendering.
4. **File Mutation (Rename, Move, Copy, Delete)**:
   - File actions execute through isolated service modules that perform pre-flight verification:
     - Check permissions (`permissionManager`).
     - Check name collisions.
     - Check ancestry constraints (e.g. preventing moving a folder into its own subtree).
   - Once the filesystem operation completes, the local in-memory tree is updated incrementally or refreshed, avoiding an expensive full re-scan.
5. **Trash & Restoration**:
   - Deleted files are moved into a designated hidden trash ledger.
   - Original relative paths and deletion timestamps are recorded in IndexedDB.
   - Restoring a file recreates any intermediate folders and writes the file back to its original location.

---

## 4. Security & Privacy Guarantees

- **No Remote Telemetry**: 100% of directory parsing, metadata gathering, and content previewing occurs locally inside the browser.
- **Explicit Permission Model**: Access is strictly limited to the user-selected folder handle. System directories, external drives, and parent folders remain completely inaccessible.
- **Destructive Operation Guards**: All deletions require explicit user confirmation with volume indicators (file count and total size). Root directory deletion is strictly prevented.
