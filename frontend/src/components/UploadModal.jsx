import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, X, Loader2, Info } from 'lucide-react';
import { uploadCSV } from '../api/client';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setUploadResult(null);
      setErrorMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setErrorMessage('');
    setUploadResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Please choose a valid .csv file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File exceeds 25 MB limit');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setErrorMessage('');
    try {
      const result = await uploadCSV(selectedFile);
      setUploadResult(result);
      if (onUploadSuccess) {
        onUploadSuccess(result.upload_id);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Upload Health-Check CSV</h2>
              <p className="text-xs text-slate-500">Stateless cloud validation & persistence</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!uploadResult ? (
            <>
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-sky-500 bg-sky-50/50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for cloud processing
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReset();
                      }}
                      className="mt-3 text-xs text-rose-600 hover:text-rose-700 font-medium underline cursor-pointer"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      Drag and drop your CSV here, or <span className="text-sky-600 font-semibold underline">browse files</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports any multi-day CSV (9d, 12d, 14d, 21d, 30d, or arbitrary date range)
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Pipeline Info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-600" />
                  Stateless Cloud Processing Pipeline:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                  <li>Normalizes mixed timestamp formats (UTC Z, +05:30 offset, Unix epochs).</li>
                  <li>Harmonizes mixed latency units (seconds to milliseconds).</li>
                  <li>Detects & drops duplicate checks and corrupted status codes (e.g. 999).</li>
                  <li>Flags empty & negative latencies without breaking availability calculations.</li>
                  <li>Stores cleaned dataset directly into Cloudflare D1 persistent database.</li>
                </ul>
              </div>
            </>
          ) : (
            /* Upload Success & Issue Summary Screen */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">Processing & Persistence Succeeded</h4>
                  <p className="text-xs text-emerald-700">
                    File was parsed, validated, cleaned, and stored in Cloudflare D1 SQLite database.
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Total Raw Rows</span>
                  <div className="text-lg font-bold text-slate-900">{uploadResult.total_rows.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200/60">
                  <span className="text-[11px] text-emerald-700 font-medium">Cleaned & Stored</span>
                  <div className="text-lg font-bold text-emerald-700">{uploadResult.clean_rows.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-200/60">
                  <span className="text-[11px] text-rose-700 font-medium">Invalid / Dropped</span>
                  <div className="text-lg font-bold text-rose-700">{uploadResult.dropped_rows}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Date Range</span>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {uploadResult.date_range.start} to {uploadResult.date_range.end}
                  </div>
                </div>
              </div>

              {/* Issues Caught & Handled */}
              {uploadResult.issues && uploadResult.issues.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-800">Data Cleaning Findings Handled:</span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {uploadResult.issues.map((iss, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <span className="font-mono text-slate-800 font-medium">{iss.type}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold text-[11px]">
                          {iss.count} occurrences
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          {!uploadResult ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-xs ${
                  !selectedFile || uploading
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20 cursor-pointer'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing in Cloud...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Process & Save</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-300"
              >
                Upload Another File
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Open Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
