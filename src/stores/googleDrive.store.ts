import { create } from 'zustand';
import toast from 'react-hot-toast';
import type {
  GoogleDriveFile,
  GoogleDriveQuota,
  GoogleDriveUploadItem,
  GoogleDriveUser,
  UploadProgressPayload,
} from '../types/googleDrive.types';
import { googleDriveService } from '../services/cloud/googleDriveService';

interface EnqueueFilePayload {
  name: string;
  size: number;
  mimeType?: string;
  path?: string;
  blob?: Blob;
}

interface GoogleDriveStoreState {
  isConnected: boolean;
  isAuthenticating: boolean;
  user: GoogleDriveUser | null;
  quota: GoogleDriveQuota | null;
  clientId: string;
  isSimulatedMode: boolean;
  uploadQueue: GoogleDriveUploadItem[];
  cloudFiles: GoogleDriveFile[];
  overallSpeedBytesPerSec: number;

  // Actions
  setClientId: (clientId: string) => void;
  setSimulatedMode: (enabled: boolean) => void;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => void;
  fetchDriveData: () => Promise<void>;

  // Queue actions
  enqueueFile: (file: EnqueueFilePayload) => string;
  enqueueBatchFiles: (files: EnqueueFilePayload[]) => void;
  startUpload: (itemId: string) => Promise<void>;
  processNextInQueue: () => void;
  pauseUpload: (itemId: string) => void;
  resumeUpload: (itemId: string) => void;
  cancelUpload: (itemId: string) => void;
  retryUpload: (itemId: string) => void;
  removeQueueItem: (itemId: string) => void;
  clearCompletedUploads: () => void;
  deleteCloudFile: (fileId: string) => Promise<void>;
}

const DEFAULT_SIMULATED_QUOTA: GoogleDriveQuota = {
  totalBytes: 15 * 1024 * 1024 * 1024, // 15 GB
  usedBytes: 4.82 * 1024 * 1024 * 1024, // 4.82 GB used
  availableBytes: 10.18 * 1024 * 1024 * 1024,
};

const DEFAULT_SIMULATED_USER: GoogleDriveUser = {
  name: 'Demo Drive Account',
  email: 'user.backup@gmail.com',
};

const DEFAULT_SIMULATED_FILES: GoogleDriveFile[] = [
  {
    id: 'sim-init-1',
    name: 'Storage_Backup_2026.zip',
    mimeType: 'application/zip',
    size: 284000000,
    modifiedTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    webViewLink: 'https://drive.google.com',
  },
  {
    id: 'sim-init-2',
    name: 'Work_Archives_Q1.tar.gz',
    mimeType: 'application/gzip',
    size: 145000000,
    modifiedTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    webViewLink: 'https://drive.google.com',
  },
  {
    id: 'sim-init-3',
    name: 'System_Disk_Report.pdf',
    mimeType: 'application/pdf',
    size: 4200000,
    modifiedTime: new Date(Date.now() - 86400000 * 7).toISOString(),
    webViewLink: 'https://drive.google.com',
  },
];

