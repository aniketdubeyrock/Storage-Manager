import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, ThemeMode, DisplayUnit, DefaultViewMode, ConfirmationPreferences } from '../types/settings.types';

interface SettingsState extends AppSettings {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setDisplayUnits: (units: DisplayUnit) => void;
  setDefaultView: (view: DefaultViewMode) => void;
  setConfirmation: <K extends keyof ConfirmationPreferences>(key: K, value: boolean) => void;
  resetDefaults: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark', // Modern desktop dark-first
  displayUnits: 'binary',
  defaultView: 'list',
  confirmations: {
    confirmDelete: true,
    confirmPermanentDelete: true,
    confirmMove: true,
    confirmEmptyTrash: true,
  },
  pageSize: 50,
  autoRestoreDirectory: true,
  developerMode: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setTheme: (theme) => {
        set({ theme });
        applyThemeClass(theme);
      },

      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyThemeClass(next);
      },

      setDisplayUnits: (displayUnits) => set({ displayUnits }),

      setDefaultView: (defaultView) => set({ defaultView }),

      setConfirmation: (key, value) => {
        set((state) => ({
          confirmations: {
            ...state.confirmations,
            [key]: value,
          },
        }));
      },

      resetDefaults: () => {
        set({ ...defaultSettings });
        applyThemeClass(defaultSettings.theme);
      },
    }),
    {
      name: 'storage_manager_settings',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeClass(state.theme);
        }
      },
    }
  )
);

function applyThemeClass(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } else if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

