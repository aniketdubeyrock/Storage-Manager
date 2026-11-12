export interface DriveInfo {
  id: string; // "C:", "D:"
  name: string; // "Local Disk (C:)"
  volumeName: string; // "ACER"
  path: string; // "C:\"
  totalSize: number; // in bytes
  freeSpace: number; // in bytes
  usedSpace: number; // in bytes
  driveType?: string; // "Fixed Disk", "Removable", etc.
}

export interface QuickFolder {
  id: string; // 'downloads', 'documents', 'desktop', 'pictures', 'videos', 'music'
  name: string; // 'Downloads', 'Documents', etc.
  path: string; // 'C:\Users\Aniket\Downloads'
  icon: 'downloads' | 'documents' | 'desktop' | 'pictures' | 'videos' | 'music';
  itemCount?: number;
}

export interface SystemScanEvent {
  type: 'initial_surface' | 'folder_resolved' | 'progress' | 'complete' | 'error';
  filesScanned?: number;
  foldersScanned?: number;
  bytesScanned?: number;
  currentPath?: string;
  rootFolder?: any;
  folderPath?: string;
  resolvedFolder?: any;
  pendingFoldersCount?: number;
  resolvedFoldersCount?: number;
  durationMs?: number;
  message?: string;
  errors?: any[];
}
