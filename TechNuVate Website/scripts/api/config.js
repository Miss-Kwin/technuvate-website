// scripts/api/config.js
// API base URL is selected at runtime based on the
// current hostname. No build step or env file needed.
// To add a staging environment: extend the condition
// below with your staging hostname.

const hostname = window.location.hostname;

const BASE_URL =
  hostname === "technuvate.com" || hostname === "www.technuvate.com"
    ? "https://api.technuvate.com"
    : "https://api-technuvate.onrender.com";

export const API_CONFIG = {
  BASE_URL,
  HEADERS: {
    "Content-Type": "application/json",
  },
};
