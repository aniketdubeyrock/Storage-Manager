/**
 * Normalizes filesystem path representations to use forward slashes,
 * leading slash, and no trailing slash (unless root).
 */
export function normalizePath(path: string): string {
  if (!path || path === '/' || path === '.') return '/';
  // Replace backslashes with forward slashes
  let clean = path.replace(/\\+/g, '/').trim();
  // Ensure leading slash
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  // Strip trailing slashes
  while (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  // Remove redundant double slashes
  clean = clean.replace(/\/+/g, '/');
  return clean;
}

export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalized.substring(0, lastSlash);
}

export function getBaseName(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  const lastSlash = normalized.lastIndexOf('/');
  return normalized.substring(lastSlash + 1);
}

export function splitPath(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === '/') return [];
  return normalized.split('/').filter(Boolean);
}

export function joinPath(...segments: string[]): string {
  const joined = segments.filter(Boolean).join('/');
  return normalizePath(joined);
}

/**
 * Checks whether `childPath` is nested inside `parentPath`.
 * Used for cycle prevention during folder moves.
 */
export function isDescendantOf(childPath: string, parentPath: string): boolean {
  const normChild = normalizePath(childPath);
  const normParent = normalizePath(parentPath);
  if (normParent === '/') return normChild !== '/';
  if (normChild === normParent) return false;
  return normChild.startsWith(normParent + '/');
}

