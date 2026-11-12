import type { DriveInfo, QuickFolder, SystemScanEvent } from '../../types/companion.types';
import type { FolderNode, ScanError, ScanProgress } from '../../types/filesystem.types';

export async function fetchAvailableDrives(): Promise<DriveInfo[]> {
  try {
    const res = await fetch('/api/system/drives');
    if (!res.ok) return [];
    const data = await res.json();
    return data.drives || [];
  } catch (err) {
    console.warn('Could not fetch companion drives:', err);
    return [];
  }
}

export async function fetchQuickFolders(): Promise<QuickFolder[]> {
  try {
    const res = await fetch('/api/system/quick-folders');
    if (!res.ok) return [];
    const data = await res.json();
    return data.quickFolders || [];
  } catch (err) {
    console.warn('Could not fetch quick folders:', err);
    return [];
  }
}

export async function fetchShallowList(targetPath: string): Promise<FolderNode | null> {
  try {
    const res = await fetch(`/api/system/shallow-list?path=${encodeURIComponent(targetPath)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.folderNode || null;
  } catch (err) {
    console.warn('Could not fetch shallow list:', err);
    return null;
  }
}

export interface SystemScanOptions {
  signal?: AbortSignal;
  onInitialSurface?: (surfaceRoot: FolderNode) => void;
  onFolderResolved?: (event: SystemScanEvent) => void;
  onProgress?: (progress: ScanProgress) => void;
}

export function scanSystemPath(
  targetPath: string,
  options: SystemScanOptions = {}
): Promise<{ rootFolder: FolderNode; errors: ScanError[] }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = `/api/system/scan-stream?path=${encodeURIComponent(targetPath)}`;
    const eventSource = new EventSource(url);

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        eventSource.close();
        reject(new DOMException('Scanning was cancelled by the user.', 'AbortError'));
      });
    }

    eventSource.onmessage = (event) => {
      try {
        const data: SystemScanEvent = JSON.parse(event.data);

        if (data.type === 'initial_surface') {
          if (data.rootFolder && options.onInitialSurface) {
            options.onInitialSurface(data.rootFolder as FolderNode);
          }
          options.onProgress?.({
            isScanning: true,
            isBackgroundSizing: true,
            currentPath: 'Direct contents loaded • Calculating nested folders in background...',
            filesScanned: data.filesScanned || 0,
            foldersScanned: data.foldersScanned || 0,
            bytesScanned: data.bytesScanned || 0,
            startTime,
            elapsedTime: Date.now() - startTime,
            status: 'scanning',
          });
        } else if (data.type === 'progress') {
          options.onProgress?.({
            isScanning: true,
            isBackgroundSizing: true,
            currentPath: data.currentPath || targetPath,
            filesScanned: data.filesScanned || 0,
            foldersScanned: data.foldersScanned || 0,
            bytesScanned: data.bytesScanned || 0,
            pendingFoldersCount: data.pendingFoldersCount,
            resolvedFoldersCount: data.resolvedFoldersCount,
            startTime,
            elapsedTime: Date.now() - startTime,
            status: 'scanning',
          });
        } else if (data.type === 'folder_resolved') {
          if (options.onFolderResolved) {
            options.onFolderResolved(data);
          }
          options.onProgress?.({
            isScanning: true,
            isBackgroundSizing: (data.pendingFoldersCount || 0) > 0,
            currentPath: `Calculated: ${data.folderPath}`,
            filesScanned: data.filesScanned || 0,
            foldersScanned: data.foldersScanned || 0,
            bytesScanned: data.bytesScanned || 0,
            pendingFoldersCount: data.pendingFoldersCount,
            resolvedFoldersCount: data.resolvedFoldersCount,
            startTime,
            elapsedTime: Date.now() - startTime,
            status: 'scanning',
          });
        } else if (data.type === 'complete') {
          eventSource.close();
          options.onProgress?.({
            isScanning: false,
            isBackgroundSizing: false,
            currentPath: 'Completed',
            filesScanned: data.filesScanned || 0,
            foldersScanned: data.foldersScanned || 0,
            bytesScanned: data.bytesScanned || 0,
            pendingFoldersCount: 0,
            resolvedFoldersCount: data.foldersScanned || 0,
            startTime,
            elapsedTime: Date.now() - startTime,
            status: 'completed',
          });
          resolve({
            rootFolder: data.rootFolder as FolderNode,
            errors: (data.errors || []) as ScanError[],
          });
        } else if (data.type === 'error') {
          eventSource.close();
          reject(new Error(data.message || 'Scan failed'));
        }
      } catch (err) {
        eventSource.close();
        reject(err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error('Connection to local storage scanner interrupted.'));
    };
  });
}

export async function deleteSystemPath(
  targetPath: string,
  isDirectory = false
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/system/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPath, isDirectory }),
  });
  return await res.json();
}

export async function renameSystemPath(
  targetPath: string,
  newName: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  const res = await fetch('/api/system/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPath, newName }),
  });
  return await res.json();
}

export async function moveSystemPath(
  sourcePath: string,
  destinationDirPath: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  const res = await fetch('/api/system/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, destinationDirPath }),
  });
  return await res.json();
}
