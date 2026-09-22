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
  const minAvail = Math.min(...services.map((s) => s.availability_pct ?? 100));
  const floorVal = Math.max(88, Math.floor(minAvail - 1));
  const ceilVal = 100.2;
  const range = ceilVal - floorVal;

  // Dynamic width scaling: if there are more than 6 services, chart widens with horizontal scroll
  const minColumnSlot = 90;
  const baseWidth = 820;
  const width = Math.max(baseWidth, services.length * minColumnSlot);
  const height = 310;
  const padLeft = 55;
  const padRight = 35;
  const padTop = 45;
  const padBottom = 55;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getY = (val) => padTop + chartH - ((val - floorVal) / range) * chartH;
  const targetY = getY(slaTarget);

  // Clean Y-axis ticks with spacing to prevent collision
  const step = range > 8 ? 2 : 1;
  const yTicks = [];
  for (let v = floorVal; v <= 100; v += step) {
    if (Math.abs(v - 99.9) > 0.4) {
      yTicks.push(v);
    }
  }
  if (!yTicks.includes(100)) yTicks.push(100);

  const slotW = chartW / services.length;
  const colWidth = Math.max(20, Math.min(56, slotW * 0.52));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
      {/* Header & Status Indicator Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Service Availability vs Contract SLA Target
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
              {services.length} Service{services.length > 1 ? 's' : ''} Detected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Microservice availability benchmarked against the 99.900% contractual SLA threshold.
          </p>
        </div>

        {/* Legend: Red for Breached, Blue for Compliant */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-sky-600 shadow-2xs" />
            <span className="text-slate-700">Compliant (Blue, &gt;= {slaTarget}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500 shadow-2xs" />
            <span className="text-slate-700">Breached (Red, &lt; {slaTarget}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500" />
            <span className="text-rose-600 font-bold">99.9% Target Baseline</span>
          </div>
        </div>
      </div>

      {/* SVG Column Chart (Dynamically scrolls if many services are present) */}
      <div className="relative w-full overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: services.length > 6 ? `${width}px` : '100%' }}
          className="w-full h-auto max-h-[340px] select-none"
        >
          <defs>
            {/* Blue Gradient for Compliant Services */}
            <linearGradient id="gradCompliantBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            {/* Red Gradient for Breached Services */}
            <linearGradient id="gradBreachedRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>

            {/* Drop shadow */}
            <filter id="barGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* Clean Horizontal Gridlines */}
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
                  className="text-[10px] font-mono font-bold fill-slate-400"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* 99.9% Target Dashed Horizontal Line */}
          <line
            x1={padLeft}
            y1={targetY}
            x2={width - padRight}
            y2={targetY}
            stroke="#e11d48"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Vertical Columns for Each Service (100% Dynamic, 0 hardcoding) */}
          {services.map((svc, idx) => {
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
                {/* Column background hover highlight */}
                <rect
                  x={padLeft + idx * slotW}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.7)' : 'transparent'}
                  rx="6"
                  className="transition-colors duration-150"
                />

                {/* The Column Bar: Red if breached, Blue if compliant */}
                <rect
                  x={barX}
                  y={barY}
                  width={colWidth}
                  height={Math.max(4, barH)}
                  rx="5"
                  fill={isBreached ? 'url(#gradBreachedRed)' : 'url(#gradCompliantBlue)'}
                  filter="url(#barGlow)"
                  className="transition-all duration-300"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.75}
                />

                {/* Clean Numeric Label Above Bar (No bulky borders, no collisions) */}
                <text
                  x={cx}
                  y={barY - 8}
                  textAnchor="middle"
                  className={`text-[11px] font-mono font-bold select-none ${
                    isBreached ? 'fill-rose-700' : 'fill-sky-700'
                  }`}
                >
                  {isBreached ? '▲ ' : '✓ '}{svc.availability_pct.toFixed(2)}%
                </text>

                {/* X-axis Service Name */}
                <text
                  x={cx}
                  y={height - padBottom + 20}
                  textAnchor="middle"
                  className={`text-xs font-bold ${
                    isHovered ? 'fill-sky-700 font-black' : 'fill-slate-800'
                  }`}
                >
                  {svc.service_name.length > 14 ? `${svc.service_name.slice(0, 12)}…` : svc.service_name}
                </text>
                <text
                  x={cx}
                  y={height - padBottom + 34}
                  textAnchor="middle"
                  className="text-[10px] font-mono fill-slate-400"
                >
                  {svc.service_id.length > 15 ? `${svc.service_id.slice(0, 13)}…` : svc.service_id}
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

      {/* Interactive Detail Card */}
      {hoveredIdx !== null && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full shadow-2xs ${
                services[hoveredIdx].sla_breached ? 'bg-rose-500' : 'bg-sky-600'
              }`}
            />
            <span className="font-bold text-slate-900 text-sm">
              {services[hoveredIdx].service_name}
            </span>
            <span className="font-mono text-slate-400">({services[hoveredIdx].service_id})</span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Availability:</strong>{' '}
              <span
                className={`font-mono font-extrabold ${
                  services[hoveredIdx].sla_breached ? 'text-rose-600' : 'text-sky-700'
                }`}
              >
                {services[hoveredIdx].availability_pct.toFixed(3)}%
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong>Checks:</strong> {services[hoveredIdx].healthy_checks.toLocaleString()} healthy / {services[hoveredIdx].total_checks.toLocaleString()} total
            </span>
          </div>

          <div>
            {services[hoveredIdx].sla_breached ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertOctagon className="w-3.5 h-3.5" />
                Breached by -{(slaTarget - services[hoveredIdx].availability_pct).toFixed(3)}% (Billing Credit Applicable)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Compliant (+{(services[hoveredIdx].availability_pct - slaTarget).toFixed(3)}% above SLA target)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
