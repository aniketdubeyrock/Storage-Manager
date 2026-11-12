import type { FileCategory } from '../../types/analytics.types';

const CATEGORY_EXTENSIONS: Record<FileCategory, string[]> = {
  images: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'heic'
  ],
  videos: [
    'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'm2ts', 'mts'
  ],
  audio: [
    'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'
  ],
  documents: [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt',
    'ods', 'odp', 'csv', 'tsv', 'md', 'epub'
  ],
  archives: [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz'
  ],
  code: [
    'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'json',
    'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb',
    'sh', 'bat', 'ps1', 'sql', 'xml', 'yaml', 'yml', 'toml', 'env', 'prisma'
  ],
  applications: [
    'exe', 'msi', 'dmg', 'pkg', 'app', 'deb', 'rpm', 'apk', 'jar'
  ],
  other: [],
};

const CATEGORY_COLORS: Record<FileCategory, string> = {
  images: '#3B82F6', // Blue
  videos: '#8B5CF6', // Purple
  audio: '#EC4899', // Pink
  documents: '#10B981', // Emerald
  archives: '#F59E0B', // Amber
  code: '#06B6D4', // Cyan
  applications: '#EF4444', // Red
  other: '#6B7280', // Gray
};

const CATEGORY_LABELS: Record<FileCategory, string> = {
  images: 'Images',
  videos: 'Videos',
  audio: 'Audio',
  documents: 'Documents',
  archives: 'Archives',
  code: 'Code & Scripts',
  applications: 'Applications',
  other: 'Other Files',
};

// Common MIME lookup fallback
const EXTENSION_MIMES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/typescript',
};

export function extractExtension(filename: string): string {
  if (!filename || !filename.includes('.')) return '';
  const parts = filename.split('.');
  const ext = parts[parts.length - 1];
  return ext.toLowerCase().trim();
}

export function detectCategory(extensionOrName: string): FileCategory {
  const ext = extractExtension(extensionOrName) || extensionOrName.toLowerCase();
  for (const [cat, extensions] of Object.entries(CATEGORY_EXTENSIONS) as [FileCategory, string[]][]) {
    if (extensions.includes(ext)) {
      return cat;
    }
  }
  return 'other';
}

export function getCategoryColor(category: FileCategory): string {
  return CATEGORY_COLORS[category] || '#6B7280';
}

export function getCategoryLabel(category: FileCategory): string {
  return CATEGORY_LABELS[category] || 'Other Files';
}

export function getMimeType(filename: string, systemMime?: string): string {
  if (systemMime && systemMime.length > 0) return systemMime;
  const ext = extractExtension(filename);
  return EXTENSION_MIMES[ext] || 'application/octet-stream';
}

export function isPreviewable(filename: string, mime?: string): {
  type: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';
  canPreview: boolean;
} {
  const ext = extractExtension(filename);
  const category = detectCategory(ext);

  if (category === 'images') return { type: 'image', canPreview: true };
  if (category === 'videos' && ['mp4', 'webm', 'mov'].includes(ext)) return { type: 'video', canPreview: true };
  if (category === 'audio') return { type: 'audio', canPreview: true };
  if (ext === 'pdf') return { type: 'pdf', canPreview: true };
  if (category === 'code' || ['txt', 'md', 'json', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'env', 'log'].includes(ext)) {
    return { type: 'text', canPreview: true };
  }

  return { type: 'none', canPreview: false };
}

export type ViewerMode =
  | 'image'
  | 'pdf'
  | 'table'
  | 'markdown'
  | 'code'
  | 'video'
  | 'audio'
  | 'office'
  | 'hex';

export interface ViewerModeOption {
  mode: ViewerMode;
  label: string;
  iconName: string;
}

export interface ViewerCapabilities {
  defaultMode: ViewerMode;
  supportedModes: ViewerModeOption[];
  category: FileCategory;
  extension: string;
}

export function getViewerCapabilities(filename: string, _mime?: string): ViewerCapabilities {
  const ext = extractExtension(filename);
  const category = detectCategory(ext);

  const hexOption: ViewerModeOption = { mode: 'hex', label: 'Hex Inspector', iconName: 'Binary' };
  const codeOption: ViewerModeOption = { mode: 'code', label: 'Code / Text', iconName: 'FileCode' };
  const imageOption: ViewerModeOption = { mode: 'image', label: 'Image Viewer', iconName: 'Image' };
  const pdfOption: ViewerModeOption = { mode: 'pdf', label: 'PDF Reader', iconName: 'FileText' };
  const tableOption: ViewerModeOption = { mode: 'table', label: 'Data Table', iconName: 'Table' };
  const mdOption: ViewerModeOption = { mode: 'markdown', label: 'Markdown', iconName: 'BookOpen' };
  const videoOption: ViewerModeOption = { mode: 'video', label: 'Video Player', iconName: 'Film' };
  const audioOption: ViewerModeOption = { mode: 'audio', label: 'Audio Player', iconName: 'Music' };
  const officeOption: ViewerModeOption = { mode: 'office', label: 'Document', iconName: 'FileText' };

  // CSV / TSV
  if (['csv', 'tsv'].includes(ext)) {
    return {
      defaultMode: 'table',
      supportedModes: [tableOption, codeOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Markdown
  if (['md', 'markdown'].includes(ext)) {
    return {
      defaultMode: 'markdown',
      supportedModes: [mdOption, codeOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Images
  if (category === 'images') {
    const modes: ViewerModeOption[] = [imageOption];
    if (ext === 'svg') modes.push(codeOption);
    modes.push(hexOption);
    return {
      defaultMode: 'image',
      supportedModes: modes,
      category,
      extension: ext,
    };
  }

  // PDF
  if (ext === 'pdf') {
    return {
      defaultMode: 'pdf',
      supportedModes: [pdfOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Office Docs (.docx, .xlsx, .pptx, etc.)
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'epub', 'rtf'].includes(ext)) {
    return {
      defaultMode: 'office',
      supportedModes: [officeOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Videos
  if (category === 'videos' || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) {
    return {
      defaultMode: 'video',
      supportedModes: [videoOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Audio
  if (category === 'audio' || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma', 'opus'].includes(ext)) {
    return {
      defaultMode: 'audio',
      supportedModes: [audioOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Code & text files
  if (
    category === 'code' ||
    ['txt', 'json', 'xml', 'yaml', 'yml', 'env', 'log', 'ini', 'toml', 'sql', 'sh', 'bat', 'ps1', 'css', 'html', 'js', 'ts', 'jsx', 'tsx'].includes(ext)
  ) {
    return {
      defaultMode: 'code',
      supportedModes: [codeOption, hexOption],
      category,
      extension: ext,
    };
  }

  // Fallback for everything else (binaries, zip, rar, exe, unknown)
  return {
    defaultMode: 'hex',
    supportedModes: [hexOption, codeOption],
    category,
    extension: ext,
  };
}
