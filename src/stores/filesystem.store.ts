import { create } from 'zustand';
import type {
  FolderNode,
  FileNode,
  ScanProgress,
  ScanError,
} from '../types/filesystem.types';
import type { DriveInfo, QuickFolder } from '../types/companion.types';
import { DirectoryScanner } from '../services/filesystem/directoryScanner';
import { pickDirectory } from '../services/filesystem/directoryPicker';
import { verifyPermission } from '../services/filesystem/permissionManager';
import {
  saveDirectoryHandle,
  listStoredDirectoryHandles,
  removeStoredDirectoryHandle,
  type StoredDirectoryRecord,
} from '../services/persistence/handleStorage';
import { analyzeStorage, type StorageAnalysisReport } from '../services/storage/storageAnalyzer';
import { appTrashManager } from '../services/trash/appTrashManager';
import {
  fetchAvailableDrives,
  fetchQuickFolders,
  scanSystemPath,
  deleteSystemPath,
  renameSystemPath,
  moveSystemPath,
} from '../services/companion/companionService';
import { normalizePath } from '../utils/pathUtils';
import toast from 'react-hot-toast';

interface FilesystemState {
  rootHandle: FileSystemDirectoryHandle | null;
  rootFolder: FolderNode | null;
  scanProgress: ScanProgress;
  scanErrors: ScanError[];
  analysisReport: StorageAnalysisReport | null;
  storedDirectories: StoredDirectoryRecord[];
  isPermissionGranted: boolean;
  abortController: AbortController | null;

  // Companion & Drive state
  scanType: 'browser' | 'companion';
  availableDrives: DriveInfo[];
  selectedDrive: DriveInfo | null;
  quickFolders: QuickFolder[];
  isPickerModalOpen: boolean;

  // Actions
  openPickerModal: () => void;
  closePickerModal: () => void;
  loadAvailableDrives: () => Promise<void>;
  loadQuickFolders: () => Promise<void>;
  scanDrive: (drive: DriveInfo) => Promise<void>;
  scanPath: (targetPath: string, displayName?: string) => Promise<void>;
  selectAndScanDirectory: () => Promise<void>;
  restoreStoredDirectory: (record: StoredDirectoryRecord) => Promise<void>;
  rescan: () => Promise<void>;
  cancelScan: () => void;
  loadStoredDirectories: () => Promise<void>;
  removeStoredDirectory: (id: string) => Promise<void>;
  clearActiveScan: () => void;

  // Tree mutations
  removeNodeFromTree: (path: string) => void;
  renameNodeInTree: (oldPath: string, newPath: string, newName: string) => void;
}

const initialProgress: ScanProgress = {
  isScanning: false,
  currentPath: '',
  filesScanned: 0,
  foldersScanned: 0,
  bytesScanned: 0,
  startTime: null,
  elapsedTime: 0,
  status: 'idle',
};

