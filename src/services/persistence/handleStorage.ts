import { getDatabase, type StoredDirectoryRecord } from './idbDatabase';

export type { StoredDirectoryRecord };

export async function saveDirectoryHandle(
  name: string,
  handle: FileSystemDirectoryHandle,
  meta?: { totalSize?: number; fileCount?: number }
): Promise<void> {
  try {
    const db = await getDatabase();
    const record: StoredDirectoryRecord = {
      id: name,
      name,
      handle,
      lastScannedAt: Date.now(),
      totalSize: meta?.totalSize,
      fileCount: meta?.fileCount,
    };
    await db.put('handles', record);
  } catch (err) {
    console.warn('Failed to save directory handle to IndexedDB:', err);
  }
}

export async function getStoredDirectoryHandle(name: string): Promise<StoredDirectoryRecord | undefined> {
  try {
    const db = await getDatabase();
    return await db.get('handles', name);
  } catch (err) {
    console.warn('Failed to get directory handle from IndexedDB:', err);
    return undefined;
  }
}

export async function listStoredDirectoryHandles(): Promise<StoredDirectoryRecord[]> {
  try {
    const db = await getDatabase();
    return await db.getAll('handles');
  } catch (err) {
    console.warn('Failed to list stored handles:', err);
    return [];
  }
}

export async function removeStoredDirectoryHandle(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.delete('handles', id);
  } catch (err) {
    console.warn('Failed to delete handle from IndexedDB:', err);
  }
}

export async function clearAllStoredData(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.clear('handles');
    await db.clear('scans');
    await db.clear('trash');
  } catch (err) {
    console.warn('Failed to clear stored data:', err);
  }
}
