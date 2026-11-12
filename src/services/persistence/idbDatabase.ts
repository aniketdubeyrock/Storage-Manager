import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TrashItem } from '../../types/trash.types';
import type { ScanResultSummary } from '../../types/filesystem.types';

export interface StoredDirectoryRecord {
  id: string; // usually directory name or unique path
  name: string;
  handle: FileSystemDirectoryHandle;
  lastScannedAt?: number;
  totalSize?: number;
  fileCount?: number;
}

export interface StorageManagerDB extends DBSchema {
  handles: {
    key: string;
    value: StoredDirectoryRecord;
  };
  scans: {
    key: string;
    value: ScanResultSummary;
    indexes: { 'by-date': number };
  };
  trash: {
    key: string;
    value: TrashItem & { blob?: Blob };
    indexes: { 'by-date': number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'storage_manager_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StorageManagerDB>> | null = null;

export async function getDatabase(): Promise<IDBPDatabase<StorageManagerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StorageManagerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scans')) {
          const scanStore = db.createObjectStore('scans', { keyPath: 'rootName' });
          scanStore.createIndex('by-date', 'scannedAt');
        }
        if (!db.objectStoreNames.contains('trash')) {
          const trashStore = db.createObjectStore('trash', { keyPath: 'id' });
          trashStore.createIndex('by-date', 'deletedAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

