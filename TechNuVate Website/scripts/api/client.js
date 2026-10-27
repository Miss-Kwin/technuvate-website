// scripts/api/client.js
// Reusable fetch wrapper for all NestJS API calls.
// Handles JSON responses, error extraction, and
// provides a multipart variant for file uploads.
// All services import from here — never write raw
// fetch calls in service files.

import { API_CONFIG } from './config.js';

// ── Standard JSON request ─────────────────────────────
// Use for all endpoints except file uploads.
// Returns { ok: boolean, body: object }.
export async function apiRequest(endpoint, options = {}) {
  const url = API_CONFIG.BASE_URL + endpoint;

  const response = await fetch(url, {
    headers: API_CONFIG.HEADERS,
    ...options,
  });

  const body = await response.json().catch(function () {
    return { message: 'Unexpected server response.' };
  });

  return { ok: response.ok, status: response.status, body };
}

// ── Multipart FormData request ────────────────────────
// Use for endpoints that receive file uploads.
// Do NOT pass Content-Type — the browser sets it
// automatically with the correct multipart boundary.
export async function apiUpload(endpoint, formData) {
  const url = API_CONFIG.BASE_URL + endpoint;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const body = await response.json().catch(function () {
    return { message: 'Unexpected server response.' };
  });

  return { ok: response.ok, status: response.status, body };
}
