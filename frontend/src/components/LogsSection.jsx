import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchLogs } from '../api/client';

export default function LogsSection({ uploadId, services = [], minDate, maxDate }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter States
  const [dateMode, setDateMode] = useState('all'); // 'all', 'single', 'range'
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'healthy', 'unhealthy'
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const loadLogs = async () => {
    if (!uploadId) return;

    setLoading(true);
    try {
      let dateParam = '';
      let startParam = '';
      let endParam = '';

      if (dateMode === 'single' && singleDate) {
        dateParam = singleDate;
      } else if (dateMode === 'range') {
        if (startDate) startParam = startDate;
        if (endDate) endParam = endDate;
      }

      const res = await fetchLogs({
        uploadId,
        date: dateParam,
        startDate: startParam,
        endDate: endParam,
        serviceId: selectedService,
        status: selectedStatus,
        page,
        limit,
      });

      setLogs(res.logs || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.total_pages || 1);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [dateMode, singleDate, startDate, endDate, selectedService, selectedStatus, limit, uploadId]);

  useEffect(() => {
    loadLogs();
  }, [uploadId, dateMode, singleDate, startDate, endDate, selectedService, selectedStatus, page, limit]);

  const handleResetFilters = () => {
    setDateMode('all');
    setSingleDate('');
    setStartDate('');
    setEndDate('');
    setSelectedService('all');
    setSelectedStatus('all');
    setPage(1);
  };

  const hasActiveFilters =
    dateMode !== 'all' ||
    selectedService !== 'all' ||
    selectedStatus !== 'all' ||
    Boolean(singleDate) ||
    Boolean(startDate || endDate);

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toUTCString().replace('GMT', 'UTC');
    } catch {
      return ts;
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all">
      {/* Header & Filter Controls Bar */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Health-Check Records</h2>
              <p className="text-xs text-slate-500">
                Underlying monitoring log records, filterable by single date or date range.
              </p>
            </div>
          </div>

          {/* Quick Stats / Refresh */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              {loading ? 'Querying database...' : `${total.toLocaleString()} records match filter`}
            </span>
            <button
              onClick={loadLogs}
              disabled={loading}
              title="Refresh logs"
              className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Date Filter Mode Selector */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              Date Filter
            </label>
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setDateMode('all')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                  dateMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Dates
              </button>
              <button
                type="button"
                onClick={() => setDateMode('single')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                  dateMode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Single Date
              </button>
              <button
                type="button"
                onClick={() => setDateMode('range')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                  dateMode === 'range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Date Range
              </button>
            </div>
          </div>

          {/* Date Inputs based on mode */}
          <div className="md:col-span-4 flex flex-col gap-1.5 justify-end">
            {dateMode === 'single' && (
              <div>
                <label className="text-[11px] text-slate-500 block mb-1 font-medium">Pick Date:</label>
                <input
                  type="date"
                  value={singleDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full bg-white text-slate-800 text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                />
              </div>
            )}

            {dateMode === 'range' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1 font-medium">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white text-slate-800 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1 font-medium">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white text-slate-800 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>
              </div>
            )}

            {dateMode === 'all' && (
              <div className="h-9 flex items-center px-3 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-500 italic">
                Full dataset span ({minDate || 'start'} to {maxDate || 'end'})
              </div>
            )}
          </div>

          {/* Service Filter */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full bg-white text-slate-800 text-xs font-medium rounded-lg px-3 py-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Services</option>
              {services.map((s) => (
                <option key={s.service_id} value={s.service_id}>
                  {s.service_name}
                </option>
              ))}
            </select>
          </div>

          {/* Health Status Filter */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              Health Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white text-slate-800 text-xs font-medium rounded-lg px-3 py-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Checks</option>
                <option value="healthy">Healthy Only (2xx)</option>
                <option value="unhealthy">Outages Only (5xx)</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  title="Clear all filters"
                  className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto min-h-[360px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
            <span className="text-sm font-medium">Fetching health check logs from Cloudflare D1...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
            <Search className="w-8 h-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No logs found matching selected criteria.</p>
            <p className="text-xs text-slate-500">Try adjusting or clearing the filters.</p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 underline cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Health</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Agent / Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logs.map((log) => {
                const isHealthy = log.is_healthy === 1;
                const statusCode = log.status_code;

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      !isHealthy ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>

                    {/* Service */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.service_name}</div>
                      <span className="font-mono text-[11px] text-slate-500">{log.service_id}</span>
                    </td>

                    {/* Status Code */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          statusCode === 200
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : statusCode >= 500
                            ? 'bg-rose-50 text-rose-700 border border-rose-300 font-black'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {statusCode}
                      </span>
                    </td>

                    {/* Health Status */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {isHealthy ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Healthy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Outage
                        </span>
                      )}
                    </td>

                    {/* Latency Normalized in ms */}
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono">
                      {log.latency_ms !== null ? (
                        <span
                          className={`font-semibold ${
                            log.latency_ms > 1000
                              ? 'text-rose-600'
                              : log.latency_ms > 500
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {log.latency_ms} ms
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unrecorded</span>
                      )}
                    </td>

                    {/* Agent & Region */}
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">
                      <span className="font-semibold text-slate-700">{log.agent}</span>
                      <span className="text-slate-400 ml-1">({log.region})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>
            Showing <span className="font-semibold text-slate-900">{Math.min(total, (page - 1) * limit + 1)}</span> to{' '}
            <span className="font-semibold text-slate-900">{Math.min(total, page * limit)}</span> of{' '}
            <span className="font-semibold text-slate-900">{total.toLocaleString()}</span> entries
          </span>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1 text-slate-600">
            Per page:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1.5 font-semibold text-slate-800">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
