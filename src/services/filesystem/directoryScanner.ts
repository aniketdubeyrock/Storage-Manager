import type { FileNode, FolderNode, ScanProgress, ScanError } from '../../types/filesystem.types';
import { extractExtension, getMimeType } from './fileTypeDetector';

export interface ScanOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
  onError?: (error: ScanError) => void;
  batchYieldInterval?: number; // entries between micro-yields to keep UI fluid
  onInitialSurface?: (surfaceRoot: FolderNode) => void;
  onFolderResolved?: (event: { folderPath: string; resolvedFolder: FolderNode }) => void;
}

export class DirectoryScanner {
  private filesScanned = 0;
  private foldersScanned = 0;
  private bytesScanned = 0;
  private startTime = 0;
  private errors: ScanError[] = [];

  public async scanDirectory(
    rootHandle: FileSystemDirectoryHandle,
    options: ScanOptions = {}
  ): Promise<{ rootFolder: FolderNode; errors: ScanError[] }> {
    this.filesScanned = 0;
    this.foldersScanned = 0;
    this.bytesScanned = 0;
    this.errors = [];
    this.startTime = Date.now();

    const batchInterval = options.batchYieldInterval || 30;
    let entryCounter = 0;

    const reportProgress = (
      currentPath: string,
      isBackgroundSizing = false,
      pendingCount = 0,
      resolvedCount = 0
    ) => {
      if (options.onProgress) {
        options.onProgress({
          isScanning: true,
          isBackgroundSizing,
          pendingFoldersCount: pendingCount,
          resolvedFoldersCount: resolvedCount,
          currentPath,
          filesScanned: this.filesScanned,
          foldersScanned: this.foldersScanned,
          bytesScanned: this.bytesScanned,
          startTime: this.startTime,
          elapsedTime: Date.now() - this.startTime,
          status: 'scanning',
        });
      }
    };

    // Deep recursive helper for a specific subfolder
    const scanDeepFolder = async (
      dirHandle: FileSystemDirectoryHandle,
      currentPath: string,
      parentPath: string
    ): Promise<FolderNode> => {
      if (options.signal?.aborted) {
        throw new DOMException('Scanning was cancelled by the user.', 'AbortError');
      }

      this.foldersScanned++;
      const folderNode: FolderNode = {
        id: currentPath,
        name: dirHandle.name || 'Folder',
        path: currentPath,
        parentPath,
        totalSize: 0,
        fileCount: 0,
        folderCount: 0,
        directFileCount: 0,
        directFolderCount: 0,
        lastScanned: Date.now(),
        kind: 'directory',
        handle: dirHandle,
        calculationStatus: 'ready',
        children: [],
      };

      try {
        for await (const [name, handle] of (dirHandle as any).entries()) {
          if (options.signal?.aborted) {
            throw new DOMException('Scanning was cancelled by the user.', 'AbortError');
          }

          entryCounter++;
          if (entryCounter % batchInterval === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          const entryPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;

          if (name === '.storage_manager_trash') continue;

          if (handle.kind === 'file') {
            try {
              const fileHandle = handle as FileSystemFileHandle;
              const fileObj = await fileHandle.getFile();
              const ext = extractExtension(name);
              const mime = getMimeType(name, fileObj.type);

              const fileNode: FileNode = {
                id: entryPath,
                name,
                path: entryPath,
                parentPath: currentPath,
                extension: ext,
                mimeType: mime,
                size: fileObj.size,
                lastModified: fileObj.lastModified,
                kind: 'file',
                handle: fileHandle,
                scanStatus: 'scanned',
              };

              folderNode.children.push(fileNode);
              folderNode.directFileCount++;
              folderNode.fileCount++;
              folderNode.totalSize += fileObj.size;

              this.filesScanned++;
              this.bytesScanned += fileObj.size;
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Cannot read file';
              const errObj: ScanError = { path: entryPath, message: errMsg, timestamp: Date.now() };
              this.errors.push(errObj);
              options.onError?.(errObj);
            }
          } else if (handle.kind === 'directory') {
            try {
              const subDirHandle = handle as FileSystemDirectoryHandle;
              const subFolder = await scanDeepFolder(subDirHandle, entryPath, currentPath);

              folderNode.children.push(subFolder);
              folderNode.directFolderCount++;
              folderNode.folderCount += 1 + subFolder.folderCount;
              folderNode.fileCount += subFolder.fileCount;
              folderNode.totalSize += subFolder.totalSize;
            } catch (err: unknown) {
              if (err instanceof DOMException && err.name === 'AbortError') throw err;
              const errMsg = err instanceof Error ? err.message : 'Inaccessible directory';
              const errObj: ScanError = { path: entryPath, message: errMsg, timestamp: Date.now() };
              this.errors.push(errObj);
              options.onError?.(errObj);
            }
          }
        }
      } catch (iterErr: unknown) {
        if (iterErr instanceof DOMException && iterErr.name === 'AbortError') throw iterErr;
      }

      folderNode.children.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return a.kind === 'directory' ? -1 : 1;
      });

      return folderNode;
    };

    // ==========================================
    // TIER 1: INSTANT SURFACE SCAN (< 100ms)
    // Read only the direct files and folders of root
    // ==========================================
    this.foldersScanned = 1;
    reportProgress(rootHandle.name || 'Root');

