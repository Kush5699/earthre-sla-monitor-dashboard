import React from 'react';
import { Activity, UploadCloud, ChevronDown } from 'lucide-react';

export default function Navbar({
  uploads = [],
  selectedUploadId,
  onSelectUpload,
  onOpenUploadModal,
  backendConnected = true,
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center shadow-md shadow-sky-600/20 text-white font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">EarthRe SLA Engine</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Production
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`inline-block w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{backendConnected ? 'Cloudflare Serverless Engine • APAC Edge' : 'Connecting to Cloud...'}</span>
            </div>
          </div>
        </div>

        {/* Dataset Switcher (only shown when 2 or more CSVs uploaded) & Upload Action */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {uploads.length > 1 && (
            <div className="relative flex-1 sm:w-64">
              <select
                value={selectedUploadId || ''}
                onChange={(e) => onSelectUpload(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer appearance-none pr-8 truncate transition-colors shadow-xs"
              >
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.filename} ({u.date_range_start || 'N/A'} to {u.date_range_end || 'N/A'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap active:scale-[0.99]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
