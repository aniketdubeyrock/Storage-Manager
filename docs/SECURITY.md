# Storage Manager Security Model

## 1. Zero-Knowledge Local Architecture

Storage Manager operates under a strict client-side sandbox model:

1. **Zero Remote Telemetry**: The application makes 0 external network requests for user files, folder names, directory structures, or metadata. All analytics, hashing, and rendering occur inside the local browser JavaScript runtime.
2. **Explicit User Authorization**: No local files or directories can be read, listed, or mutated without the user explicitly choosing a folder via the operating system's native directory picker prompt.
3. **No Arbitrary Path Traversal**: Web browsers prohibit accessing arbitrary filesystem paths (such as `C:\Windows` or `/etc/shadow`) via string paths. All access is anchored to the explicit `FileSystemDirectoryHandle` granted by the user.

---

## 2. Destructive Action Safety Controls

Storage Manager implements defense-in-depth against accidental data loss:

- **Root Directory Protection**: The root folder handle cannot be deleted, renamed, or moved into itself.
- **Cycle Prevention**: Folders cannot be moved into their own descendant subfolders.
- **Volume Indicators on Confirmation**: Confirmation modals clearly specify the number of files and total byte volume affected.
- **Application Trash Default**: Deletions default to the recoverable Application Trash ledger rather than permanent unrecoverable deletion.
- **Native OS Recycle Bin Boundary**: The application explicitly informs the user that browser security boundaries prevent direct manipulation of the Windows Recycle Bin without an optional desktop companion.

