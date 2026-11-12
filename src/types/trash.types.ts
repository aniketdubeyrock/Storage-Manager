export interface TrashItem {
  id: string;
  name: string;
  originalPath: string; // e.g. "/Documents/Projects/old_spec.pdf"
  parentPath: string; // e.g. "/Documents/Projects"
  size: number;
  extension: string;
  mimeType: string;
  deletedAt: number;
  isDirectory: boolean;
  contentDataUrl?: string; // In-memory / IDB cached content for small files if moved
  trashedPath?: string; // Internal path in .storage_manager_trash if stored there
  restorePath?: string;
}

export interface TrashProvider {
  add(item: Omit<TrashItem, 'id' | 'deletedAt'>, fileData?: Blob): Promise<TrashItem>;
  restore(id: string): Promise<boolean>;
  removePermanently(id: string): Promise<boolean>;
  list(): Promise<TrashItem[]>;
  empty(): Promise<number>;
  getItem(id: string): Promise<TrashItem | undefined>;
}
