// scripts/api/config.js
// Single source of truth for the API base URL.
// Change this one value to point all pages at a
// different environment — no per-file hunting needed.

export const API_CONFIG = {
  BASE_URL: 'https://api.technuvate.com',
  HEADERS: {
    'Content-Type': 'application/json',
  },
};
