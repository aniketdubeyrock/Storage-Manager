import type {
  GoogleDriveFile,
  GoogleDriveQuota,
  GoogleDriveUploadItem,
  UploadProgressPayload,
} from '../../types/googleDrive.types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

interface ActiveSimulation {
  timerId: ReturnType<typeof setInterval> | null;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  paused: boolean;
  cancelled: boolean;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private gisLoaded: boolean = false;
  private appFolderId: string | null = null;
  private activeSimulations = new Map<string, ActiveSimulation>();
  private activeAborts = new Map<string, AbortController>();

  constructor() {
    // Attempt to load token from session if available
    const savedToken = sessionStorage.getItem('gdrive_token');
    const savedExpiry = sessionStorage.getItem('gdrive_token_expires');
    if (savedToken && savedExpiry && Number(savedExpiry) > Date.now()) {
      this.accessToken = savedToken;
      this.tokenExpiresAt = Number(savedExpiry);
    }
  }

  /**
   * Load Google Identity Services script dynamically
   */
  public async loadGISScript(): Promise<boolean> {
    if (this.gisLoaded || window.google?.accounts?.oauth2) {
      this.gisLoaded = true;
      return true;
    }

    return new Promise((resolve) => {
      const existing = document.getElementById('google-gis-script');
      if (existing) {
        existing.addEventListener('load', () => {
          this.gisLoaded = true;
          resolve(true);
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.gisLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('Could not load Google Identity Services SDK');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Request OAuth 2.0 access token using GIS Token Client
   */
  public async requestOAuthToken(clientId: string): Promise<string> {
    await this.loadGISScript();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services SDK is not available.');
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            if (response.access_token) {
              this.accessToken = response.access_token;
              // Token expires in 1 hour (3600 seconds)
              this.tokenExpiresAt = Date.now() + 3500 * 1000;
              sessionStorage.setItem('gdrive_token', this.accessToken);
              sessionStorage.setItem('gdrive_token_expires', String(this.tokenExpiresAt));
              resolve(this.accessToken);
            } else {
              reject(new Error('No access token returned from Google.'));
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  public getAccessToken(): string | null {
    if (this.accessToken && this.tokenExpiresAt > Date.now()) {
      return this.accessToken;
    }
    return null;
  }

  public setAccessToken(token: string, expiresInSeconds: number = 3600): void {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (expiresInSeconds - 100) * 1000;
    sessionStorage.setItem('gdrive_token', token);
    sessionStorage.setItem('gdrive_token_expires', String(this.tokenExpiresAt));
  }

  public clearAccessToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    sessionStorage.removeItem('gdrive_token');
    sessionStorage.removeItem('gdrive_token_expires');
  }

  /**
   * Fetch Google Drive User Info & Storage Quota
   */
  public async fetchDriveAbout(): Promise<{
    user: { name: string; email: string; photoUrl?: string };
    quota: GoogleDriveQuota;
  }> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Google Drive.');
    }

    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch Drive info: ${res.statusText}`);
    }

    const data = await res.json();
    const quota = data.storageQuota || {};
    const limit = Number(quota.limit || 15 * 1024 * 1024 * 1024);
    const usage = Number(quota.usage || 0);

    return {
      user: {
        name: data.user?.displayName || 'Google User',
        email: data.user?.emailAddress || '',
        photoUrl: data.user?.photoLink,
      },
      quota: {
        totalBytes: limit,
        usedBytes: usage,
        availableBytes: Math.max(0, limit - usage),
      },
    };
  }

  /**
   * Find or automatically create the dedicated "Storage Manager" folder in the user's Google Drive.
   */
  public async getOrCreateStorageManagerFolder(token: string): Promise<string | null> {
    if (this.appFolderId) return this.appFolderId;

    try {
      // 1. Search for existing 'Storage Manager' folder
      const query = encodeURIComponent("name = 'Storage Manager' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          this.appFolderId = data.files[0].id;
          return this.appFolderId;
        }
      }

      // 2. Folder does not exist yet: create it in root
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Storage Manager',
          mimeType: 'application/vnd.google-apps.folder',
          description: 'Dedicated folder created by Storage Manager web app for uploads and backups.',
        }),
      });

      if (createRes.ok) {
        const folder = await createRes.json();
        this.appFolderId = folder.id;
        return this.appFolderId;
      }
    } catch (err) {
      console.warn('Could not ensure Storage Manager folder, uploading to root:', err);
    }

    return null;
  }

  /**
   * Fetch files from Google Drive (prioritizing files inside 'Storage Manager' folder)
   */
  public async fetchRecentFiles(): Promise<GoogleDriveFile[]> {
    const token = this.getAccessToken();
    if (!token) return [];

    let folderId = this.appFolderId;
    if (!folderId) {
      folderId = await this.getOrCreateStorageManagerFolder(token);
    }

    const q = folderId
      ? encodeURIComponent(`'${folderId}' in parents and trashed = false`)
      : encodeURIComponent(`trashed = false`);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=50&fields=files(id,name,mimeType,size,webViewLink,modifiedTime,iconLink)&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to list files: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size || 0),
      webViewLink: f.webViewLink,
      modifiedTime: f.modifiedTime,
      iconLink: f.iconLink,
    }));
  }

  /**
   * Delete a file from Google Drive
   */
  public async deleteFile(fileId: string): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Google Drive.');
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 204 && res.status !== 404) {
      let errMsg = res.statusText;
      try {
        const errJson = await res.json();
        if (errJson.error?.message) errMsg = errJson.error.message;
      } catch {}
      throw new Error(`Failed to delete file from Google Drive: ${errMsg}`);
    }

    return true;
  }

  /**
   * Upload to Google Drive with progress, speed, and ETA tracking.
   * Uses Multipart Upload for files <= 25MB (atomic single-request, 100% CORS compliant)
   * and Resumable Upload with Content-Range for larger files.
   */
  public async uploadToGoogleDrive(
    item: GoogleDriveUploadItem,
    fileBlob: Blob,
    onProgress: (payload: UploadProgressPayload) => void
  ): Promise<GoogleDriveFile> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Google Drive. Please click Reconnect Account.');
    }

    const abortController = new AbortController();
    this.activeAborts.set(item.id, abortController);

    try {
      // For files <= 25MB, Multipart Upload is most reliable across browser CORS
      if (fileBlob.size <= 25 * 1024 * 1024) {
        return await this.uploadViaMultipart(token, item, fileBlob, abortController, onProgress);
      } else {
        try {
          return await this.uploadViaResumable(token, item, fileBlob, abortController, onProgress);
        } catch (resumableErr) {
          console.warn('Resumable upload failed, falling back to multipart:', resumableErr);
          return await this.uploadViaMultipart(token, item, fileBlob, abortController, onProgress);
        }
      }
    } finally {
      this.activeAborts.delete(item.id);
    }
  }

  /**
   * Google Drive API Multipart Upload
   * Official Google REST standard for client-side uploads with metadata and binary payload.
   */
  private async uploadViaMultipart(
    token: string,
    item: GoogleDriveUploadItem,
    fileBlob: Blob,
    abortController: AbortController,
    onProgress: (payload: UploadProgressPayload) => void
  ): Promise<GoogleDriveFile> {
    const boundary = '-------storage_mgr_' + Math.random().toString(36).substring(2, 10);
    const folderId = await this.getOrCreateStorageManagerFolder(token);

    const metadataObj: Record<string, any> = {
      name: item.fileName,
      mimeType: item.mimeType || 'application/octet-stream',
    };
    if (folderId) {
      metadataObj.parents = [folderId];
    }

    const metadata = JSON.stringify(metadataObj);

    const preBody = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${item.mimeType || 'application/octet-stream'}\r\n\r\n`;
    const postBody = `\r\n--${boundary}--`;

    const multipartBlob = new Blob([preBody, fileBlob, postBody], {
      type: `multipart/related; boundary=${boundary}`,
    });

    return new Promise<GoogleDriveFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

      let lastTime = performance.now();
      let lastLoaded = 0;
      let smoothedSpeed = 0;

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const now = performance.now();
          const timeDiffSec = (now - lastTime) / 1000;
          const bytesDiff = evt.loaded - lastLoaded;

          if (timeDiffSec >= 0.25) {
            const instantSpeed = bytesDiff / timeDiffSec;
            smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : 0.3 * instantSpeed + 0.7 * smoothedSpeed;
            lastTime = now;
            lastLoaded = evt.loaded;
          }

          const actualLoaded = Math.min(item.fileSize, Math.round((evt.loaded / evt.total) * item.fileSize));
          const remainingBytes = Math.max(0, item.fileSize - actualLoaded);
          const eta = smoothedSpeed > 0 ? Math.ceil(remainingBytes / smoothedSpeed) : null;
          const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));

          onProgress({
            itemId: item.id,
            uploadedBytes: actualLoaded,
            totalBytes: item.fileSize,
            speedBytesPerSec: Math.round(smoothedSpeed),
            progressPercent: percent,
            etaSeconds: eta,
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const responseData = JSON.parse(xhr.responseText);
            resolve({
              id: responseData.id,
              name: responseData.name || item.fileName,
              mimeType: responseData.mimeType || item.mimeType,
              size: item.fileSize,
              modifiedTime: new Date().toISOString(),
              webViewLink: `https://drive.google.com/file/d/${responseData.id}/view`,
            });
          } catch {
            resolve({
              id: 'drive-' + Date.now(),
              name: item.fileName,
              mimeType: item.mimeType,
              size: item.fileSize,
              modifiedTime: new Date().toISOString(),
            });
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const errObj = JSON.parse(xhr.responseText);
            if (errObj.error?.message) {
              errorMsg = errObj.error.message;
            }
          } catch {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Google Drive upload. Verify that the Google Drive API is enabled in your Google Cloud project.'));
      };

      xhr.onabort = () => reject(new Error('Upload cancelled.'));

      abortController.signal.addEventListener('abort', () => xhr.abort());
      xhr.send(multipartBlob);
    });
  }

  /**
   * Google Drive API Resumable Upload
   * Includes required Content-Range header for large file transfers.
   */
  private async uploadViaResumable(
    token: string,
    item: GoogleDriveUploadItem,
    fileBlob: Blob,
    abortController: AbortController,
    onProgress: (payload: UploadProgressPayload) => void
  ): Promise<GoogleDriveFile> {
    const folderId = await this.getOrCreateStorageManagerFolder(token);
    const reqBody: Record<string, any> = {
      name: item.fileName,
    };
    if (folderId) {
      reqBody.parents = [folderId];
    }

    // 1. Initialize Resumable Session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': item.mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': String(item.fileSize),
        },
        body: JSON.stringify(reqBody),
        signal: abortController.signal,
      }
    );

