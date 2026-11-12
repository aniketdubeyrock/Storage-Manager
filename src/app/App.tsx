import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { FolderPickerModal } from '../components/dialogs/FolderPickerModal';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useTrashStore } from '../stores/trash.store';
import { useSettingsStore } from '../stores/settings.store';

export const App: React.FC = () => {
  const loadStoredDirectories = useFilesystemStore((s) => s.loadStoredDirectories);
  const loadTrash = useTrashStore((s) => s.loadTrash);
  const theme = useSettingsStore((s) => s.theme);

  // Synchronize <html> root class for flawless dark/light mode compatibility
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    loadStoredDirectories();
    loadTrash();
  }, [loadStoredDirectories, loadTrash]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-[#0f172a] dark:text-[#f8fafc] transition-colors duration-200">
      {/* Desktop/Tablet Sidebar */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Drive and Folder Picker Modal */}
      <FolderPickerModal />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'text-xs font-semibold rounded-2xl shadow-xl dark:bg-slate-800 dark:text-white',
          duration: 3500,
        }}
      />
    </div>
  );
};

export default App;
