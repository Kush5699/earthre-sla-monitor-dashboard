import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsSection from './components/StatsSection';
import LogsSection from './components/LogsSection';
import UploadModal from './components/UploadModal';
import { fetchUploads, fetchStats, checkHealth } from './api/client';
import { UploadCloud, FileText, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function App() {
  const [uploads, setUploads] = useState([]);
  const [selectedUploadId, setSelectedUploadId] = useState('');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [backendConnected, setBackendConnected] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Initial load
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const [isHealthy, uploadsList] = await Promise.all([
        checkHealth().catch(() => true),
        fetchUploads().catch(() => []),
      ]);

      setBackendConnected(isHealthy);
      if (uploadsList && uploadsList.length > 0) {
        setUploads(uploadsList);
        const validUploads = uploadsList.filter((u) => u.clean_rows > 10);
        const initialUpload = validUploads.length > 0 ? validUploads[0] : uploadsList[0];
        if (initialUpload) {
          setSelectedUploadId(initialUpload.id);
          await loadStats(initialUpload.id);
        }
      } else {
        setUploads([]);
        setSelectedUploadId('');
        setStats(null);
      }
    } catch (err) {
      console.log('Init check complete');
    }
  };

  const loadStats = async (uploadId) => {
    setLoadingStats(true);
    setGlobalError('');
    try {
      const statsData = await fetchStats(uploadId);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setGlobalError(err.message || 'Failed to load SLA stats.');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSelectUpload = (id) => {
    setSelectedUploadId(id);
    loadStats(id);
  };

  const handleUploadSuccess = async (newUploadId) => {
    try {
      const uploadsList = await fetchUploads();
      setUploads(uploadsList);
      setSelectedUploadId(newUploadId);
      await loadStats(newUploadId);
    } catch (err) {
      console.error('Error refreshing after upload:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        uploads={uploads}
        selectedUploadId={selectedUploadId}
        onSelectUpload={handleSelectUpload}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        backendConnected={backendConnected}
      />

      {/* Main Single-Screen Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Global Error Banner */}
        {globalError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{globalError}</span>
            <button
              onClick={() => initApp()}
              className="px-3 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {uploads.length === 0 ? (
          /* Empty State: Prompt Upload */
          <div className="max-w-xl mx-auto my-16 p-8 rounded-2xl bg-white border border-slate-200 text-center shadow-sm space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mx-auto shadow-xs">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">SLA Monitoring Dashboard</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                No health check data has been uploaded yet. Upload a monitoring CSV to trigger stateless cloud processing and view availability metrics.
              </p>
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <UploadCloud className="w-5 h-5" />
              <span>Upload Your First CSV</span>
            </button>
          </div>
        ) : (
          <>
            {/* TOP SECTION: Collapsible / Expandable Stats */}
            <StatsSection stats={stats} loading={loadingStats} />

            {/* BOTTOM SECTION: Filterable Logs View */}
            <LogsSection
              uploadId={selectedUploadId}
              services={stats?.services || []}
              minDate={stats?.overall?.date_range?.start}
              maxDate={stats?.overall?.date_range?.end}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">EarthRe SLA Verification & Monitoring Engine</span>
          </div>
          <div>
            <span>Stateless Serverless on Cloudflare Workers • Persistent Storage on Cloudflare D1 (SQLite)</span>
          </div>
        </div>
      </footer>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
