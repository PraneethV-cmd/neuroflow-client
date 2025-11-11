const BASE_URL = 'http://127.0.0.1:8000';

export async function uploadFile(file) {
  if (file.size > 2 * 1024 * 1024 * 1024) {
    throw new Error('File too large (>2GB). Not possible.');
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return await res.json();
}

export async function getSample(fileId) {
  const res = await fetch(`${BASE_URL}/sample/${encodeURIComponent(fileId)}`);
  if (!res.ok) throw new Error('Failed to fetch sample');
  return await res.json();
}

export async function getFull(fileId) {
  const res = await fetch(`${BASE_URL}/full/${encodeURIComponent(fileId)}`);
  if (!res.ok) throw new Error('Failed to fetch full data');
  return await res.json();
}

export async function encodeData({ fileId, columns, encodingType }) {
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('columns', columns.join(','));
  form.append('encodingType', encodingType);
  const res = await fetch(`${BASE_URL}/encode`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Encoding failed');
  }
  return await res.json();
}

export async function normalizeData({ fileId, columns, normalizationType }) {
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('columns', columns.join(','));
  form.append('normalizationType', normalizationType);
  const res = await fetch(`${BASE_URL}/normalize`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Normalization failed');
  }
  return await res.json();
}

export async function trainLinear({ fileId, xCol, yCol }) {
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('xCol', xCol);
  form.append('yCol', yCol);
  const res = await fetch(`${BASE_URL}/train/linear`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Training failed');
  }
  return await res.json();
}

export async function trainMultiLinear({ fileId, xCols, yCol }) {
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('xCols', xCols.join(','));
  form.append('yCol', yCol);
  const res = await fetch(`${BASE_URL}/train/multilinear`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Training failed');
  }
  return await res.json();
}

export async function listModels() {
  const res = await fetch(`${BASE_URL}/models`);
  if (!res.ok) throw new Error('Failed to list models');
  return await res.json();
}

export async function trainGeneric({ model, fileId, params }) {
  const res = await fetch(`${BASE_URL}/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, fileId, params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Training failed');
  }
  return await res.json();
}


