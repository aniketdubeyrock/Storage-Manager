import type {
  FolderNode,
  FileNode,
  ScanResultSummary,
} from '../../types/filesystem.types';
import type {
  CategoryBreakdown,
  FileCategory,
  SizeRangeBucket,
  ExtensionStat,
} from '../../types/analytics.types';
import {
  detectCategory,
  getCategoryColor,
  getCategoryLabel,
  extractExtension,
} from '../filesystem/fileTypeDetector';
import { flattenFiles, flattenFolders } from '../filesystem/directoryOperations';

export interface StorageAnalysisReport {
  summary: ScanResultSummary;
  categories: CategoryBreakdown[];
  largestFiles: FileNode[];
  largestFolders: FolderNode[];
  sizeDistribution: SizeRangeBucket[];
  extensionStats: ExtensionStat[];
  allFiles: FileNode[];
  allFolders: FolderNode[];
}

export function analyzeStorage(rootFolder: FolderNode, scanDurationMs = 0): StorageAnalysisReport {
  const allFiles = flattenFiles(rootFolder);
  const allFolders = flattenFolders(rootFolder);

  // 1. Sort Largest Files
  const sortedFiles = [...allFiles].sort((a, b) => b.size - a.size);
  const largestFile = sortedFiles.length > 0 ? sortedFiles[0] : null;

  // 2. Sort Largest Folders
  const sortedFolders = [...allFolders].sort((a, b) => b.totalSize - a.totalSize);
  const largestFolder = sortedFolders.length > 0 ? sortedFolders[0] : null;

  // 3. Category Breakdown & Extension breakdown
  const categoryMap = new Map<
    FileCategory,
    { size: number; count: number; extMap: Map<string, { size: number; count: number }> }
  >();

  const allCategories: FileCategory[] = [
    'images',
    'videos',
    'audio',
    'documents',
    'archives',
    'code',
    'applications',
    'other',
  ];

  for (const cat of allCategories) {
    categoryMap.set(cat, { size: 0, count: 0, extMap: new Map() });
  }

  const globalExtMap = new Map<string, { size: number; count: number }>();

  for (const file of allFiles) {
    const ext = file.extension || 'none';
    const cat = detectCategory(ext);

    // Global extensions
    const gExt = globalExtMap.get(ext) || { size: 0, count: 0 };
    gExt.size += file.size;
    gExt.count += 1;
    globalExtMap.set(ext, gExt);

    // Category breakdown
    const catEntry = categoryMap.get(cat)!;
    catEntry.size += file.size;
    catEntry.count += 1;

    const catExt = catEntry.extMap.get(ext) || { size: 0, count: 0 };
    catExt.size += file.size;
    catExt.count += 1;
    catEntry.extMap.set(ext, catExt);
  }

  const rootSize = rootFolder.totalSize || 1; // avoid divide by zero

  const categories: CategoryBreakdown[] = allCategories.map((cat) => {
    const entry = categoryMap.get(cat)!;
    const extensions: ExtensionStat[] = Array.from(entry.extMap.entries())
      .map(([extension, stat]) => ({
        extension,
        size: stat.size,
        count: stat.count,
      }))
      .sort((a, b) => b.size - a.size);

    return {
      category: cat,
      label: getCategoryLabel(cat),
      color: getCategoryColor(cat),
      size: entry.size,
      count: entry.count,
      percentage: rootFolder.totalSize > 0 ? (entry.size / rootSize) * 100 : 0,
      extensions,
    };
  });

  // 4. Size Distribution Buckets
  const sizeBuckets: SizeRangeBucket[] = [
    { id: 'tiny', label: '< 1 MB', min: 0, max: 1024 * 1024, count: 0, totalSize: 0 },
    { id: 'small', label: '1 - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024, count: 0, totalSize: 0 },
    { id: 'medium', label: '10 - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024, count: 0, totalSize: 0 },
    { id: 'large', label: '100 MB - 1 GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024, count: 0, totalSize: 0 },
    { id: 'huge', label: '> 1 GB', min: 1024 * 1024 * 1024, max: Infinity, count: 0, totalSize: 0 },
  ];

  for (const file of allFiles) {
    for (const bucket of sizeBuckets) {
      if (file.size >= bucket.min && file.size < bucket.max) {
        bucket.count++;
        bucket.totalSize += file.size;
        break;
      }
    }
  }

  // Top global extensions
  const extensionStats: ExtensionStat[] = Array.from(globalExtMap.entries())
    .map(([extension, stat]) => ({
      extension,
      size: stat.size,
      count: stat.count,
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  const summary: ScanResultSummary = {
    rootName: rootFolder.name,
    totalSize: rootFolder.totalSize,
    fileCount: rootFolder.fileCount,
    folderCount: rootFolder.folderCount,
    largestFile,
    largestFolder,
    scannedAt: Date.now(),
    durationMs: scanDurationMs,
  };

  return {
    summary,
    categories,
    largestFiles: sortedFiles,
    largestFolders: sortedFolders,
    sizeDistribution: sizeBuckets,
    extensionStats,
    allFiles,
    allFolders,
  };
}

