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
import type { SizeRangeBucket } from '../../types/analytics.types';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';

interface SizeDistributionChartProps {
  buckets: SizeRangeBucket[];
}

export const SizeDistributionChart: React.FC<SizeDistributionChartProps> = ({ buckets }) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as SizeRangeBucket;
                return (
                  <div className="p-3 bg-slate-900/95 text-white rounded-xl shadow-xl text-xs border border-slate-700">
                    <p className="font-bold text-blue-400 mb-1">{data.label}</p>
                    <p className="text-slate-300">
                      File count: <span className="font-semibold text-white">{formatNumber(data.count)}</span>
                    </p>
                    <p className="text-slate-400">
                      Total capacity: {formatBytes(data.totalSize, displayUnits)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

