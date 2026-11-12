import type { FileNode, FolderNode } from './filesystem.types';

export type FileCategory =
  | 'images'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'archives'
  | 'code'
  | 'applications'
  | 'other';

export interface ExtensionStat {
  extension: string;
  count: number;
  size: number;
}

export interface CategoryBreakdown {
  category: FileCategory;
  label: string;
  color: string;
  size: number;
  count: number;
  percentage: number;
  extensions: ExtensionStat[];
}

export interface DuplicateGroup {
  id: string; // usually size + '-' + hash
  size: number;
  hash: string;
  files: FileNode[];
  reclaimableSize: number; // (files.length - 1) * size
}

export interface TreemapItem {
  id: string;
  name: string;
  path: string;
  size: number;
  kind: 'file' | 'directory';
  children?: TreemapItem[];
  color?: string;
}

export interface SizeRangeBucket {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
  totalSize: number;
}