    const rootFolder: FolderNode = {
      id: '/',
      name: rootHandle.name || 'Root',
      path: '/',
      parentPath: '',
      totalSize: 0,
      fileCount: 0,
      folderCount: 0,
      directFileCount: 0,
      directFolderCount: 0,
      lastScanned: Date.now(),
      kind: 'directory',
      handle: rootHandle,
      calculationStatus: 'calculating',
      children: [],
    };

    const directSubfolders: Array<{
      name: string;
      handle: FileSystemDirectoryHandle;
      path: string;
    }> = [];

    try {
      for await (const [name, handle] of (rootHandle as any).entries()) {
        if (options.signal?.aborted) {
          throw new DOMException('Scanning was cancelled by the user.', 'AbortError');
        }

        if (name === '.storage_manager_trash') continue;

        const entryPath = `/${name}`;

        if (handle.kind === 'file') {
          try {
            const fileHandle = handle as FileSystemFileHandle;
            const fileObj = await fileHandle.getFile();
            const ext = extractExtension(name);
            const mime = getMimeType(name, fileObj.type);

            const fileNode: FileNode = {
              id: entryPath,
              name,
              path: entryPath,
              parentPath: '/',
              extension: ext,
              mimeType: mime,
              size: fileObj.size,
              lastModified: fileObj.lastModified,
              kind: 'file',
              handle: fileHandle,
              scanStatus: 'scanned',
            };

            rootFolder.children.push(fileNode);
            rootFolder.directFileCount++;
            rootFolder.fileCount++;
            rootFolder.totalSize += fileObj.size;

            this.filesScanned++;
            this.bytesScanned += fileObj.size;
          } catch (fileErr: unknown) {
            const errMsg = fileErr instanceof Error ? fileErr.message : 'Cannot read file';
            this.errors.push({ path: entryPath, message: errMsg, timestamp: Date.now() });
          }
        } else if (handle.kind === 'directory') {
          const subDirHandle = handle as FileSystemDirectoryHandle;
          rootFolder.directFolderCount++;
          rootFolder.folderCount++;

          // Create calculation pending stub
          const stubFolder: FolderNode = {
            id: entryPath,
            name,
            path: entryPath,
            parentPath: '/',
            totalSize: 0,
            fileCount: 0,
            folderCount: 0,
            directFileCount: 0,
            directFolderCount: 0,
            lastScanned: Date.now(),
            kind: 'directory',
            handle: subDirHandle,
            calculationStatus: 'calculating',
            children: [],
          };

          rootFolder.children.push(stubFolder);
          directSubfolders.push({ name, handle: subDirHandle, path: entryPath });
        }
      }
    } catch (iterErr) {
      if (iterErr instanceof DOMException && iterErr.name === 'AbortError') throw iterErr;
    }

    // Sort initial surface children
    rootFolder.children.sort((a, b) => {
      if (a.kind === b.kind) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return a.kind === 'directory' ? -1 : 1;
    });

    // Notify caller that surface is ready IMMEDIATELY
    if (options.onInitialSurface) {
      options.onInitialSurface({ ...rootFolder, children: [...rootFolder.children] });
    }

    // If there are no subdirectories, we are done immediately!
    if (directSubfolders.length === 0) {
      rootFolder.calculationStatus = 'ready';
      return { rootFolder, errors: this.errors };
    }

    // ==========================================
    // TIER 2: PROGRESSIVE BACKGROUND SIZING
    // Calculate each subfolder one-by-one
    // ==========================================
    const totalSubfolders = directSubfolders.length;

    for (let i = 0; i < directSubfolders.length; i++) {
      if (options.signal?.aborted) {
        throw new DOMException('Scanning was cancelled by the user.', 'AbortError');
      }

      const sub = directSubfolders[i];
      reportProgress(
        `Calculating ${sub.name}...`,
        true,
        totalSubfolders - i,
        i
      );

      // Micro-yield to maintain buttery smooth UI responsiveness
      await new Promise((resolve) => setTimeout(resolve, 10));

      const resolvedSubNode = await scanDeepFolder(sub.handle, sub.path, '/');
      resolvedSubNode.calculationStatus = 'ready';

      // Update root children
      const childIdx = rootFolder.children.findIndex((c) => c.path === sub.path);
      if (childIdx !== -1) {
        rootFolder.children[childIdx] = resolvedSubNode;
      }

      rootFolder.fileCount += resolvedSubNode.fileCount;
      rootFolder.folderCount += resolvedSubNode.folderCount;
      rootFolder.totalSize += resolvedSubNode.totalSize;

      // Dispatch folder resolved event to frontend
      if (options.onFolderResolved) {
        options.onFolderResolved({
          folderPath: sub.path,
          resolvedFolder: resolvedSubNode,
        });
      }
    }

    rootFolder.calculationStatus = 'ready';

    if (options.onProgress) {
      options.onProgress({
        isScanning: false,
        isBackgroundSizing: false,
        currentPath: 'Completed',
        filesScanned: rootFolder.fileCount,
        foldersScanned: rootFolder.folderCount,
        bytesScanned: rootFolder.totalSize,
        startTime: this.startTime,
        elapsedTime: Date.now() - this.startTime,
        status: 'completed',
      });
    }

    return { rootFolder, errors: this.errors };
  }
}
