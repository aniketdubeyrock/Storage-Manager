export type ThemeMode = 'light' | 'dark' | 'system';
export type DisplayUnit = 'binary' | 'decimal'; // 'binary' = KiB/MiB/GiB (1024), 'decimal' = KB/MB/GB (1000)
export type DefaultViewMode = 'list' | 'grid';

export interface ConfirmationPreferences {
  confirmDelete: boolean;
  confirmPermanentDelete: boolean;
  confirmMove: boolean;
  confirmEmptyTrash: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  displayUnits: DisplayUnit;
  defaultView: DefaultViewMode;
  confirmations: ConfirmationPreferences;
  pageSize: number;
  autoRestoreDirectory: boolean;
  developerMode: boolean;
}

