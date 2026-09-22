import React, { useState } from 'react';
import { Calendar, AlertTriangle, CheckCircle2, TrendingDown, Filter } from 'lucide-react';

export default function DailyTrendChart({ dailyTrends = [], services = [], slaTarget = 99.9 }) {
  const [selectedService, setSelectedService] = useState('ALL');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!dailyTrends || dailyTrends.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No daily trend data available for this upload.
      </div>
    );
  }

  // Calculate day metrics based on selected service
  const days = dailyTrends.map((d) => {
    let total = d.total_checks;
    let healthy = d.healthy_checks;
    let errors = d.error_checks;
    let pct = d.availability_pct;

    if (selectedService !== 'ALL' && d.services && d.services[selectedService]) {
      const s = d.services[selectedService];
      total = s.total;
      healthy = s.healthy;
      errors = s.errors;
      pct = total > 0 ? Math.round((healthy / total) * 100000) / 1000 : 100;
    }

    return {
      date: d.date,
      total,
      healthy,
      errors,
      pct,
      isBreached: pct < slaTarget,
      services: d.services || {},
    };
  });

  const outageDaysCount = days.filter((d) => d.isBreached).length;

  // Chart dimensions
  const width = 900;
  const height = 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 50;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Y-axis bounds
  const minPct = Math.min(...days.map((d) => d.pct));
  const floorVal = Math.max(90, Math.floor(minPct - 1.5));
  const ceilVal = 100;
  const range = ceilVal - floorVal;

  const getY = (val) => padTop + chartH - ((val - floorVal) / range) * chartH;
  const targetY = getY(slaTarget);

  // Calculate coordinates for points
  const points = days.map((d, i) => {
    const x = days.length > 1
      ? padLeft + (i / (days.length - 1)) * chartW
      : padLeft + chartW / 2;
    const y = getY(d.pct);
    return { ...d, x, y };
  });

  // Construct SVG Area and Line paths
  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`
    : '';

  // Y-axis grid markers
  const yTicks = [floorVal, Math.round((floorVal + 99.9) / 2), 99.9, 100];
  const uniqueYTicks = [...new Set(yTicks)].sort((a, b) => a - b);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Daily Availability Timeline &amp; Incident Windows
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
              {days.length} Days Monitored
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {outageDaysCount > 0 ? (
              <span className="text-rose-600 font-semibold">
                Detected {outageDaysCount} incident day{outageDaysCount > 1 ? 's' : ''} breaching the 99.9% target.
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">
                All {days.length} days consistently met 100% SLA compliance.
              </span>
            )}
          </p>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Service Focus:</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">Fleet Aggregate (All Services)</option>
            {services.map((s) => (
              <option key={s.service_id} value={s.service_id}>
                {s.service_name} ({s.service_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SVG Time-Series Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[320px] select-none"
        >
          <defs>
            {/* Area Gradient */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
            </linearGradient>

            {/* Outage Point Glow Filter */}
            <filter id="outageGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f43f5e" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Horizontal Gridlines */}
          {uniqueYTicks.map((tick) => {
            const yPos = getY(tick);
            const isTarget = tick === 99.9;
            return (
              <g key={tick}>
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
                  {tick.toFixed(tick === 99.9 ? 1 : 0)}%
                </text>
              </g>
            );
          })}

          {/* 99.9% Target Badge on Right */}
          <g transform={`translate(${width - padRight - 90}, ${targetY - 10})`}>
            <rect
              width="90"
              height="18"
              rx="4"
              className="fill-rose-50 stroke stroke-rose-300"
            />
            <text
              x="45"
              y="12"
              textAnchor="middle"
              className="fill-rose-700 text-[10px] font-bold"
            >
              99.9% Target Line
            </text>
          </g>

          {/* Area Fill Under Curve */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Curve Line Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis Baseline */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={width - padRight}
            y2={padTop + chartH}
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />

          {/* Data Points on Curve */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            const isBreached = pt.isBreached;

            return (
              <g
                key={pt.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Vertical hover crosshair guide */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={padTop}
                    x2={pt.x}
                    y2={padTop + chartH}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                )}

                {/* Invisible large touch target */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Point Dot */}
                {isBreached ? (
                  <g filter="url(#outageGlow)">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : 5.5}
                      className="fill-rose-600 stroke stroke-white"
                      strokeWidth="2"
                    />
                    {/* Outage Tag */}
                    <g transform={`translate(${pt.x}, ${pt.y - 12})`}>
                      <rect
                        x="-20"
                        y="-12"
                        width="40"
                        height="16"
                        rx="3"
                        className="fill-rose-600"
                      />
                      <text
                        x="0"
                        y="-1"
                        textAnchor="middle"
                        className="fill-white text-[9px] font-bold"
                      >
                        {pt.errors} err
                      </text>
                    </g>
                  </g>
                ) : (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : 3.5}
                    className="fill-sky-600 stroke stroke-white"
                    strokeWidth="2"
                  />
                )}

                {/* X-axis Date Labels (Sampled to avoid crowding) */}
                {(days.length <= 15 || idx % Math.ceil(days.length / 10) === 0 || idx === days.length - 1) && (
                  <text
                    x={pt.x}
                    y={height - padBottom + 20}
                    textAnchor="middle"
                    className={`text-[10px] font-mono ${
                      isHovered ? 'fill-sky-700 font-bold' : 'fill-slate-400'
                    }`}
                  >
                    {pt.date.slice(5)} {/* MM-DD */}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card */}
      {hoveredIdx !== null && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-slate-900 text-sm">{days[hoveredIdx].date}</span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Availability:</strong>{' '}
              <span
                className={`font-extrabold font-mono ${
                  days[hoveredIdx].isBreached ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {days[hoveredIdx].pct.toFixed(3)}%
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Checks:</strong> {days[hoveredIdx].healthy.toLocaleString()} healthy / {days[hoveredIdx].total.toLocaleString()} total
            </span>
          </div>

          <div>
            {days[hoveredIdx].isBreached ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                {days[hoveredIdx].errors} Outage Checks Detected (SLA Breached on this date)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                100% Operational (0 outages recorded)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
