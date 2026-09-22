/**
 * API client for Cloudflare Worker SLA Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sla-monitor-api.sla-monitor-backend.workers.dev';

export async function uploadCSV(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Failed to upload CSV file');
    error.code = data.code;
    error.preview = data.preview;
    throw error;
  }

  return data;
}

export async function fetchStats(uploadId = '') {
  const url = uploadId ? `${API_BASE_URL}/api/stats?upload_id=${encodeURIComponent(uploadId)}` : `${API_BASE_URL}/api/stats`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch SLA stats');
  }

  return data;
}

export async function fetchLogs({ uploadId = '', date = '', startDate = '', endDate = '', serviceId = '', status = '', page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (uploadId) params.append('upload_id', uploadId);
  if (date) params.append('date', date);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (serviceId && serviceId !== 'all') params.append('service_id', serviceId);
  if (status && status !== 'all') params.append('status', status);
  params.append('page', String(page));
  params.append('limit', String(limit));

  const res = await fetch(`${API_BASE_URL}/api/logs?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch health check logs');
  }

  return data;
}

export async function fetchUploads() {
  const res = await fetch(`${API_BASE_URL}/api/uploads`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch uploads list');
  }

  return data.uploads || [];
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    const data = await res.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}
