import React from 'react';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  HardDrive,
  LayoutList,
  LayoutGrid,
  ShieldCheck,
  Trash2,
  Database,
  Check,
  CloudUpload,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settings.store';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useGoogleDriveStore } from '../stores/googleDrive.store';
import { clearAllStoredData } from '../services/persistence/handleStorage';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const defaultView = useSettingsStore((s) => s.defaultView);
  const setDefaultView = useSettingsStore((s) => s.setDefaultView);
  const confirmations = useSettingsStore((s) => s.confirmations);
  const setConfirmation = useSettingsStore((s) => s.setConfirmation);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);

  const storedDirectories = useFilesystemStore((s) => s.storedDirectories);
  const clearActiveScan = useFilesystemStore((s) => s.clearActiveScan);
  const loadStoredDirectories = useFilesystemStore((s) => s.loadStoredDirectories);

  // Google Drive configuration state
  const isSimulatedMode = useGoogleDriveStore((s) => s.isSimulatedMode);
  const setSimulatedMode = useGoogleDriveStore((s) => s.setSimulatedMode);
  const clientId = useGoogleDriveStore((s) => s.clientId);
  const setClientId = useGoogleDriveStore((s) => s.setClientId);
  const isConnected = useGoogleDriveStore((s) => s.isConnected);
  const connectGoogleDrive = useGoogleDriveStore((s) => s.connectGoogleDrive);
  const disconnectGoogleDrive = useGoogleDriveStore((s) => s.disconnectGoogleDrive);

  const [inputClientId, setInputClientId] = React.useState(clientId);

  const handleClearCache = async () => {
    if (window.confirm('Clear all stored directory authorizations, scan history, and trash records?')) {
      await clearAllStoredData();
      clearActiveScan();
      await loadStoredDirectories();
      toast.success('Stored application data cleared.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          <span>Application Settings</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Customize telemetry appearance, calculation units, safety guards, and local persistence
        </p>
      </div>

      {/* Appearance & Theme */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Appearance & Theme
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500" />
            <span>Light Mode</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-400" />
            <span>Dark Mode</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === 'system'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Laptop className="w-5 h-5 text-slate-400" />
            <span>System Default</span>
          </button>
        </div>
      </div>

      {/* Storage Capacity Units */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Storage Calculation Units
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose how byte sizes are calculated and formatted across the application
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setDisplayUnits('binary')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              displayUnits === 'binary'
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Binary (1024 base)
              </span>
              {displayUnits === 'binary' && <Check className="w-4 h-4 text-blue-500" />}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              KiB, MiB, GiB. Standard for Windows Explorer, RAM, and OS disk utilities.
            </p>
          </div>

          <div
            onClick={() => setDisplayUnits('decimal')}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              displayUnits === 'decimal'
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Decimal (1000 base)
              </span>
              {displayUnits === 'decimal' && <Check className="w-4 h-4 text-blue-500" />}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              KB, MB, GB. Standard for drive hardware manufacturers and macOS.
            </p>
          </div>
        </div>
      </div>

      {/* Default Explorer View */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
          Default Explorer Layout
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDefaultView('list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              defaultView === 'list'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>Table List View</span>
          </button>

          <button
            onClick={() => setDefaultView('grid')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              defaultView === 'grid'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Card Grid View</span>
          </button>
        </div>
      </div>

      {/* Safety & Confirmation Dialogs */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Safety & Destructive Guards
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure safety prompts to protect against accidental deletions
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={confirmations.confirmDelete}
              onChange={(e) => setConfirmation('confirmDelete', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Confirm moving files and folders to Application Trash
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={confirmations.confirmPermanentDelete}
              onChange={(e) => setConfirmation('confirmPermanentDelete', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Confirm permanent unrecoverable file deletions
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={confirmations.confirmEmptyTrash}
              onChange={(e) => setConfirmation('confirmEmptyTrash', e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Confirm emptying Application Trash
            </span>
          </label>
        </div>
      </div>

      {/* Google Drive Integration Configuration */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Google Drive Cloud Integration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect your Google account to backup local files with real-time transfer telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Mode:</span>
            <button
              onClick={() => setSimulatedMode(!isSimulatedMode)}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors"
            >
              {isSimulatedMode ? 'Demo / Simulation Mode' : 'Live Google OAuth'}
            </button>
          </div>
        </div>

        {isSimulatedMode ? (
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/80 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold block mb-0.5">Interactive Simulation Mode is Active</span>
              No Google credentials required. You can queue files from the File Manager or Largest Files tab, monitor live transfer speeds (MB/s), pause, resume, cancel, and track cloud quota seamlessly.
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Google Cloud OAuth 2.0 Client ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  onClick={() => {
                    setClientId(inputClientId);
                    toast.success('Client ID saved');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={async () => {
                    setClientId(inputClientId);
                    await connectGoogleDrive();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow transition-colors"
                >
                  {isConnected ? 'Reconnect Account' : 'Connect Account'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <span className="font-semibold block text-slate-800 dark:text-slate-200">
                Setup Instructions:
              </span>
              <p>1. Open <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google Cloud Console</a> and create or select a project.</p>
              <p>2. Enable <strong>Google Drive API</strong> in APIs & Services.</p>
              <p>3. Go to Credentials &rarr; Create Credentials &rarr; <strong>OAuth Client ID</strong> (Web Application).</p>
              <p>4. Set Authorized JavaScript origin to: <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">http://localhost:5173</code></p>
              <p>5. Copy your Client ID and paste it above.</p>
            </div>
          </div>
        )}
      </div>

      {/* Local Persistence & Reset */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span>IndexedDB Local Storage</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {storedDirectories.length} stored folder handle(s) in local browser database
            </p>
          </div>

          <button
            onClick={handleClearCache}
            className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Stored Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

