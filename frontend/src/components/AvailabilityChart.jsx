import React, { useState } from 'react';
import { Target, CheckCircle2, AlertOctagon, Info } from 'lucide-react';

export default function AvailabilityChart({ services = [], slaTarget = 99.9 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!services || services.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No service metrics available to display chart.
      </div>
    );
  }

  // Determine Y-axis range
  const minAvail = Math.min(...services.map((s) => s.availability_pct));
  const floorVal = Math.max(92, Math.floor(minAvail - 0.8));
  const ceilVal = 100;
  const range = ceilVal - floorVal;

  // Chart dimensions
  const width = 800;
  const height = 290;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 55;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getY = (val) => padTop + chartH - ((val - floorVal) / range) * chartH;
  const targetY = getY(slaTarget);

  // Y-axis grid increments (e.g. floorVal, floorVal+2, 99.9, 100)
  const gridSteps = [floorVal, Math.round((floorVal + 99.9) / 2 * 10) / 10, 99.9, 100];
  const uniqueGridSteps = [...new Set(gridSteps)].sort((a, b) => a - b);

  const colWidth = Math.min(68, Math.floor((chartW / services.length) * 0.5));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      {/* Chart Top Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            <h4 className="text-sm font-bold text-slate-900">Service Availability vs Contract SLA Target</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time availability score per microservice compared against the 99.900% contractual SLA threshold.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-2xs" />
            <span className="text-slate-700">Compliant (&gt;= {slaTarget}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500 shadow-2xs" />
            <span className="text-slate-700">Breached (&lt; {slaTarget}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500" />
            <span className="text-rose-700 font-bold">99.9% Target</span>
          </div>
        </div>
      </div>

      {/* SVG Column Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[320px] select-none"
        >
          <defs>
            {/* Emerald Gradient for Compliant Services */}
            <linearGradient id="gradCompliant" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Rose Gradient for Breached Services */}
            <linearGradient id="gradBreached" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>

            {/* Subtle glow filter */}
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Horizontal Gridlines */}
          {uniqueGridSteps.map((step) => {
            const yPos = getY(step);
            const isTarget = step === slaTarget;
            return (
              <g key={step}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke={isTarget ? '#f43f5e' : '#e2e8f0'}
                  strokeDasharray={isTarget ? '5 4' : '2 3'}
                  strokeWidth={isTarget ? 1.5 : 1}
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className={`text-[10px] font-mono font-bold ${
                    isTarget ? 'fill-rose-600' : 'fill-slate-400'
                  }`}
                >
                  {step.toFixed(step === 99.9 ? 1 : 0)}%
                </text>
              </g>
            );
          })}

          {/* 99.9% Target Tag on Right Edge */}
          <g transform={`translate(${width - padRight - 85}, ${targetY - 10})`}>
            <rect
              width="85"
              height="18"
              rx="4"
              className="fill-rose-50 stroke stroke-rose-300"
            />
            <text
              x="42"
              y="12"
              textAnchor="middle"
              className="fill-rose-700 text-[10px] font-bold"
            >
              SLA 99.9% Target
            </text>
          </g>

          {/* Vertical Bars for Each Service */}
          {services.map((svc, idx) => {
            const slotW = chartW / services.length;
            const cx = padLeft + (idx + 0.5) * slotW;
            const barX = cx - colWidth / 2;
            const barY = getY(svc.availability_pct);
            const barH = padTop + chartH - barY;
            const isBreached = svc.sla_breached;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={svc.service_id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Background Hover Highlight Column */}
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.6)' : 'transparent'}
                  rx="6"
                  className="transition-colors duration-150"
                />

                {/* The Column Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={colWidth}
                  height={Math.max(4, barH)}
                  rx="6"
                  fill={isBreached ? 'url(#gradBreached)' : 'url(#gradCompliant)'}
                  filter="url(#shadow)"
                  className="transition-all duration-300"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.65}
                />

                {/* Percentage Tag Above Bar */}
                <g transform={`translate(${cx}, ${barY - 10})`}>
                  <rect
                    x="-34"
                    y="-12"
                    width="68"
                    height="18"
                    rx="4"
                    className={`${
                      isBreached
                        ? 'fill-rose-50 stroke stroke-rose-200'
                        : 'fill-emerald-50 stroke stroke-emerald-200'
                    }`}
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    className={`text-[11px] font-mono font-extrabold ${
                      isBreached ? 'fill-rose-700' : 'fill-emerald-700'
                    }`}
                  >
                    {svc.availability_pct.toFixed(2)}%
                  </text>
                </g>

                {/* X-axis Service Label */}
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

          {/* Baseline X-axis */}
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

      {/* Dynamic Hover Details Card */}
      {hoveredIdx !== null && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            <span className="font-bold text-slate-900 text-sm">{services[hoveredIdx].service_name}</span>
            <span className="font-mono text-slate-400">({services[hoveredIdx].service_id})</span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Healthy:</strong> {services[hoveredIdx].healthy_checks} / {services[hoveredIdx].total_checks}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Outages:</strong>{' '}
              <span className={services[hoveredIdx].error_checks > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                {services[hoveredIdx].error_checks} checks
              </span>
            </span>
          </div>

          <div>
            {services[hoveredIdx].sla_breached ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertOctagon className="w-3.5 h-3.5" />
                SLA Breached by -{(slaTarget - services[hoveredIdx].availability_pct).toFixed(3)}% (Billing Credit Applicable)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                SLA Met (+{(services[hoveredIdx].availability_pct - slaTarget).toFixed(3)}% above target)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
