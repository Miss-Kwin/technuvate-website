// scripts/utils/field.js
// DOM field reading helpers used across all form pages.
// Replaces the repeated gv() / val() helpers that were
// defined locally — sometimes twice — in 7 HTML files.

// Get trimmed string value of an input, select, or
// textarea by its element id. Returns empty string
// if the element does not exist.
export function getFieldValue(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// Disable a single form element and add the
// field-disabled class for visual feedback.
export function disableField(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.disabled = true;
  el.classList.add('field-disabled');
}

// Re-enable a single form element and remove the
// field-disabled class.
export function enableField(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.disabled = false;
  el.classList.remove('field-disabled');
}

// Disable all inputs, selects, textareas, and
// buttons inside a container element by id.
export function disableAllFields(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(
    'input, select, textarea, button'
  ).forEach(function (el) {
    el.disabled = true;
    el.classList.add('field-disabled');
  });
}

// Re-enable all inputs, selects, textareas, and
// buttons inside a container element by id.
export function enableAllFields(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll(
    'input, select, textarea, button'
  ).forEach(function (el) {
    el.disabled = false;
    el.classList.remove('field-disabled');
  });
}
