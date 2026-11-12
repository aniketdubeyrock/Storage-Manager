import React, { useRef, useState } from 'react';
import {
  CloudUpload,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  X,
  RotateCcw,
  Trash2,
  ExternalLink,
  Plus,
  Zap,
  Info,
  ShieldCheck,
  FolderUp,
  FolderOpen,
  FileCode,
  FileText,
  FileArchive,
  FileAudio,
  FileVideo,
  FileImage,
  File,
} from 'lucide-react';
import { useGoogleDriveStore } from '../stores/googleDrive.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes } from '../utils/formatters';
import type { UploadStatus } from '../types/googleDrive.types';

export const GoogleDrivePage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const {
    isConnected,
    isAuthenticating,
    user,
    quota,
    clientId,
    isSimulatedMode,
    uploadQueue,
    cloudFiles,
    overallSpeedBytesPerSec,
    setClientId,
    setSimulatedMode,
    connectGoogleDrive,
    disconnectGoogleDrive,
    enqueueFile,
    enqueueBatchFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    removeQueueItem,
    clearCompletedUploads,
    deleteCloudFile,
  } = useGoogleDriveStore();

  const [inputClientId, setInputClientId] = useState(clientId);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const activeUploads = uploadQueue.filter((i) => i.status === 'uploading');
  const queuedUploads = uploadQueue.filter((i) => i.status === 'queued');
  const completedUploads = uploadQueue.filter((i) => i.status === 'completed');
  const hasActiveTransfers = activeUploads.length > 0 || queuedUploads.length > 0;

  // Calculate remaining ETA across active uploads
  const totalRemainingBytes = uploadQueue
    .filter((i) => i.status === 'uploading' || i.status === 'queued')
    .reduce((acc, curr) => acc + (curr.fileSize - curr.uploadedBytes), 0);

  const aggregateEtaSeconds =
    overallSpeedBytesPerSec > 0
      ? Math.ceil(totalRemainingBytes / overallSpeedBytesPerSec)
      : null;

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const f = files[0];
      enqueueFile({
        name: f.name,
        size: f.size,
        mimeType: f.type,
        blob: f,
      });
    } else {
      const batch = Array.from(files).map((f) => ({
        name: f.name,
        size: f.size,
        mimeType: f.type,
        blob: f,
      }));
      enqueueBatchFiles(batch);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusBadge = (status: UploadStatus) => {
    switch (status) {
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            Uploading
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Queued
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Paused
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Uploaded
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            Cancelled
          </span>
        );
    }
  };

  const getFileIcon = (name: string, mime: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext || ''))
      return <FileImage className="w-5 h-5 text-purple-500" />;
    if (mime.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext || ''))
      return <FileVideo className="w-5 h-5 text-rose-500" />;
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'm4a', 'aac'].includes(ext || ''))
      return <FileAudio className="w-5 h-5 text-amber-500" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || ''))
      return <FileArchive className="w-5 h-5 text-amber-600" />;
    if (['ts', 'tsx', 'js', 'jsx', 'html', 'css', 'json', 'py', 'rs'].includes(ext || ''))
      return <FileCode className="w-5 h-5 text-blue-500" />;
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || ''))
      return <FileText className="w-5 h-5 text-indigo-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const formatEta = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return '--';
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `~${mins}m ${secs}s`;
  };

  // Quota calculation
  const totalQuota = quota?.totalBytes || 15 * 1024 * 1024 * 1024;
  const usedQuota = quota?.usedBytes || 0;
  const quotaPercent = Math.min(100, Math.round((usedQuota / totalQuota) * 100));

  return (
    <div className="space-y-6">
      {/* Hidden file input for manual upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleManualFileSelect}
        multiple
        className="hidden"
      />

      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Google Drive Cloud
                </h1>
                {isSimulatedMode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Interactive Demo Mode
                  </span>
                ) : isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Google Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Directly upload large files, backup directory contents, and monitor real-time transfer speeds.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <FolderUp className="w-4 h-4" />
              Upload Files
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              OAuth Setup
            </button>

            {completedUploads.length > 0 && (
              <button
                onClick={clearCompletedUploads}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors"
              >
                Clear Finished ({completedUploads.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cloud Target Folder Banner */}
      <div className="bg-slate-50 dark:bg-[#141e33] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              Cloud Target: <span className="text-blue-600 dark:text-blue-400 font-bold">Google Drive / Storage Manager</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              All individual files, multi-file selections, and backups are automatically organized inside the dedicated "Storage Manager" folder.
            </p>
          </div>
        </div>
      </div>

      {/* Live Upload Telemetry Banner (Visible when transfers are happening) */}
      {hasActiveTransfers && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 shadow-lg shadow-blue-600/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
                <Zap className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold tracking-tight">
                    {formatBytes(overallSpeedBytesPerSec)}/s
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                    Live Speed
                  </span>
                </div>
                <div className="text-xs text-blue-100 mt-0.5">
                  {activeUploads.length} actively uploading · {queuedUploads.length} queued in line
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-blue-200 text-xs block">Remaining Data</span>
                <span className="font-semibold text-white">{formatBytes(totalRemainingBytes, displayUnits)}</span>
              </div>
              <div>
                <span className="text-blue-200 text-xs block">Estimated Time</span>
                <span className="font-semibold text-white">{formatEta(aggregateEtaSeconds)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Account & Storage Quota Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* User Account Info */}
        <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Google Account
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="User" className="w-full h-full rounded-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'G'
                )}
              </div>
              <div className="truncate">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {user?.name || 'Google Drive'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'OAuth 2.0 Connected'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Mode: <span className="font-medium text-slate-700 dark:text-slate-300">{isSimulatedMode ? 'Simulated' : 'Live API'}</span>
            </span>
            <button
              onClick={() => setSimulatedMode(!isSimulatedMode)}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline"
            >
              Switch to {isSimulatedMode ? 'Live Mode' : 'Demo Mode'}
            </button>
          </div>
        </div>

        {/* Quota Progress */}
        <div className="md:col-span-2 bg-white dark:bg-[#0f172a] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Google Drive Cloud Quota
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {formatBytes(usedQuota, displayUnits)} of {formatBytes(totalQuota, displayUnits)} ({quotaPercent}%)
              </span>
            </div>

            {/* Meter Bar */}
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaPercent > 90
                    ? 'bg-rose-500'
                    : quotaPercent > 75
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 text-center">
            <div>
              <span className="text-[11px] text-slate-400 block">Total Capacity</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatBytes(totalQuota, displayUnits)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Used Storage</span>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatBytes(usedQuota, displayUnits)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Available</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatBytes(Math.max(0, totalQuota - usedQuota), displayUnits)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Queue Section */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Transfer & Upload Queue
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {uploadQueue.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Files
            </button>
          </div>
        </div>

        {uploadQueue.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-800 text-blue-500 mx-auto flex items-center justify-center mb-3">
              <CloudUpload className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No files in the upload queue
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Select files directly from the File Manager or Largest Files tab to upload them to Google Drive, or pick local files from your device.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow hover:bg-blue-700 transition-colors"
            >
              <FolderUp className="w-4 h-4" />
              Pick Files to Upload
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {uploadQueue.map((item) => {
              const isUploading = item.status === 'uploading';
              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(item.fileName, item.mimeType)}
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                          {item.fileName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {formatBytes(item.fileSize, displayUnits)} {item.filePath ? `· ${item.filePath}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(item.status)}

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        {item.status === 'uploading' && (
                          <button
                            onClick={() => pauseUpload(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}

                        {item.status === 'paused' && (
                          <button
                            onClick={() => resumeUpload(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Resume"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {item.status === 'error' && (
                          <button
                            onClick={() => retryUpload(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {(item.status === 'uploading' || item.status === 'queued') && (
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        {(item.status === 'completed' || item.status === 'cancelled' || item.status === 'error') && (
                          <button
                            onClick={() => removeQueueItem(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Telemetry details */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'completed'
                            ? 'bg-emerald-500'
                            : item.status === 'error'
                            ? 'bg-rose-500'
                            : item.status === 'paused'
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center gap-3">
                        <span>
                          {formatBytes(item.uploadedBytes, displayUnits)} of{' '}
                          {formatBytes(item.fileSize, displayUnits)} ({item.progressPercent}%)
                        </span>
                        {isUploading && item.speedBytesPerSec > 0 && (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {formatBytes(item.speedBytesPerSec)}/s
                          </span>
                        )}
                      </div>

                      <div>
                        {isUploading && (
                          <span>ETA: {formatEta(item.etaSeconds)}</span>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans">
                            Uploaded successfully
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-rose-500 font-sans">{item.error || 'Upload error'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cloud Files List */}
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Files in &ldquo;Storage Manager&rdquo; Folder
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {cloudFiles.length}
            </span>
          </div>
        </div>

        {cloudFiles.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No cloud files loaded. Files uploaded will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cloudFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(file.name, file.mimeType)}
                        <span className="font-medium text-slate-800 dark:text-slate-200">{file.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{formatBytes(file.size, displayUnits)}</td>
                    <td className="py-3 px-4">{new Date(file.modifiedTime).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${file.name}" from Google Drive?`)) {
                              deleteCloudFile(file.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete from Google Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OAuth Setup & Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Google Drive OAuth 2.0 Setup
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-sm">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs leading-relaxed">
                <div className="font-semibold mb-1 flex items-center gap-1.5 text-sm">
                  <Info className="w-4 h-4" />
                  Zero-Setup Demo Mode is Ready!
                </div>
                You do not need to register credentials to test this application. The interactive simulation provides authentic upload speeds, live byte tracking, ETA countdowns, and quota updates right now.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  To Connect a Real Google Account:
                </label>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Google Cloud Console &rarr; Credentials
                    </a>
                  </li>
                  <li>Enable the <strong>Google Drive API</strong> in your project.</li>
                  <li>
                    Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>).
                  </li>
                  <li>
                    Add Authorized JavaScript origin: <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">http://localhost:5173</code>
                  </li>
                  <li>Paste the Client ID below and click Connect.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  OAuth Client ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setSimulatedMode(true);
                    setShowConfigModal(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                >
                  Stay in Demo Mode
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setClientId(inputClientId);
                      setSimulatedMode(false);
                      connectGoogleDrive();
                      setShowConfigModal(false);
                    }}
                    disabled={!inputClientId.trim() || isAuthenticating}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all"
                  >
                    {isAuthenticating ? 'Connecting...' : 'Save & Sign In with Google'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