    if (!initRes.ok) {
      let errDetail = initRes.statusText;
      try {
        const errJson = await initRes.json();
        if (errJson.error?.message) errDetail = errJson.error.message;
      } catch {}
      throw new Error(`Failed to initiate upload session (${initRes.status}): ${errDetail}`);
    }

    const locationUrl = initRes.headers.get('Location');
    if (!locationUrl) {
      throw new Error('Google Drive did not return a resumable session URI.');
    }

    // 2. Perform chunked upload with XMLHttpRequest for accurate byte-progress
    return await new Promise<GoogleDriveFile>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', locationUrl);
      xhr.setRequestHeader('Content-Type', item.mimeType || 'application/octet-stream');
      if (item.fileSize > 0) {
        xhr.setRequestHeader('Content-Range', `bytes 0-${item.fileSize - 1}/${item.fileSize}`);
      }

      let lastTime = performance.now();
      let lastLoaded = 0;
      let smoothedSpeed = 0;

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const now = performance.now();
          const timeDiffSec = (now - lastTime) / 1000;
          const bytesDiff = evt.loaded - lastLoaded;

          if (timeDiffSec >= 0.25) {
            const instantSpeed = bytesDiff / timeDiffSec;
            smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : 0.3 * instantSpeed + 0.7 * smoothedSpeed;
            lastTime = now;
            lastLoaded = evt.loaded;
          }

