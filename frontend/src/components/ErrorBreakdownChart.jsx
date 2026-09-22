import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';

export default function ErrorBreakdownChart({ services = [] }) {
  const [hoveredCode, setHoveredCode] = useState(null);

  if (!services || services.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No error metrics available.
      </div>
    );
  }

  // Aggregate errors fleet-wide
  const fleetErrors = {};
  let totalOutages = 0;

  services.forEach((s) => {
    Object.entries(s.error_breakdown || {}).forEach(([code, count]) => {
      fleetErrors[code] = (fleetErrors[code] || 0) + count;
      totalOutages += count;
    });
  });

  const errorEntries = Object.entries(fleetErrors).sort((a, b) => b[1] - a[1]);

  if (totalOutages === 0) {
    return (
      <div className="p-8 text-center bg-emerald-50/40 border border-emerald-200/60 rounded-xl space-y-2">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <h4 className="text-sm font-bold text-emerald-900">Zero Outages Recorded Across Fleet</h4>
        <p className="text-xs text-emerald-700">
          Every single health check returned valid reachable status codes (2xx/3xx/4xx). 100% SLA compliant.
        </p>
      </div>
    );
  }

  const errorConfig = {
    '500': { color: '#f43f5e', label: 'Internal Server Error', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
    '502': { color: '#f59e0b', label: 'Bad Gateway', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    '503': { color: '#8b5cf6', label: 'Service Unavailable', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    '504': { color: '#f97316', label: 'Gateway Timeout', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  };

  // Build SVG Donut Chart arcs
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;
  const donutSlices = errorEntries.map(([code, count]) => {
    const pct = count / totalOutages;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += pct;
    const conf = errorConfig[code] || { color: '#64748b', label: 'Server Error' };

    return {
      code,
      count,
      pct: pct * 100,
      strokeDasharray,
      strokeDashoffset,
      color: conf.color,
      label: conf.label,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Outage Anatomy &amp; HTTP Error Root Cause Distribution
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of HTTP 5xx server failures causing SLA downtime across the monitoring window.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            {totalOutages} Total Outages Recorded
          </span>
        </div>
      </div>

      {/* Main Visual Layout: Donut Chart + Breakdown List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* SVG Donut Chart */}
        <div className="flex flex-col items-center justify-center relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {donutSlices.map((slice) => {
              const isHovered = hoveredCode === slice.code;
              return (
                <circle
                  key={slice.code}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="butt"
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredCode(slice.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                />
              );
            })}
          </svg>

          {/* Donut Center Counter */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-2xl font-black text-slate-900 leading-none">
              {hoveredCode && fleetErrors[hoveredCode] !== undefined
                ? fleetErrors[hoveredCode]
                : totalOutages}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              {hoveredCode ? `HTTP ${hoveredCode}` : 'Outages'}
            </span>
          </div>
        </div>

        {/* Error Code Distribution Cards */}
        <div className="md:col-span-2 space-y-2.5">
          {donutSlices.map((slice) => {
            const isHovered = hoveredCode === slice.code;
            return (
              <div
                key={slice.code}
                onMouseEnter={() => setHoveredCode(slice.code)}
                onMouseLeave={() => setHoveredCode(null)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isHovered
                    ? 'bg-slate-50 border-slate-300 shadow-2xs'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-2xs"
                      style={{ backgroundColor: slice.color }}
                    />
                    <strong className="font-mono font-bold text-slate-800">HTTP {slice.code}</strong>
                    <span className="text-slate-500 font-medium">({slice.label})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <strong className="text-slate-900 font-bold">{slice.count} checks</strong>
                    <span className="text-slate-400">({slice.pct.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Proportion bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${slice.pct}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Service Outage Attribution */}
      <div className="pt-3 border-t border-slate-100">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          Service Outage Attribution
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {services.map((s) => {
            const errCount = s.error_checks;
            return (
              <div
                key={s.service_id}
                className={`p-2.5 rounded-lg border text-xs ${
                  errCount > 0
                    ? 'bg-rose-50/40 border-rose-200'
                    : 'bg-slate-50/50 border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="truncate">{s.service_name}</span>
                  <span className={errCount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                    {errCount} err
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {s.availability_pct.toFixed(2)}% availability
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
