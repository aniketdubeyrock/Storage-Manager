export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface GoogleDriveUser {
  name: string;
  email: string;
  photoUrl?: string;
}

export interface GoogleDriveQuota {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
}

export interface GoogleDriveUploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  filePath?: string;
  mimeType: string;
  status: UploadStatus;
  uploadedBytes: number;
  speedBytesPerSec: number;
  progressPercent: number;
  etaSeconds: number | null;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  driveFileId?: string;
  fileBlob?: Blob;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  modifiedTime: string;
  iconLink?: string;
  shared?: boolean;
}

export interface GoogleDriveConfig {
  clientId: string;
  isSimulatedMode: boolean;
  autoUploadDuplicates?: boolean;
  uploadChunkSize?: number;
}

export interface UploadProgressPayload {
  itemId: string;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  progressPercent: number;
  etaSeconds: number | null;
}

