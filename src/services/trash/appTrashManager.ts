import { getDatabase } from '../persistence/idbDatabase';
import type { TrashItem, TrashProvider } from '../../types/trash.types';
import type { FileNode, FolderNode } from '../../types/filesystem.types';
import { readFileAsBlob } from '../filesystem/fileReader';
import { deleteEntry } from '../filesystem/fileDeleter';
import { getDirectoryHandleByPath } from '../filesystem/directoryOperations';
import { createFileInDirectory } from '../filesystem/fileWriter';
import { getParentPath, getBaseName, normalizePath } from '../../utils/pathUtils';

export class AppTrashManager implements TrashProvider {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  public setRootHandle(handle: FileSystemDirectoryHandle | null) {
    this.rootHandle = handle;
  }

  public async add(
    itemData: Omit<TrashItem, 'id' | 'deletedAt'>,
    fileBlob?: Blob
  ): Promise<TrashItem> {
    const db = await getDatabase();
    const id = `trash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const trashItem: TrashItem & { blob?: Blob } = {
      ...itemData,
      id,
      deletedAt: Date.now(),
      blob: fileBlob,
    };

    await db.put('trash', trashItem);
    return trashItem;
  }

  /**
   * Helper that takes an active FileNode, caches its content in IDB, deletes the original file,
   * and records it in trash. Works in both browser handle mode and companion mode.
   */
  public async trashFile(fileNode: FileNode): Promise<TrashItem> {
    let blob: Blob | undefined;
    if (fileNode.handle && fileNode.size < 50 * 1024 * 1024) {
      // Cache blob from handle for restoration
      try {
        blob = await readFileAsBlob(fileNode.handle);
      } catch (err) {
        console.warn('Could not read file blob for trash cache:', err);
      }
    } else if (!this.rootHandle && fileNode.size < 50 * 1024 * 1024) {
      // Companion mode: fetch blob via companion file stream
      try {
        const res = await fetch(`/api/system/stream-file?path=${encodeURIComponent(fileNode.path)}`);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch (err) {
        console.warn('Could not cache file blob from companion:', err);
      }
    }

    // Record in trash ledger
    const trashItem = await this.add(
      {
        name: fileNode.name,
        originalPath: fileNode.path,
        parentPath: fileNode.parentPath,
        size: fileNode.size,
        extension: fileNode.extension,
        mimeType: fileNode.mimeType,
        isDirectory: false,
        restorePath: fileNode.path,
      },
      blob
    );

    // Remove from active filesystem (supports both rootHandle and companion API)
    const delRes = await deleteEntry(this.rootHandle, fileNode.path, false);
    if (!delRes.success) {
      // Rollback trash entry if delete failed
      await this.removePermanently(trashItem.id);
      throw new Error(`Failed to remove file from original location: ${delRes.error}`);
    }

    return trashItem;
  }

  /**
   * Helper that trashes an entire folder. Works in both browser handle mode and companion mode.
   */
  public async trashFolder(folderNode: FolderNode): Promise<TrashItem> {
    const trashItem = await this.add({
      name: folderNode.name,
      originalPath: folderNode.path,
      parentPath: folderNode.parentPath,
      size: folderNode.totalSize,
      extension: '',
      mimeType: 'inode/directory',
      isDirectory: true,
      restorePath: folderNode.path,
    });

    const delRes = await deleteEntry(this.rootHandle, folderNode.path, true);
    if (!delRes.success) {
      await this.removePermanently(trashItem.id);
      throw new Error(`Failed to remove folder: ${delRes.error}`);
    }

    return trashItem;
  }

  public async restore(id: string): Promise<boolean> {
    const db = await getDatabase();
    const item = await db.get('trash', id);
    if (!item) {
      throw new Error('Item not found in trash.');
    }

    if (!this.rootHandle) {
      throw new Error('Cannot restore without an active root directory handle.');
    }

    try {
      const parentPath = getParentPath(item.originalPath);
      const fileName = getBaseName(item.originalPath);

      // Ensure target parent directory exists
      const parentDirHandle = await getDirectoryHandleByPath(this.rootHandle, parentPath, true);

      if (item.isDirectory) {
        // Recreate directory
        await parentDirHandle.getDirectoryHandle(fileName, { create: true });
      } else {
        // Recreate file
        const blobToRestore = item.blob || new Blob([], { type: item.mimeType });
        await createFileInDirectory(parentDirHandle, fileName, blobToRestore);
      }

      // Remove from trash store
      await db.delete('trash', id);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore item';
      throw new Error(msg);
    }
  }

  public async removePermanently(id: string): Promise<boolean> {
    const db = await getDatabase();
    await db.delete('trash', id);
    return true;
  }

  public async list(): Promise<TrashItem[]> {
    const db = await getDatabase();
    const records = await db.getAllFromIndex('trash', 'by-date');
    // Strip heavy blobs from returned list for memory efficiency
    return records.map((r) => {
      const { blob, ...rest } = r;
      return rest;
    });
  }

  public async getItem(id: string): Promise<TrashItem | undefined> {
    const db = await getDatabase();
    const item = await db.get('trash', id);
    if (!item) return undefined;
    const { blob, ...rest } = item;
    return rest;
  }

  public async empty(): Promise<number> {
    const db = await getDatabase();
    const all = await db.getAll('trash');
    const count = all.length;
    await db.clear('trash');
    return count;
  }
}

export const appTrashManager = new AppTrashManager();

