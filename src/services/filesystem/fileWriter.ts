/**
 * Safely writes contents to a FileSystemFileHandle using a writable stream.
 */
export async function writeFileContents(
  fileHandle: FileSystemFileHandle,
  data: Blob | ArrayBuffer | string
): Promise<void> {
  const writable = await (fileHandle as any).createWritable();
  try {
    await writable.write(data);
  } finally {
    await writable.close();
  }
}

/**
 * Creates or overwrites a file in the given parent directory handle.
 */
export async function createFileInDirectory(
  parentHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: Blob | ArrayBuffer | string
): Promise<FileSystemFileHandle> {
  const fileHandle = await parentHandle.getFileHandle(fileName, { create: true });
  await writeFileContents(fileHandle, data);
  return fileHandle;
}
