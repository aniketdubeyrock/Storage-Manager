# Development Plan: Storage Manager

## 1. Project Overview & Objectives
**Storage Manager** is a high-performance, modern, desktop-first web application designed for recursive filesystem analysis, storage telemetry, directory browsing, file manipulation (rename, copy, move, download, delete), duplicate file detection, largest file/folder discovery, and application-managed trash recovery.

Built strictly around the web platform's **File System Access API**, it provides deep insights into local directories authorized by the user without transmitting any file data or telemetry to external servers.

---

## 2. Phase-by-Phase Implementation Roadmap

### Phase 1: Foundation & Application Shell
- **Tasks**:
  - Configure Vite, React 19 / TypeScript strict mode, Tailwind CSS v4 with custom design tokens.
  - Setup React Router with nested layout, active navigation, mobile responsiveness, and breadcrumb system.
  - Build persistent theme management (Dark / Light mode) with localStorage/IndexedDB backing.
  - Implement Lucide icon consistency, toast notification provider (`react-hot-toast`), and responsive sidebar with compact collapse mode.
  - Build universal Layout with Header (search, scan launcher, theme toggle, refresh, breadcrumbs, status pill).
- **Deliverables**: Complete responsive application shell and navigation framework.

### Phase 2: File System Access Engine & Recursive Scanner
- **Tasks**:
  - Implement `directoryPicker.ts` for directory authorization and handle retrieval.
  - Implement `permissionManager.ts` to request and verify `read` and `readwrite` permissions.
  - Build `directoryScanner.ts` supporting recursive traversal, file metadata extraction (name, path, extension, size, lastModified, mimeType), and folder aggregation (totalSize, fileCount, folderCount).
  - Implement batched traversal, cancellation tokens (`AbortController`), and incremental progress callbacks to keep the main thread responsive.
  - Build Web Worker scanner support (`scanner.worker.ts`) with graceful main-thread fallback for browsers or contexts where handles cannot be cloned to workers.
  - Integrate IndexedDB persistence via `idb` for storing recently scanned directory handles, scan metadata, and last scan timestamps.
- **Deliverables**: Robust, non-blocking recursive scanner engine with progress tracking and handle restoration.

### Phase 3: Storage Analytics Dashboard & Visualizations
- **Tasks**:
  - Build summary telemetry cards: Scanned Size, File Count, Folder Count, Largest Folder, Largest File, File Category count, and Duplicate Candidates.
  - Distinguish explicitly between user-scanned directory usage and physical drive capacity (avoiding fabricated hardware stats).
  - Implement interactive Recharts components:
    - Donut chart: Storage distribution across file categories (Images, Videos, Audio, Documents, Archives, Code, etc.).
    - Bar chart: Top 10 largest folders and comparative sizing.
    - Area/distribution visualization: File size ranges (<1MB, 1-10MB, 10-100MB, 100MB-1GB, >1GB).
  - Implement an interactive **Treemap visualizer**:
    - Hierarchical rectangle sizing representing proportional storage consumption.
    - Drill-down navigation, hover inspection tooltips, and file highlighting.
- **Deliverables**: Comprehensive, real-data-driven storage dashboard with drill-down treemap and analytical charts.

### Phase 4: Full File Manager & Directory Explorer
- **Tasks**:
  - Build nested Directory Tree component with expandable/collapsible nodes.
  - Implement Breadcrumb navigation supporting arbitrary depth jumping.
  - Create Dual View Modes:
    - TanStack Table List View with multi-column sorting (Name, Type, Size, Last Modified), pagination, and inline action menus.
    - Grid / Card View with file thumbnail previews, icon mapping, and quick badges.
  - Multi-file selection with shift/ctrl click, selection counters, and bulk action toolbar.
  - Quick Search and Filter bar (extension, category, size thresholds).
  - File Details Panel with rich metadata, permission status, and preview (text, markdown, code, image, audio, video).
- **Deliverables**: Professional, Explorer-grade file manager with list/grid views, multi-selection, and deep previews.

### Phase 5: File Operations & Safety Guarantees
- **Tasks**:
  - File and folder **Rename** with validation (forbidden characters, name conflicts, empty names).
  - File and folder **Copy** (deep recursive copying for folders via handle traversal and streams).
  - File and folder **Move** with ancestry loop prevention (cannot move a directory inside itself or its children).
  - Single and bulk **Download** (individual file streaming or multi-file/directory ZIP bundling via `JSZip`).
  - Single and multi-file **Deletion** with confirmation modal showing item count and total bytes.
  - Safety rules: Block deletion of the root directory handle, prevent silent deletion, and validate handle permissions prior to mutation.
- **Deliverables**: Complete browser-authorized file management with safety validations and confirmation modals.

### Phase 6: Application-Managed Trash & Recovery System
- **Tasks**:
  - Design `TrashProvider` abstraction with support for `add`, `restore`, `removePermanently`, `list`, and `empty`.
  - App-managed trash architecture: Files moved to trash are transferred into an internal `.storage_manager_trash` directory within the authorized directory or cached in IndexedDB blob stores if small, alongside full metadata records (original relative path, deleted timestamp, original size).
  - Restore functionality: Reconstructs original folder hierarchy and restores files with collision detection.
  - Permanent delete workflow with multi-step confirmation.
  - Transparent messaging: Explicitly clarify that browser sandboxing cannot access the native Windows Recycle Bin without a native companion application.
- **Deliverables**: Robust, recoverable trash system with detailed audit metadata and safety checks.

### Phase 7: Advanced Storage Intelligence
- **Tasks**:
  - **Largest Files Page**: Dynamic filtering (>100MB, >500MB, >1GB, >5GB, custom ranges), bulk operations, sorting.
  - **Largest Folders Page**: Deep folder sizing hierarchy, relative percentage bars, one-click jump to File Manager.
  - **File Types Page**: 8 distinct categories (Images, Videos, Audio, Documents, Code, Archives, Executables, Other) with aggregate volume, file counts, and extension breakdown tables.
  - **Duplicate File Finder**:
    - Multi-stage pipeline: Group by exact byte size -> eliminate unique sizes -> compute streaming SHA-256 hashes on candidates.
    - Chunked stream hashing to prevent high RAM consumption on gigabyte files.
    - Group view displaying original candidate and duplicate paths with side-by-side selection and bulk cleanup recommendation.
- **Deliverables**: High-utility diagnostic tools for reclaimed storage discovery.

### Phase 8: Performance Optimization & Edge-Case Handling
- **Tasks**:
  - Virtualization for tables and long file lists.
  - Memory-efficient tree nodes (clean handle maps, no content buffering).
  - Comprehensive error boundaries and permission change listeners.
  - Browser compatibility detection with clear messaging for unsupported browsers and an interactive demo/sandbox generator.
- **Deliverables**: Silky 60fps UI performance with graceful error resilience.

### Phase 9: Testing, Verification & Production Build
- **Tasks**:
  - Unit tests with Vitest for core filesystem utilities, size formatters, path calculations, and trash operations.
  - Integration tests for Zustand stores and state synchronization.
  - End-to-end user journey validation with sample directory structure.
  - Production build verification (`npm run build`) ensuring zero TypeScript and lint warnings.
- **Deliverables**: Production-ready, fully tested web application.

