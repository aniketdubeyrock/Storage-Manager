export type FsPermissionMode = 'read' | 'readwrite';

export interface HandlePermissionOptions {
  mode?: FsPermissionMode;
}

export async function verifyPermission(
  fileHandle: FileSystemHandle,
  readWrite: boolean = false
): Promise<boolean> {
  const options: HandlePermissionOptions = {
    mode: readWrite ? 'readwrite' : 'read',
  };

  try {
    // Check if permission was already granted
    // @ts-expect-error queryPermission is standard on FileSystemHandle in browser
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }

    // Request permission from the user
    // @ts-expect-error requestPermission is standard on FileSystemHandle in browser
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (err) {
    console.warn('Error querying/requesting filesystem permission:', err);
    return false;
  }

  return false;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