export const useGoogleDriveStore = create<GoogleDriveStoreState>((set, get) => {
  const savedClientId = localStorage.getItem('gdrive_client_id') || '';
  const savedSimulated = localStorage.getItem('gdrive_simulated') !== 'false';

  return {
    isConnected: true, // Connected in simulation mode by default for instant out-of-the-box usage
    isAuthenticating: false,
    user: DEFAULT_SIMULATED_USER,
    quota: DEFAULT_SIMULATED_QUOTA,
    clientId: savedClientId,
    isSimulatedMode: savedSimulated,
    uploadQueue: [],
    cloudFiles: DEFAULT_SIMULATED_FILES,
    overallSpeedBytesPerSec: 0,

    setClientId: (clientId: string) => {
      localStorage.setItem('gdrive_client_id', clientId.trim());
      set({ clientId: clientId.trim() });
    },

    setSimulatedMode: (enabled: boolean) => {
      localStorage.setItem('gdrive_simulated', String(enabled));
      if (enabled) {
        set({
          isSimulatedMode: true,
          isConnected: true,
          user: DEFAULT_SIMULATED_USER,
          quota: get().quota || DEFAULT_SIMULATED_QUOTA,
        });
        toast.success('Switched to Interactive Simulated Drive Mode');
      } else {
        const hasToken = !!googleDriveService.getAccessToken();
        set({
          isSimulatedMode: false,
          isConnected: hasToken,
          user: hasToken ? get().user : null,
        });
        if (!hasToken) {
          toast('Please connect your Google Account using your Client ID', { icon: 'ℹ️' });
        }
      }
    },

    connectGoogleDrive: async () => {
      const { clientId, isSimulatedMode } = get();

      if (isSimulatedMode) {
        set({
          isConnected: true,
          user: DEFAULT_SIMULATED_USER,
          quota: DEFAULT_SIMULATED_QUOTA,
        });
        toast.success('Connected to Simulated Google Drive');
        return;
      }

      if (!clientId) {
        toast.error('Please enter your Google OAuth Client ID in Settings first.');
        return;
      }

      set({ isAuthenticating: true });
      try {
        await googleDriveService.requestOAuthToken(clientId);
        set({ isConnected: true, isAuthenticating: false });
        toast.success('Connected to Google Drive successfully!');
        await get().fetchDriveData();
      } catch (err: any) {
        set({ isAuthenticating: false, isConnected: false });
        toast.error(`Authentication failed: ${err.message || 'Unknown error'}`);
      }
    },

    disconnectGoogleDrive: () => {
      googleDriveService.clearAccessToken();
      set({
        isConnected: false,
        user: null,
      });
      toast.success('Disconnected from Google Drive');
    },

    fetchDriveData: async () => {
      const { isSimulatedMode, isConnected } = get();
      if (!isConnected) return;

      if (isSimulatedMode) {
        // Already loaded simulated defaults
        return;
      }

      try {
        const [about, files] = await Promise.all([
          googleDriveService.fetchDriveAbout(),
          googleDriveService.fetchRecentFiles(),
        ]);

        set({
          user: about.user,
          quota: about.quota,
          cloudFiles: files,
        });
      } catch (err: any) {
        console.error('Failed to fetch Drive details:', err);
      }
    },

    enqueueFile: (filePayload: EnqueueFilePayload): string => {
      const id = 'upl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const newItem: GoogleDriveUploadItem = {
        id,
        fileName: filePayload.name,
        fileSize: filePayload.size,
        filePath: filePayload.path,
        mimeType: filePayload.mimeType || 'application/octet-stream',
        status: 'queued',
        uploadedBytes: 0,
        speedBytesPerSec: 0,
        progressPercent: 0,
        etaSeconds: null,
        fileBlob: filePayload.blob,
      };

      set((state) => ({
        uploadQueue: [newItem, ...state.uploadQueue],
      }));

      toast.success(`Added "${filePayload.name}" to Google Drive upload queue`);

      // Start upload asynchronously
      setTimeout(() => {
        get().processNextInQueue();
      }, 50);

      return id;
    },

    enqueueBatchFiles: (files: EnqueueFilePayload[]) => {
      if (files.length === 0) return;

      const newItems: GoogleDriveUploadItem[] = files.map((filePayload, idx) => ({
        id: `upl-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        fileName: filePayload.name,
        fileSize: filePayload.size,
        filePath: filePayload.path,
        mimeType: filePayload.mimeType || 'application/octet-stream',
        status: 'queued',
        uploadedBytes: 0,
        speedBytesPerSec: 0,
        progressPercent: 0,
        etaSeconds: null,
        fileBlob: filePayload.blob,
      }));

      set((state) => ({
        uploadQueue: [...newItems, ...state.uploadQueue],
      }));

      toast.success(`Queued ${files.length} items for Google Drive upload`);

      setTimeout(() => {
        get().processNextInQueue();
      }, 50);
    },

    processNextInQueue: () => {
      const { uploadQueue } = get();
      const currentUploading = uploadQueue.filter((item) => item.status === 'uploading');

      // Allow up to 2 concurrent uploads
      if (currentUploading.length >= 2) return;

      const nextItem = uploadQueue.find((item) => item.status === 'queued');
      if (nextItem) {
        get().startUpload(nextItem.id);
      }
    },

    startUpload: async (itemId: string) => {
      const item = get().uploadQueue.find((i) => i.id === itemId);
      if (!item) return;

      // Update status to uploading
      set((state) => ({
        uploadQueue: state.uploadQueue.map((i) =>
          i.id === itemId
            ? { ...i, status: 'uploading', startedAt: i.startedAt || Date.now(), error: undefined }
            : i
        ),
      }));

      const onProgress = (payload: UploadProgressPayload) => {
        set((state) => {
          const updated = state.uploadQueue.map((i) => {
            if (i.id === payload.itemId) {
              return {
                ...i,
                uploadedBytes: payload.uploadedBytes,
                speedBytesPerSec: payload.speedBytesPerSec,
                progressPercent: payload.progressPercent,
                etaSeconds: payload.etaSeconds,
              };
            }
            return i;
          });

          // Calculate overall aggregate upload speed
          const overallSpeed = updated
            .filter((i) => i.status === 'uploading')
            .reduce((acc, curr) => acc + curr.speedBytesPerSec, 0);

          return {
            uploadQueue: updated,
            overallSpeedBytesPerSec: overallSpeed,
          };
        });
      };

      const { isSimulatedMode } = get();

      if (isSimulatedMode || !googleDriveService.getAccessToken()) {
        // Run simulated upload
        googleDriveService.simulateUpload(
          item,
          onProgress,
          (completedFile) => {
            // Success handler
            set((state) => {
              const updatedQueue = state.uploadQueue.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      status: 'completed' as const,
                      uploadedBytes: i.fileSize,
                      progressPercent: 100,
                      speedBytesPerSec: 0,
                      etaSeconds: 0,
                      completedAt: Date.now(),
                      driveFileId: completedFile.id,
                    }
                  : i
              );

              const currentQuota = state.quota || DEFAULT_SIMULATED_QUOTA;
              const newUsed = currentQuota.usedBytes + item.fileSize;

              return {
                uploadQueue: updatedQueue,
                cloudFiles: [completedFile, ...state.cloudFiles],
                quota: {
                  ...currentQuota,
                  usedBytes: newUsed,
                  availableBytes: Math.max(0, currentQuota.totalBytes - newUsed),
                },
                overallSpeedBytesPerSec: updatedQueue
                  .filter((i) => i.status === 'uploading')
                  .reduce((acc, curr) => acc + curr.speedBytesPerSec, 0),
              };
            });

            toast.success(`Uploaded "${item.fileName}" to Google Drive!`);
            get().processNextInQueue();
          },
          (err) => {
            if (err.message !== 'Upload cancelled') {
              set((state) => ({
                uploadQueue: state.uploadQueue.map((i) =>
                  i.id === itemId
                    ? { ...i, status: 'error', error: err.message, speedBytesPerSec: 0 }
                    : i
                ),
              }));
              toast.error(`Upload failed: ${err.message}`);
            }
            get().processNextInQueue();
          }
        );
      } else {
        // Real upload to Google Drive
        try {
          let blob = item.fileBlob;
          // If no direct blob but we have a filePath, fetch stream from companion
          if (!blob && item.filePath) {
            const res = await fetch(`/api/system/stream-file?path=${encodeURIComponent(item.filePath)}`);
            if (res.ok) {
              blob = await res.blob();
            }
          }

          if (!blob) {
            throw new Error('File data is not accessible for upload.');
          }

          const completedFile = await googleDriveService.uploadToGoogleDrive(
            item,
            blob,
            onProgress
          );

          set((state) => ({
            uploadQueue: state.uploadQueue.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    status: 'completed',
                    uploadedBytes: i.fileSize,
                    progressPercent: 100,
                    speedBytesPerSec: 0,
                    etaSeconds: 0,
                    completedAt: Date.now(),
                    driveFileId: completedFile.id,
                  }
                : i
            ),
            cloudFiles: [completedFile, ...state.cloudFiles],
          }));

          toast.success(`Uploaded "${item.fileName}" to Google Drive!`);
          get().fetchDriveData();
          get().processNextInQueue();
        } catch (err: any) {
          if (err.name !== 'AbortError' && err.message !== 'Upload cancelled.') {
            set((state) => ({
              uploadQueue: state.uploadQueue.map((i) =>
                i.id === itemId
                  ? { ...i, status: 'error', error: err.message, speedBytesPerSec: 0 }
                  : i
              ),
            }));
            toast.error(`Upload error: ${err.message}`);
          }
          get().processNextInQueue();
        }
      }
    },

    pauseUpload: (itemId: string) => {
      googleDriveService.pauseSimulatedUpload(itemId);
      set((state) => ({
        uploadQueue: state.uploadQueue.map((i) =>
          i.id === itemId ? { ...i, status: 'paused', speedBytesPerSec: 0 } : i
        ),
      }));
      toast('Upload paused', { icon: '⏸️' });
    },

    resumeUpload: (itemId: string) => {
      googleDriveService.resumeSimulatedUpload(itemId);
      get().startUpload(itemId);
      toast('Upload resumed', { icon: '▶️' });
    },

    cancelUpload: (itemId: string) => {
      googleDriveService.cancelUpload(itemId);
      set((state) => ({
        uploadQueue: state.uploadQueue.map((i) =>
          i.id === itemId
            ? { ...i, status: 'cancelled', speedBytesPerSec: 0, etaSeconds: null }
            : i
        ),
      }));
      toast('Upload cancelled', { icon: '🛑' });
      get().processNextInQueue();
    },

    retryUpload: (itemId: string) => {
      set((state) => ({
        uploadQueue: state.uploadQueue.map((i) =>
          i.id === itemId
            ? { ...i, status: 'queued', uploadedBytes: 0, progressPercent: 0, error: undefined }
            : i
        ),
      }));
      get().startUpload(itemId);
    },

    removeQueueItem: (itemId: string) => {
      googleDriveService.cancelUpload(itemId);
      set((state) => ({
        uploadQueue: state.uploadQueue.filter((i) => i.id !== itemId),
      }));
    },

    clearCompletedUploads: () => {
      set((state) => ({
        uploadQueue: state.uploadQueue.filter(
          (i) => i.status !== 'completed' && i.status !== 'cancelled'
        ),
      }));
      toast.success('Cleared completed uploads');
    },

    deleteCloudFile: async (fileId: string) => {
      const { cloudFiles, isSimulatedMode, quota } = get();
      const fileToDelete = cloudFiles.find((f) => f.id === fileId);
      const fileName = fileToDelete?.name || 'File';

      try {
        if (!isSimulatedMode) {
          await googleDriveService.deleteFile(fileId);
        }

        const updatedFiles = cloudFiles.filter((f) => f.id !== fileId);
        const sizeFreed = fileToDelete?.size || 0;
        const currentQuota = quota || DEFAULT_SIMULATED_QUOTA;
        const newUsed = Math.max(0, currentQuota.usedBytes - sizeFreed);

        set({
          cloudFiles: updatedFiles,
          quota: {
            ...currentQuota,
            usedBytes: newUsed,
            availableBytes: Math.max(0, currentQuota.totalBytes - newUsed),
          },
        });

        toast.success(`Deleted "${fileName}" from Google Drive`);
      } catch (err: any) {
        toast.error(`Delete failed: ${err.message || 'Unknown error'}`);
      }
    },
  };
});