export const useFilesystemStore = create<FilesystemState>((set, get) => ({
  rootHandle: null,
  rootFolder: null,
  scanProgress: initialProgress,
  scanErrors: [],
  analysisReport: null,
  storedDirectories: [],
  isPermissionGranted: false,
  abortController: null,

  scanType: 'browser',
  availableDrives: [],
  selectedDrive: null,
  quickFolders: [],
  isPickerModalOpen: false,

  openPickerModal: () => {
    set({ isPickerModalOpen: true });
    get().loadAvailableDrives();
    get().loadQuickFolders();
  },

  closePickerModal: () => {
    set({ isPickerModalOpen: false });
  },

  loadAvailableDrives: async () => {
    const drives = await fetchAvailableDrives();
    set({ availableDrives: drives });
  },

  loadQuickFolders: async () => {
    const folders = await fetchQuickFolders();
    set({ quickFolders: folders });
  },

  scanPath: async (targetPath: string, displayName?: string) => {
    set({ isPickerModalOpen: false });
    const abortCtrl = new AbortController();
    const folderName = displayName || targetPath;

    set({
      scanType: 'companion',
      selectedDrive: null,
      rootHandle: null,
      abortController: abortCtrl,
      isPermissionGranted: true,
      scanErrors: [],
      scanProgress: {
        ...initialProgress,
        isScanning: true,
        status: 'scanning',
        startTime: Date.now(),
        currentPath: `Loading ${folderName}...`,
      },
    });

    try {
      const startTime = Date.now();
      const { rootFolder, errors } = await scanSystemPath(targetPath, {
        signal: abortCtrl.signal,
        onInitialSurface: (surfaceRoot) => {
          if (displayName) {
            surfaceRoot.name = displayName;
          }
          const preliminaryReport = analyzeStorage(surfaceRoot, Date.now() - startTime);
          set({
            rootFolder: surfaceRoot,
            analysisReport: preliminaryReport,
            scanProgress: {
              ...get().scanProgress,
              isBackgroundSizing: true,
              currentPath: `Direct items loaded (${surfaceRoot.directFileCount} files, ${surfaceRoot.directFolderCount} folders). Background sizing running...`,
            },
          });
          toast('Ready to browse! Calculating nested folders in background...', { icon: '⚡' });
        },
        onFolderResolved: (event) => {
          const currentTree = get().rootFolder;
          if (!currentTree || !event.resolvedFolder) return;

          const newRoot = { ...currentTree };
          const idx = newRoot.children.findIndex((c) => c.path === event.folderPath);
          if (idx !== -1) {
            newRoot.children = [...newRoot.children];
            newRoot.children[idx] = event.resolvedFolder;
            recalculateFolderSizes(newRoot);
            const updatedReport = analyzeStorage(newRoot);
            set({
              rootFolder: newRoot,
              analysisReport: updatedReport,
            });
          }
        },
        onProgress: (prog) => {
          set({ scanProgress: prog });
        },
      });

      if (displayName) {
        rootFolder.name = displayName;
      }

      const durationMs = Date.now() - startTime;
      const report = analyzeStorage(rootFolder, durationMs);

      set({
        rootFolder,
        analysisReport: report,
        scanErrors: errors,
        scanProgress: {
          isScanning: false,
          isBackgroundSizing: false,
          currentPath: 'Scan completed',
          filesScanned: rootFolder.fileCount,
          foldersScanned: rootFolder.folderCount,
          bytesScanned: rootFolder.totalSize,
          startTime,
          elapsedTime: durationMs,
          status: 'completed',
        },
        abortController: null,
      });

      toast.success(`Completed scanning "${folderName}" (${rootFolder.fileCount} files)`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Scan cancelled', { icon: '⏹️' });
        set({
          scanProgress: {
            ...get().scanProgress,
            isScanning: false,
            isBackgroundSizing: false,
            status: 'cancelled',
          },
          abortController: null,
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Folder scan failed';
      toast.error(msg);
      set({
        scanProgress: {
          ...get().scanProgress,
          isScanning: false,
          isBackgroundSizing: false,
          status: 'error',
          errorMessage: msg,
        },
        abortController: null,
      });
    }
  },

  scanDrive: async (drive: DriveInfo) => {
    set({ isPickerModalOpen: false });
    const abortCtrl = new AbortController();

    set({
      scanType: 'companion',
      selectedDrive: drive,
      rootHandle: null,
      abortController: abortCtrl,
      isPermissionGranted: true,
      scanErrors: [],
      scanProgress: {
        ...initialProgress,
        isScanning: true,
        status: 'scanning',
        startTime: Date.now(),
        currentPath: `Loading ${drive.path}...`,
      },
    });

    try {
      const startTime = Date.now();
      const { rootFolder, errors } = await scanSystemPath(drive.path, {
        signal: abortCtrl.signal,
        onInitialSurface: (surfaceRoot) => {
          surfaceRoot.name = drive.name;
          const preliminaryReport = analyzeStorage(surfaceRoot, Date.now() - startTime);
          set({
            rootFolder: surfaceRoot,
            analysisReport: preliminaryReport,
            scanProgress: {
              ...get().scanProgress,
              isBackgroundSizing: true,
              currentPath: `Direct items loaded (${surfaceRoot.directFileCount} files, ${surfaceRoot.directFolderCount} folders). Background sizing running...`,
            },
          });
          toast('Ready to browse! Calculating nested folders in background...', { icon: '⚡' });
        },
        onFolderResolved: (event) => {
          const currentTree = get().rootFolder;
          if (!currentTree || !event.resolvedFolder) return;

          const newRoot = { ...currentTree };
          const idx = newRoot.children.findIndex((c) => c.path === event.folderPath);
          if (idx !== -1) {
            newRoot.children = [...newRoot.children];
            newRoot.children[idx] = event.resolvedFolder;
            recalculateFolderSizes(newRoot);
            const updatedReport = analyzeStorage(newRoot);
            set({
              rootFolder: newRoot,
              analysisReport: updatedReport,
            });
          }
        },
        onProgress: (prog) => {
          set({ scanProgress: prog });
        },
      });

      const durationMs = Date.now() - startTime;
      const report = analyzeStorage(rootFolder, durationMs);

      set({
        rootFolder,
        analysisReport: report,
        scanErrors: errors,
        scanProgress: {
          isScanning: false,
          isBackgroundSizing: false,
          currentPath: 'Scan completed',
          filesScanned: rootFolder.fileCount,
          foldersScanned: rootFolder.folderCount,
          bytesScanned: rootFolder.totalSize,
          startTime,
          elapsedTime: durationMs,
          status: 'completed',
        },
        abortController: null,
      });

      toast.success(`Completed scanning ${drive.name} (${rootFolder.fileCount} files)`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Scan cancelled', { icon: '⏹️' });
        set({
          scanProgress: {
            ...get().scanProgress,
            isScanning: false,
            isBackgroundSizing: false,
            status: 'cancelled',
          },
          abortController: null,
        });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Drive scan failed';
      toast.error(msg);
      set({
        scanProgress: {
          ...get().scanProgress,
          isScanning: false,
          isBackgroundSizing: false,
          status: 'error',
          errorMessage: msg,
        },
        abortController: null,
      });
    }
  },

  selectAndScanDirectory: async () => {
    set({ isPickerModalOpen: false });
    try {
      const handle = await pickDirectory('read');
      if (!handle) {
        return; // user cancelled dialog
      }

      const abortCtrl = new AbortController();
      set({
        scanType: 'browser',
        selectedDrive: null,
        rootHandle: handle,
        abortController: abortCtrl,
        isPermissionGranted: true,
        scanErrors: [],
        scanProgress: {
          ...initialProgress,
          isScanning: true,
          status: 'scanning',
          startTime: Date.now(),
        },
      });

      appTrashManager.setRootHandle(handle);

      const scanner = new DirectoryScanner();
      const startTime = Date.now();

      const { rootFolder, errors } = await scanner.scanDirectory(handle, {
        signal: abortCtrl.signal,
        onInitialSurface: (surfaceRoot) => {
          const preliminaryReport = analyzeStorage(surfaceRoot, Date.now() - startTime);
          set({
            rootFolder: surfaceRoot,
            analysisReport: preliminaryReport,
            scanProgress: {
              ...get().scanProgress,
              isBackgroundSizing: true,
              currentPath: `Direct items loaded (${surfaceRoot.directFileCount} files, ${surfaceRoot.directFolderCount} folders). Background sizing running...`,
            },
          });
          toast('Folder opened! Sizing nested folders in background...', { icon: '⚡' });
        },
        onFolderResolved: (event) => {
          const currentTree = get().rootFolder;
          if (!currentTree || !event.resolvedFolder) return;

          const newRoot = { ...currentTree };
          const idx = newRoot.children.findIndex((c) => c.path === event.folderPath);
          if (idx !== -1) {
            newRoot.children = [...newRoot.children];
            newRoot.children[idx] = event.resolvedFolder;
            recalculateFolderSizes(newRoot);
            const updatedReport = analyzeStorage(newRoot);
            set({
              rootFolder: newRoot,
              analysisReport: updatedReport,
            });
          }
        },
        onProgress: (prog) => {
          set({ scanProgress: prog });
        },
        onError: (err) => {
          set((state) => ({ scanErrors: [...state.scanErrors, err] }));
        },
      });

      const durationMs = Date.now() - startTime;
      const report = analyzeStorage(rootFolder, durationMs);

      // Persist handle in IndexedDB
      await saveDirectoryHandle(handle.name, handle, {
        totalSize: rootFolder.totalSize,
        fileCount: rootFolder.fileCount,
      });

      set({
        rootFolder,
        analysisReport: report,
        scanErrors: errors,
        scanProgress: {
          isScanning: false,
          currentPath: 'Scan completed',
          filesScanned: rootFolder.fileCount,
          foldersScanned: rootFolder.folderCount,
          bytesScanned: rootFolder.totalSize,
          startTime,
          elapsedTime: durationMs,
          status: 'completed',
        },
        abortController: null,
      });

      await get().loadStoredDirectories();
      toast.success(`Successfully scanned "${handle.name}" (${rootFolder.fileCount} files)`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Scanning cancelled', { icon: '⏹️' });
        set({
          scanProgress: {
            ...get().scanProgress,
            isScanning: false,
            status: 'cancelled',
          },
          abortController: null,
        });
        return;
      }

      const errMsg = err instanceof Error ? err.message : 'Directory scanning failed';
      toast.error(errMsg);
      set({
        scanProgress: {
          ...get().scanProgress,
          isScanning: false,
          status: 'error',
          errorMessage: errMsg,
        },
        abortController: null,
      });

      // If user faced Chromium system folder block, re-open picker modal with drive recommendations!
      get().openPickerModal();
    }
  },

  restoreStoredDirectory: async (record: StoredDirectoryRecord) => {
    try {
      const hasPerm = await verifyPermission(record.handle, false);
      if (!hasPerm) {
        toast.error('Permission to access stored folder was not granted.');
        return;
      }

      set({ rootHandle: record.handle, isPermissionGranted: true, scanType: 'browser' });
      appTrashManager.setRootHandle(record.handle);
      await get().rescan();
    } catch {
      toast.error('Failed to reconnect to folder. Please select it again.');
    }
  },

  rescan: async () => {
    const { scanType, selectedDrive, rootHandle } = get();

    if (scanType === 'companion' && selectedDrive) {
      await get().scanDrive(selectedDrive);
      return;
    }

    if (!rootHandle) {
      toast.error('No directory selected to scan.');
      return;
    }

    try {
      const hasPerm = await verifyPermission(rootHandle, false);
      if (!hasPerm) {
        toast.error('Filesystem permission required.');
        return;
      }

      const abortCtrl = new AbortController();
      set({
        abortController: abortCtrl,
        scanErrors: [],
        scanProgress: {
          ...initialProgress,
          isScanning: true,
          status: 'scanning',
          startTime: Date.now(),
        },
      });

      const scanner = new DirectoryScanner();
      const startTime = Date.now();

      const { rootFolder, errors } = await scanner.scanDirectory(rootHandle, {
        signal: abortCtrl.signal,
        onInitialSurface: (surfaceRoot) => {
          const preliminaryReport = analyzeStorage(surfaceRoot, Date.now() - startTime);
          set({
            rootFolder: surfaceRoot,
            analysisReport: preliminaryReport,
            scanProgress: {
              ...get().scanProgress,
              isBackgroundSizing: true,
              currentPath: `Direct items loaded (${surfaceRoot.directFileCount} files, ${surfaceRoot.directFolderCount} folders). Background sizing running...`,
            },
          });
        },
        onFolderResolved: (event) => {
          const currentTree = get().rootFolder;
          if (!currentTree || !event.resolvedFolder) return;

          const newRoot = { ...currentTree };
          const idx = newRoot.children.findIndex((c) => c.path === event.folderPath);
          if (idx !== -1) {
            newRoot.children = [...newRoot.children];
            newRoot.children[idx] = event.resolvedFolder;
            recalculateFolderSizes(newRoot);
            set({
              rootFolder: newRoot,
              analysisReport: analyzeStorage(newRoot),
            });
          }
        },
        onProgress: (prog) => {
          set({ scanProgress: prog });
        },
        onError: (err) => {
          set((state) => ({ scanErrors: [...state.scanErrors, err] }));
        },
      });

      const durationMs = Date.now() - startTime;
      const report = analyzeStorage(rootFolder, durationMs);

      await saveDirectoryHandle(rootHandle.name, rootHandle, {
        totalSize: rootFolder.totalSize,
        fileCount: rootFolder.fileCount,
      });

      set({
        rootFolder,
        analysisReport: report,
        scanErrors: errors,
        scanProgress: {
          isScanning: false,
          currentPath: 'Scan completed',
          filesScanned: rootFolder.fileCount,
          foldersScanned: rootFolder.folderCount,
          bytesScanned: rootFolder.totalSize,
          startTime,
          elapsedTime: durationMs,
          status: 'completed',
        },
        abortController: null,
      });

      await get().loadStoredDirectories();
      toast.success(`Rescan completed for "${rootHandle.name}"`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Rescan cancelled', { icon: '⏹️' });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Rescan failed';
      toast.error(msg);
    }
  },

  cancelScan: () => {
    const ctrl = get().abortController;
    if (ctrl) {
      ctrl.abort();
    }
  },

  loadStoredDirectories: async () => {
    const stored = await listStoredDirectoryHandles();
    set({ storedDirectories: stored });
  },

  removeStoredDirectory: async (id: string) => {
    await removeStoredDirectoryHandle(id);
    await get().loadStoredDirectories();
    toast.success('Removed folder from recent history');
  },

  clearActiveScan: () => {
    set({
      rootHandle: null,
      rootFolder: null,
      analysisReport: null,
      scanProgress: initialProgress,
      scanErrors: [],
      isPermissionGranted: false,
      selectedDrive: null,
    });
    appTrashManager.setRootHandle(null);
  },

  removeNodeFromTree: (targetPath: string) => {
    const root = get().rootFolder;
    if (!root) return;

    const normTarget = normalizePath(targetPath);
    if (normTarget === '/') return;

    const pruneNode = (folder: FolderNode): boolean => {
      const idx = folder.children.findIndex((c) => normalizePath(c.path) === normTarget);
      if (idx !== -1) {
        folder.children.splice(idx, 1);
        return true;
      }
      for (const child of folder.children) {
        if (child.kind === 'directory') {
          if (pruneNode(child as FolderNode)) return true;
        }
      }
      return false;
    };

    const newRoot = JSON.parse(JSON.stringify(root)) as FolderNode;
    newRoot.handle = root.handle;

    pruneNode(newRoot);
    recalculateFolderSizes(newRoot);
    const updatedReport = analyzeStorage(newRoot);
    set({ rootFolder: newRoot, analysisReport: updatedReport });
  },

  renameNodeInTree: (oldPath: string, newPath: string, newName: string) => {
    const root = get().rootFolder;
    if (!root) return;

    const normOld = normalizePath(oldPath);
    const normNew = normalizePath(newPath);

    const updateName = (folder: FolderNode): boolean => {
      for (const child of folder.children) {
        if (normalizePath(child.path) === normOld) {
          child.name = newName;
          child.path = normNew;
          child.id = normNew;
          return true;
        }
        if (child.kind === 'directory') {
          if (updateName(child as FolderNode)) return true;
        }
      }
      return false;
    };

    const newRoot = JSON.parse(JSON.stringify(root)) as FolderNode;
    newRoot.handle = root.handle;

    updateName(newRoot);
    const updatedReport = analyzeStorage(newRoot);
    set({ rootFolder: newRoot, analysisReport: updatedReport });
  },
}));

function recalculateFolderSizes(folder: FolderNode): void {
  let totalSize = 0;
  let fileCount = 0;
  let folderCount = 0;
  let directFiles = 0;
  let directFolders = 0;

  for (const child of folder.children) {
    if (child.kind === 'file') {
      directFiles++;
      fileCount++;
      totalSize += child.size;
    } else if (child.kind === 'directory') {
      const sub = child as FolderNode;
      recalculateFolderSizes(sub);
      directFolders++;
      folderCount += 1 + sub.folderCount;
      fileCount += sub.fileCount;
      totalSize += sub.totalSize;
    }
  }

  folder.totalSize = totalSize;
  folder.fileCount = fileCount;
  folder.folderCount = folderCount;
  folder.directFileCount = directFiles;
  folder.directFolderCount = directFolders;
}
