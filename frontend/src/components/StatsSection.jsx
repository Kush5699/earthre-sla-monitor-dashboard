import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  AlertOctagon,
  CheckCircle,
  Clock,
  Activity,
  Layers,
  Calendar,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export default function StatsSection({ stats, loading }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!stats || !stats.overall) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs">
        <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">No SLA Stats Available</h3>
        <p className="text-xs text-slate-500 mt-1">Upload a monitoring CSV to view service availability metrics.</p>
      </section>
    );
  }

  const { overall, services = [] } = stats;
  const isCreditTriggered = overall.services_breaching_sla > 0;

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all duration-300">
      {/* Collapsible Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-50/70 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">SLA Performance Overview</h2>
              {/* Billing Credit / Compliance Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isCreditTriggered
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isCreditTriggered ? (
                  <>
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>{overall.services_breaching_sla} / {overall.total_services} Services Breached (Billing Credit Applicable)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>All Services Met SLA (&gt;= 99.9%)</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {overall.date_range.start} to {overall.date_range.end}
              </span>
              <span>•</span>
              <span>{overall.total_checks.toLocaleString()} Total Health Checks Evaluated</span>
            </div>
          </div>
        </div>

        {/* Toggle Collapse Button */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <span>{isCollapsed ? 'Expand Stats' : 'Collapse Stats'}</span>
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expandable Body */}
      {!isCollapsed && (
        <div className="p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Availability */}
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>Overall Availability</span>
                <span>Target: {overall.sla_target}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-extrabold tracking-tight ${
                    overall.overall_availability_pct >= overall.sla_target ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {overall.overall_availability_pct.toFixed(3)}%
                </span>
                <span className="text-xs text-slate-400 font-medium">fleet aggregate</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    overall.overall_availability_pct >= overall.sla_target ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, overall.overall_availability_pct)}%` }}
                />
              </div>
            </div>

            {/* SLA Breaches & Financial Risk */}
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>SLA Breaches</span>
                <AlertTriangle className={`w-4 h-4 ${isCreditTriggered ? 'text-rose-500' : 'text-emerald-500'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold ${isCreditTriggered ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {overall.services_breaching_sla}
                </span>
                <span className="text-xs text-slate-500">out of {overall.total_services} services</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {isCreditTriggered
                  ? 'Automated billing credit required per contract SLA.'
                  : 'Zero SLA breaches. 100% compliant.'}
              </p>
            </div>

            {/* Total Checks */}
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>Evaluated Checks</span>
                <Layers className="w-4 h-4 text-sky-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-800">
                  {overall.total_checks.toLocaleString()}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">
                  ({overall.total_healthy.toLocaleString()} healthy)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Every 15 minutes across multi-agent monitoring fleet.
              </p>
            </div>

            {/* Dataset Range */}
            <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                <span>Monitoring Window</span>
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-sm font-bold text-slate-800 truncate mt-1">
                {overall.date_range.start} to {overall.date_range.end}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Dynamically calculated from normalized timestamps.
              </p>
            </div>
          </div>

          {/* Per-Service Health Breakdown Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Service Breakdown & Outage Impact
              </h3>
              <span className="text-[11px] text-slate-500">Target Availability: 99.900%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {services.map((svc) => {
                const breached = svc.sla_breached;
                const errorCodes = Object.entries(svc.error_breakdown || {});

                return (
                  <div
                    key={svc.service_id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between shadow-2xs ${
                      breached
                        ? 'bg-rose-50/30 border-l-4 border-l-rose-500 border-slate-200 hover:border-slate-300'
                        : 'bg-white border-l-4 border-l-emerald-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">{svc.service_name}</h4>
                          <span className="font-mono text-[11px] text-slate-500">{svc.service_id}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            breached
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {breached ? 'Breached' : 'Compliant'}
                        </span>
                      </div>

                      {/* Availability Score */}
                      <div className="mt-2">
                        <div className="flex items-baseline justify-between mb-1">
                          <span
                            className={`text-xl font-black ${
                              breached ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {svc.availability_pct.toFixed(3)}%
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {svc.healthy_checks} / {svc.total_checks}
                          </span>
                        </div>

                        {/* Visual progress bar */}
                        <div className="relative w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              breached ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, svc.availability_pct))}%` }}
                          />
                        </div>
                      </div>

                      {/* Latency Stats */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Avg Latency:</span>
                          <span className="font-mono text-slate-800 font-semibold">
                            {svc.avg_latency_ms !== null ? `${svc.avg_latency_ms} ms` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>P95 Latency:</span>
                          <span className="font-mono text-slate-800 font-semibold">
                            {svc.p95_latency_ms !== null ? `${svc.p95_latency_ms} ms` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outage Breakdown */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Outage Breakdown
                      </span>
                      {errorCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {errorCodes.map(([code, count]) => (
                            <span
                              key={code}
                              className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200"
                            >
                              HTTP {code}: {count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium">0 Outages Recorded</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
