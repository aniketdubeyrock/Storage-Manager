export type FileNodeKind = 'file';
export type FolderNodeKind = 'directory';

export interface FileNode {
  id: string;
  name: string;
  path: string; // e.g. "/Documents/report.pdf"
  parentPath: string; // e.g. "/Documents" or "/"
  extension: string; // e.g. "pdf" (lowercase, without dot)
  mimeType: string;
  size: number; // in bytes
  lastModified: number; // epoch timestamp
  kind: FileNodeKind;
  handle?: FileSystemFileHandle;
  scanStatus: 'scanned' | 'error' | 'pending';
}

export type NodeCalculationStatus = 'pending' | 'calculating' | 'ready' | 'error';

export interface FolderNode {
  id: string;
  name: string;
  path: string; // e.g. "/Documents"
  parentPath: string; // e.g. "/" or ""
  totalSize: number; // recursive sum of all descendants
  fileCount: number; // recursive count of all files
  folderCount: number; // recursive count of all subfolders
  directFileCount: number;
  directFolderCount: number;
  lastScanned: number;
  kind: FolderNodeKind;
  handle?: FileSystemDirectoryHandle;
  calculationStatus?: NodeCalculationStatus;
  children: Array<FileNode | FolderNode>;
}

export type AnyFsNode = FileNode | FolderNode;

export interface ScanProgress {
  isScanning: boolean;
  isBackgroundSizing?: boolean;
  currentPath: string;
  filesScanned: number;
  foldersScanned: number;
  bytesScanned: number;
  pendingFoldersCount?: number;
  resolvedFoldersCount?: number;
  startTime: number | null;
  elapsedTime: number; // ms
  status: 'idle' | 'scanning' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
}

export interface ScanError {
  path: string;
  message: string;
  timestamp: number;
}

export interface ScanResultSummary {
  rootName: string;
  totalSize: number;
  fileCount: number;
  folderCount: number;
  largestFile: FileNode | null;
  largestFolder: FolderNode | null;
  scannedAt: number;
  durationMs: number;
}

