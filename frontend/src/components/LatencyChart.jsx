import React, { useState } from 'react';
import { Clock, Zap, Activity, Info } from 'lucide-react';

export default function LatencyChart({ services = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!services || services.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No latency metrics available.
      </div>
    );
  }

  // Find max latency for scaling
  const maxLat = Math.max(...services.map((s) => s.p95_latency_ms || s.avg_latency_ms || 200), 200);
  const ceilVal = Math.ceil((maxLat * 1.25) / 100) * 100;

  // Chart dimensions
  const width = 800;
  const height = 290;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 55;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getY = (val) => padTop + chartH - ((val || 0) / ceilVal) * chartH;

  const barW = Math.min(26, Math.floor((chartW / services.length) * 0.22));
  const slotW = chartW / services.length;

  const yTicks = [0, Math.round(ceilVal / 4), Math.round(ceilVal / 2), Math.round((ceilVal * 3) / 4), ceilVal];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Response Latency Benchmark (P95 Tail vs Average)
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            P95 isolates latency spikes experienced by the slowest 5% of requests. Lower is better.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-sky-500 shadow-2xs" />
            <span className="text-slate-700">Average Latency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-indigo-600 shadow-2xs" />
            <span className="text-slate-700">P95 Tail Latency</span>
          </div>
        </div>
      </div>

      {/* SVG Grouped Column Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[320px] select-none"
        >
          <defs>
            <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>

            <filter id="barShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Horizontal Gridlines */}
          {yTicks.map((tick) => {
            const yPos = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-slate-400 font-bold"
                >
                  {tick}ms
                </text>
              </g>
            );
          })}

          {/* Grouped Bars per Service */}
          {services.map((svc, idx) => {
            const cx = padLeft + (idx + 0.5) * slotW;
            const avgY = getY(svc.avg_latency_ms);
            const avgH = padTop + chartH - avgY;

            const p95Y = getY(svc.p95_latency_ms);
            const p95H = padTop + chartH - p95Y;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={svc.service_id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Column background hover highlight */}
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.6)' : 'transparent'}
                  rx="6"
                  className="transition-colors duration-150"
                />

                {/* Avg Bar (Left) */}
                <rect
                  x={cx - barW - 2}
                  y={avgY}
                  width={barW}
                  height={Math.max(3, avgH)}
                  rx="4"
                  fill="url(#avgGrad)"
                  filter="url(#barShadow)"
                  className="transition-all duration-300"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.6}
                />
                {/* Avg Value Label */}
                <text
                  x={cx - barW / 2 - 2}
                  y={avgY - 6}
                  textAnchor="middle"
                  className="text-[10px] font-mono font-bold fill-sky-700"
                >
                  {svc.avg_latency_ms !== null ? `${Math.round(svc.avg_latency_ms)}` : '-'}
                </text>

                {/* P95 Bar (Right) */}
                <rect
                  x={cx + 2}
                  y={p95Y}
                  width={barW}
                  height={Math.max(3, p95H)}
                  rx="4"
                  fill="url(#p95Grad)"
                  filter="url(#barShadow)"
                  className="transition-all duration-300"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.6}
                />
                {/* P95 Value Label */}
                <text
                  x={cx + barW / 2 + 2}
                  y={p95Y - 6}
                  textAnchor="middle"
                  className="text-[10px] font-mono font-extrabold fill-indigo-700"
                >
                  {svc.p95_latency_ms !== null ? `${svc.p95_latency_ms}` : '-'}
                </text>

                {/* X-axis Service Name */}
                <text
                  x={cx}
                  y={height - padBottom + 20}
                  textAnchor="middle"
                  className={`text-xs font-bold ${
                    isHovered ? 'fill-sky-700 font-extrabold' : 'fill-slate-700'
                  }`}
                >
                  {svc.service_name}
                </text>
                <text
                  x={cx}
                  y={height - padBottom + 34}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-slate-400"
                >
                  {svc.service_id}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      {/* Latency Hover Tooltip Card */}
      {hoveredIdx !== null && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-900 text-sm">{services[hoveredIdx].service_name}</span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Avg:</strong>{' '}
              <span className="font-mono text-sky-700 font-bold">
                {services[hoveredIdx].avg_latency_ms !== null ? `${services[hoveredIdx].avg_latency_ms} ms` : 'N/A'}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>P95 Tail:</strong>{' '}
              <span className="font-mono text-indigo-700 font-bold">
                {services[hoveredIdx].p95_latency_ms !== null ? `${services[hoveredIdx].p95_latency_ms} ms` : 'N/A'}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-mono text-[11px]">
              Min: {services[hoveredIdx].min_latency_ms ?? 'N/A'}ms • Max: {services[hoveredIdx].max_latency_ms ?? 'N/A'}ms
            </span>
          </div>

          <div>
            {services[hoveredIdx].p95_latency_ms && services[hoveredIdx].avg_latency_ms ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                Tail Latency Gap: +{Math.round(services[hoveredIdx].p95_latency_ms - services[hoveredIdx].avg_latency_ms)}ms (
                {(services[hoveredIdx].p95_latency_ms / services[hoveredIdx].avg_latency_ms).toFixed(1)}x average)
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
