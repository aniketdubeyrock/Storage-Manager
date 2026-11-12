import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { googleDriveService } from '../../services/cloud/googleDriveService';
import type { GoogleDriveUploadItem } from '../../types/googleDrive.types';

describe('GoogleDriveService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    googleDriveService.clearAccessToken();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('manages OAuth access tokens in session storage', () => {
    expect(googleDriveService.getAccessToken()).toBeNull();

    googleDriveService.setAccessToken('mock-token-xyz', 3600);
    expect(googleDriveService.getAccessToken()).toBe('mock-token-xyz');

    googleDriveService.clearAccessToken();
    expect(googleDriveService.getAccessToken()).toBeNull();
  });

  it('correctly simulates upload chunks, progress, and speed calculation', () => {
    const item: GoogleDriveUploadItem = {
      id: 'test-item-1',
      fileName: 'test-file.zip',
      fileSize: 10 * 1024 * 1024, // 10MB
      mimeType: 'application/zip',
      status: 'queued',
      uploadedBytes: 0,
      speedBytesPerSec: 0,
      progressPercent: 0,
      etaSeconds: null,
    };

    const progressUpdates: any[] = [];
    let completedFile: any = null;
    let errorReceived: any = null;

    const controller = googleDriveService.simulateUpload(
      item,
      (payload) => progressUpdates.push(payload),
      (file) => {
        completedFile = file;
      },
      (err) => {
        errorReceived = err;
      }
    );

    // Fast-forward 1 second (5 intervals of 200ms)
    vi.advanceTimersByTime(1000);

    expect(progressUpdates.length).toBeGreaterThanOrEqual(4);
    const latest = progressUpdates[progressUpdates.length - 1];
    expect(latest.uploadedBytes).toBeGreaterThan(0);
    expect(latest.speedBytesPerSec).toBeGreaterThan(0);
    expect(latest.progressPercent).toBeGreaterThan(0);
    expect(latest.progressPercent).toBeLessThanOrEqual(100);

    // Fast-forward until completed
    vi.advanceTimersByTime(10000);

    expect(completedFile).not.toBeNull();
    expect(completedFile.name).toBe('test-file.zip');
    expect(errorReceived).toBeNull();
  });

  it('supports pause and resume during simulated upload', () => {
    const item: GoogleDriveUploadItem = {
      id: 'test-item-pause',
      fileName: 'large-video.mp4',
      fileSize: 50 * 1024 * 1024, // 50MB
      mimeType: 'video/mp4',
      status: 'queued',
      uploadedBytes: 0,
      speedBytesPerSec: 0,
      progressPercent: 0,
      etaSeconds: null,
    };

    const progressUpdates: any[] = [];
    const controller = googleDriveService.simulateUpload(
      item,
      (payload) => progressUpdates.push(payload),
      () => {},
      () => {}
    );

    // Advance 400ms (2 ticks)
    vi.advanceTimersByTime(400);
    const countBeforePause = progressUpdates.length;
    expect(countBeforePause).toBeGreaterThan(0);

    // Pause
    controller.pause();
    vi.advanceTimersByTime(1000);
    expect(progressUpdates.length).toBe(countBeforePause); // No new progress while paused

    // Resume
    controller.resume();
    vi.advanceTimersByTime(400);
    expect(progressUpdates.length).toBeGreaterThan(countBeforePause);

    controller.cancel();
  });

  it('supports cancellation during simulated upload', () => {
    const item: GoogleDriveUploadItem = {
      id: 'test-item-cancel',
      fileName: 'cancelled.tar',
      fileSize: 20 * 1024 * 1024,
      mimeType: 'application/x-tar',
      status: 'queued',
      uploadedBytes: 0,
      speedBytesPerSec: 0,
      progressPercent: 0,
      etaSeconds: null,
    };

    let errorReceived: any = null;
    const controller = googleDriveService.simulateUpload(
      item,
      () => {},
      () => {},
      (err) => {
        errorReceived = err;
      }
    );

    controller.cancel();
    expect(errorReceived).not.toBeNull();
    expect(errorReceived.message).toBe('Upload cancelled');
  });

  it('rejects deletion when unauthenticated', async () => {
    await expect(googleDriveService.deleteFile('file-123')).rejects.toThrow(
      'Not authenticated with Google Drive'
    );
  });
});

