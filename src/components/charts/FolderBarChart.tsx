import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { FolderNode } from '../../types/filesystem.types';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';

interface FolderBarChartProps {
  folders: FolderNode[];
  onFolderClick?: (path: string) => void;
}

export const FolderBarChart: React.FC<FolderBarChartProps> = ({ folders, onFolderClick }) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const topFolders = folders
    .filter((f) => f.path !== '/' && f.totalSize > 0)
    .slice(0, 8)
    .map((f) => ({
      name: f.name,
      path: f.path,
      size: f.totalSize,
      fileCount: f.fileCount,
    }));

  if (topFolders.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No subfolders found
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topFolders}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(val) => formatBytes(val, displayUnits, 0)}
            stroke="#94a3b8"
            fontSize={11}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#94a3b8"
            fontSize={11}
            width={90}
            tick={{ fill: 'currentColor' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="p-2.5 bg-slate-900/95 text-white rounded-xl shadow-xl text-xs border border-slate-700">
                    <p className="font-bold text-blue-400 mb-1">{data.name}</p>
                    <p className="text-slate-300">
                      Total: <span className="font-semibold text-white">{formatBytes(data.size, displayUnits)}</span>
                    </p>
                    <p className="text-slate-400">{data.fileCount} files contained</p>
                    <p className="text-[10px] text-slate-400 mt-1 italic">Click to inspect in explorer</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="size"
            fill="#3B82F6"
            radius={[0, 6, 6, 0]}
            onClick={(entry) => {
              if (entry && typeof entry === 'object' && 'path' in entry && entry.path && onFolderClick) {
                onFolderClick(String(entry.path));
              }
            }}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
