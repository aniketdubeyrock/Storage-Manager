import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  FolderOpen,
  X,
  Download,
  FileText,
  Monitor,
  Image,
  Film,
  Music,
  ChevronRight,
  Laptop,
  CheckCircle2,
  FolderSearch,
  AlertCircle,
  FolderPlus,
} from 'lucide-react';
import { useFilesystemStore } from '../../stores/filesystem.store';
import { useSettingsStore } from '../../stores/settings.store';
import { formatBytes } from '../../utils/formatters';
import type { QuickFolder } from '../../types/companion.types';

const ICON_MAP: Record<QuickFolder['icon'], React.ElementType> = {
  downloads: Download,
  documents: FileText,
  desktop: Monitor,
  pictures: Image,
  videos: Film,
  music: Music,
};

export const FolderPickerModal: React.FC = () => {
  const isOpen = useFilesystemStore((s) => s.isPickerModalOpen);
  const close = useFilesystemStore((s) => s.closePickerModal);
  const availableDrives = useFilesystemStore((s) => s.availableDrives);
  const quickFolders = useFilesystemStore((s) => s.quickFolders);
  const loadAvailableDrives = useFilesystemStore((s) => s.loadAvailableDrives);
  const loadQuickFolders = useFilesystemStore((s) => s.loadQuickFolders);
  const scanDrive = useFilesystemStore((s) => s.scanDrive);
  const scanPath = useFilesystemStore((s) => s.scanPath);
  const selectAndScanDirectory = useFilesystemStore((s) => s.selectAndScanDirectory);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [customPath, setCustomPath] = useState('');
  const [activeTab, setActiveTab] = useState<'quick' | 'drives' | 'custom' | 'browser'>('quick');

  useEffect(() => {
    if (isOpen) {
      loadAvailableDrives();
      loadQuickFolders();
    }
  }, [isOpen, loadAvailableDrives, loadQuickFolders]);

  if (!isOpen) return null;

  const handleCustomPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPath.trim()) return;
    scanPath(customPath.trim(), customPath.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Choose Location to Scan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct access to Downloads, user folders, and physical drives
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Security Notice Callout (Explains why Downloads is blocked in Chrome) */}
        <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[11px] leading-tight">
            <strong>Downloads or C: blocked?</strong> Chrome and Edge restrict the browser folder picker from opening <strong>Downloads</strong> and <strong>C:\</strong>. Use the 1-click buttons below to scan them unrestricted!
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('quick')}
            className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'quick'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4 text-blue-500" />
            <span>Quick Folders (Downloads, etc.)</span>
          </button>

          <button
            onClick={() => setActiveTab('drives')}
            className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'drives'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-4 h-4 text-indigo-500" />
            <span>Physical Drives ({availableDrives.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-emerald-500" />
            <span>Enter Path</span>
          </button>

          <button
            onClick={() => setActiveTab('browser')}
            className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'browser'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <span>Browser Picker</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: Quick System Folders */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select User Directory
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bypasses system file restrictions</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickFolders.map((qf) => {
                  const Icon = ICON_MAP[qf.icon] || FolderOpen;
                  const isDownloads = qf.id === 'downloads';

                  return (
                    <div
                      key={qf.id}
                      onClick={() => scanPath(qf.path, qf.name)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group shadow-xs ${
                        isDownloads
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 hover:border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isDownloads
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                              {qf.name}
                            </span>
                            {isDownloads && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider">
                                Direct
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                            {qf.itemCount !== undefined ? `${qf.itemCount} items` : 'Ready to scan'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 group-hover:bg-blue-600 group-hover:text-white text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <span>Scan</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Physical Drives */}
          {activeTab === 'drives' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Detected Physical Disks
              </span>

              <div className="grid grid-cols-1 gap-3">
                {availableDrives.map((drive) => {
                  const usedPercent = drive.totalSize > 0
                    ? ((drive.totalSize - drive.freeSpace) / drive.totalSize) * 100
                    : 0;

                  return (
                    <div
                      key={drive.id}
                      onClick={() => scanDrive(drive)}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between group shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                            {drive.id}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 block">
                              {drive.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {drive.volumeName ? `${drive.volumeName} • ` : ''}
                              {formatBytes(drive.freeSpace, displayUnits)} free of {formatBytes(drive.totalSize, displayUnits)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <span>Scan {drive.id}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            usedPercent > 90 ? 'bg-rose-500' : usedPercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, usedPercent))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Enter Custom Path */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Enter Custom Directory Path
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type or paste any path on your machine (e.g. <code>C:\Users\Aniket\Downloads</code> or <code>D:\Projects</code>).
                </p>
              </div>

              <form onSubmit={handleCustomPathSubmit} className="space-y-3">
                <div className="relative">
                  <FolderSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="e.g. C:\Users\Aniket\Downloads"
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={!customPath.trim()}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all"
                >
                  Scan Path via Companion Engine
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: Browser Dialog */}
          {activeTab === 'browser' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Native Browser Folder Picker
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Uses the web standard <code>showDirectoryPicker</code> API. Ideal for isolated project workspaces.
                </p>
              </div>

              <div
                onClick={() => selectAndScanDirectory()}
                className="p-5 rounded-2xl bg-white dark:bg-[#0f172a] border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Open Browser File Picker
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Select non-system folders (e.g. within Documents or Desktop)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  Select Folder
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-xs">
                ⚠️ If the browser displays <em>&ldquo;can&apos;t open this folder because it contains system files&rdquo;</em>, switch to the <strong>Quick Folders</strong> tab to scan Downloads or user folders directly.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