          const remainingBytes = Math.max(0, evt.total - evt.loaded);
          const eta = smoothedSpeed > 0 ? Math.ceil(remainingBytes / smoothedSpeed) : null;
          const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));

          onProgress({
            itemId: item.id,
            uploadedBytes: evt.loaded,
            totalBytes: evt.total,
            speedBytesPerSec: Math.round(smoothedSpeed),
            progressPercent: percent,
            etaSeconds: eta,
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const responseData = JSON.parse(xhr.responseText);
            resolve({
              id: responseData.id,
              name: responseData.name || item.fileName,
              mimeType: responseData.mimeType || item.mimeType,
              size: item.fileSize,
              modifiedTime: new Date().toISOString(),
              webViewLink: `https://drive.google.com/file/d/${responseData.id}/view`,
            });
          } catch {
            resolve({
              id: 'drive-' + Date.now(),
              name: item.fileName,
              mimeType: item.mimeType,
              size: item.fileSize,
              modifiedTime: new Date().toISOString(),
            });
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const errObj = JSON.parse(xhr.responseText);
            if (errObj.error?.message) errorMsg = errObj.error.message;
          } catch {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during Google Drive resumable upload.'));
      xhr.onabort = () => reject(new Error('Upload cancelled.'));

      abortController.signal.addEventListener('abort', () => xhr.abort());
      xhr.send(fileBlob);
    });
  }

  /**
   * Interactive Simulated Upload Engine
   * Provides realistic network transfer simulation with dynamic speed jitter (1.5 - 6.5 MB/s),
   * exact progress reporting, ETA countdown, pause, resume, and cancellation.
   */
  public simulateUpload(
    item: GoogleDriveUploadItem,
    onProgress: (payload: UploadProgressPayload) => void,
    onComplete: (file: GoogleDriveFile) => void,
    onError: (err: Error) => void
  ): {
    pause: () => void;
    resume: () => void;
    cancel: () => void;
  } {
    const totalBytes = item.fileSize || 1024 * 1024; // Fallback 1MB if 0
    let uploadedBytes = item.uploadedBytes || 0;

    // Base transfer speed between 2.2 MB/s and 7.5 MB/s
    const baseSpeed = Math.floor(2.2 * 1024 * 1024 + Math.random() * 5.3 * 1024 * 1024);
    let currentSpeed = baseSpeed;

    const simState: ActiveSimulation = {
      timerId: null,
      uploadedBytes,
      totalBytes,
      speedBytesPerSec: baseSpeed,
      paused: false,
      cancelled: false,
    };

    const intervalMs = 200; // 5 ticks per second

    const tick = () => {
      if (simState.paused || simState.cancelled) return;

      // Add realistic jitter (+/- 15%)
      const jitterFactor = 0.85 + Math.random() * 0.3;
      currentSpeed = Math.round(baseSpeed * jitterFactor);
      simState.speedBytesPerSec = currentSpeed;

      const chunk = Math.round((currentSpeed * intervalMs) / 1000);
      uploadedBytes = Math.min(totalBytes, uploadedBytes + chunk);
      simState.uploadedBytes = uploadedBytes;

      const remainingBytes = Math.max(0, totalBytes - uploadedBytes);
      const etaSeconds = currentSpeed > 0 ? Math.ceil(remainingBytes / currentSpeed) : 0;
      const progressPercent = Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));

      onProgress({
        itemId: item.id,
        uploadedBytes,
        totalBytes,
        speedBytesPerSec: currentSpeed,
        progressPercent,
        etaSeconds,
      });

      if (uploadedBytes >= totalBytes) {
        if (simState.timerId) clearInterval(simState.timerId);
        this.activeSimulations.delete(item.id);

        const completedFile: GoogleDriveFile = {
          id: 'sim-' + Math.random().toString(36).substring(2, 10),
          name: item.fileName,
          mimeType: item.mimeType,
          size: totalBytes,
          modifiedTime: new Date().toISOString(),
          webViewLink: `https://drive.google.com/drive/folders/simulation-demo`,
        };
        onComplete(completedFile);
      }
    };

    simState.timerId = setInterval(tick, intervalMs);
    this.activeSimulations.set(item.id, simState);

    return {
      pause: () => {
        simState.paused = true;
        if (simState.timerId) {
          clearInterval(simState.timerId);
          simState.timerId = null;
        }
      },
      resume: () => {
        if (!simState.paused) return;
        simState.paused = false;
        simState.timerId = setInterval(tick, intervalMs);
      },
      cancel: () => {
        simState.cancelled = true;
        if (simState.timerId) {
          clearInterval(simState.timerId);
          simState.timerId = null;
        }
        this.activeSimulations.delete(item.id);
        onError(new Error('Upload cancelled'));
      },
    };
  }

  public cancelUpload(itemId: string): void {
    // Check real upload abort
    const abortController = this.activeAborts.get(itemId);
    if (abortController) {
      abortController.abort();
      this.activeAborts.delete(itemId);
    }

    // Check simulated upload
    const sim = this.activeSimulations.get(itemId);
    if (sim) {
      sim.cancelled = true;
      if (sim.timerId) clearInterval(sim.timerId);
      this.activeSimulations.delete(itemId);
    }
  }

  public pauseSimulatedUpload(itemId: string): void {
    const sim = this.activeSimulations.get(itemId);
    if (sim && sim.timerId) {
      sim.paused = true;
      clearInterval(sim.timerId);
      sim.timerId = null;
    }
  }

  public resumeSimulatedUpload(itemId: string): void {
    const sim = this.activeSimulations.get(itemId);
    if (sim && sim.paused) {
      sim.paused = false;
    }
  }
}

export const googleDriveService = new GoogleDriveService();

