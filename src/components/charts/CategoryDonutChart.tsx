import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryBreakdown } from '../../types/analytics.types';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';

interface CategoryDonutChartProps {
  categories: CategoryBreakdown[];
  totalSize: number;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  categories,
  totalSize,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const activeCategories = categories.filter((c) => c.size > 0);

  if (activeCategories.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No scanned files available
      </div>
    );
  }

  const chartData = activeCategories.map((c) => ({
    name: c.label,
    value: c.size,
    count: c.count,
    color: c.color,
    percentage: c.percentage.toFixed(1),
  }));

  return (
    <div className="w-full flex flex-col md:flex-row items-center gap-6">
      <div className="w-full md:w-1/2 h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="p-3 bg-slate-900/95 text-white rounded-xl shadow-xl text-xs border border-slate-700 backdrop-blur-md">
                      <p className="font-bold flex items-center gap-2 mb-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: data.color }}
                        />
                        {data.name}
                      </p>
                      <p className="text-slate-300">
                        Size: <span className="font-semibold text-white">{formatBytes(data.value, displayUnits)}</span> ({data.percentage}%)
                      </p>
                      <p className="text-slate-400">{data.count} files</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center Total Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400">Total Scanned</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {formatBytes(totalSize, displayUnits)}
          </span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="w-full md:w-1/2 grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="truncate flex-1">
              <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                {item.name}
              </span>
              <span className="text-[11px] text-slate-400">
                {item.percentage}% ({formatBytes(item.value, displayUnits)})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

