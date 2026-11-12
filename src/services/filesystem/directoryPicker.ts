import { verifyPermission, isFileSystemAccessSupported } from './permissionManager';

export async function pickDirectory(
  mode: 'read' | 'readwrite' = 'read'
): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'The File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera on desktop.'
    );
  }

  try {
    // Requesting 'read' allows broader folder access without triggering Chromium system directory blocks
    // @ts-expect-error showDirectoryPicker exists in supported browsers
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      mode,
      startIn: 'documents',
    });

    const hasPermission = await verifyPermission(handle, mode === 'readwrite');
    if (!hasPermission) {
      throw new Error('Permission to access directory was denied by the user.');
    }

    return handle;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // User cancelled picker dialog
      return null;
    }
    if (err instanceof DOMException && err.name === 'SecurityError') {
      throw new Error(
        'Chromium prevents selecting root system drives or sensitive folders via the browser picker. Please select the drive from the "Physical Drives" section instead!'
      );
    }
    throw err;
  }
}
