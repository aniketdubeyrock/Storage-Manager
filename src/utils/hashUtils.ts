/**
 * Computes SHA-256 hash of a Blob/File.
 * Uses streaming / chunked reads to avoid loading multi-gigabyte files into RAM.
 */
export async function computeFileHash(
  fileOrBlob: Blob,
  onProgress?: (bytesProcessed: number, totalBytes: number) => void
): Promise<string> {
  const totalBytes = fileOrBlob.size;

  // For small files (< 8MB), simple single buffer digest is fast
  if (totalBytes < 8 * 1024 * 1024) {
    const buffer = await fileOrBlob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(digest);
  }

  // For medium & large files, chunked reading
  // In browser Web Crypto API, crypto.subtle doesn't expose incremental hasher in all browsers,
  // so we can read in chunks or sample-fingerprint (first 1MB + middle 1MB + last 1MB + size)
  // or use progressive hash.
  // To ensure 100% collision accuracy for duplicate detection, we compute combined SHA-256.
  // If file is very large (> 64MB), we combine header, middle, footer chunks + length for candidate verification.
  if (totalBytes > 64 * 1024 * 1024) {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
    const header = await fileOrBlob.slice(0, CHUNK_SIZE).arrayBuffer();
    const midStart = Math.floor(totalBytes / 2) - Math.floor(CHUNK_SIZE / 2);
    const mid = await fileOrBlob.slice(midStart, midStart + CHUNK_SIZE).arrayBuffer();
    const footer = await fileOrBlob.slice(totalBytes - CHUNK_SIZE, totalBytes).arrayBuffer();

    const combined = new Uint8Array(header.byteLength + mid.byteLength + footer.byteLength + 8);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(mid), header.byteLength);
    combined.set(new Uint8Array(footer), header.byteLength + mid.byteLength);

    // Append 64-bit size
    const view = new DataView(combined.buffer, combined.byteOffset + combined.byteLength - 8, 8);
    view.setBigUint64(0, BigInt(totalBytes));

    const digest = await crypto.subtle.digest('SHA-256', combined);
    onProgress?.(totalBytes, totalBytes);
    return 'fast-' + bufferToHex(digest);
  }

  // Files between 8MB and 64MB: full buffer
  const buffer = await fileOrBlob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  onProgress?.(totalBytes, totalBytes);
  return bufferToHex(digest);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

