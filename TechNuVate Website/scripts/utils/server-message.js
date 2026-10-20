// scripts/utils/server-message.js
// Extracts a readable message string from a NestJS
// error response body. NestJS can return message as
// a string or as an array of validation error strings.
// Replaces the repeated extractServerMessage() that
// was duplicated across 8 HTML files.

export function extractServerMessage(body) {
  if (!body) return null;
  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message) && body.message.length)
    return body.message[0];
  return null;
}
