import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileType,
  Image,
  Film,
  Music,
  FileText,
  Archive,
  Code,
  Package,
  HelpCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useFileManagerStore } from '../stores/fileManager.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes, formatNumber } from '../utils/formatters';
import type { FileCategory, CategoryBreakdown } from '../types/analytics.types';

const CATEGORY_ICONS: Record<FileCategory, React.ElementType> = {
  images: Image,
  videos: Film,
  audio: Music,
  documents: FileText,
  archives: Archive,
  code: Code,
  applications: Package,
  other: HelpCircle,
};

export const FileTypesPage: React.FC = () => {
  const navigate = useNavigate();
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const setCategoryFilter = useFileManagerStore((s) => s.setCategoryFilter);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [activeCategory, setActiveCategory] = useState<FileCategory>('images');

  if (!rootFolder || !analysisReport) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <FileType className="w-12 h-12 mb-3 text-slate-300" />
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">
          No File Type Data
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Scan a folder to analyze storage breakdown across file extensions and types.
        </p>
      </div>
    );
  }

  const { categories, extensionStats } = analysisReport;
  const currentCategoryData = categories.find((c) => c.category === activeCategory) || categories[0];

  const handleOpenCategoryInExplorer = (cat: FileCategory) => {
    setCategoryFilter(cat);
    navigate('/files');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileType className="w-5 h-5 text-blue-500" />
          <span>File Type Analysis</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Breakdown of scanned storage by media, document, and binary types
        </p>
      </div>

      {/* 8 Category Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.category] || HelpCircle;
          const isSelected = activeCategory === cat.category;

          return (
            <div
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                  : 'bg-white dark:bg-[#141e33] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {cat.label}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatNumber(cat.count)} {cat.count === 1 ? 'file' : 'files'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {formatBytes(cat.size, displayUnits)}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                  <span>Inspect</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Category Deep Breakdown */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Extensions in &ldquo;{currentCategoryData.label}&rdquo;
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Specific file formats contributing to this category
            </p>
          </div>
          <button
            onClick={() => handleOpenCategoryInExplorer(currentCategoryData.category)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Explorer</span>
          </button>
        </div>

        {currentCategoryData.extensions.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No files detected in this category.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">File Extension</th>
                  <th className="py-2.5 px-3 text-right">File Count</th>
                  <th className="py-2.5 px-3 text-right">Total Storage</th>
                  <th className="py-2.5 px-3 w-40 text-right">% of Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {currentCategoryData.extensions.map((ext) => {
                  const percentOfCategory =
                    currentCategoryData.size > 0
                      ? (ext.size / currentCategoryData.size) * 100
                      : 0;

                  return (
                    <tr key={ext.extension} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        .{ext.extension}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {formatNumber(ext.count)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatBytes(ext.size, displayUnits)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(3, percentOfCategory))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 w-10 text-right">
                            {percentOfCategory.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

