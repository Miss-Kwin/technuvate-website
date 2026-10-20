// scripts/utils/toast.js
// Shared toast notification helper.
// Replaces the repeated showFwToast() function
// that was duplicated across 13 HTML files.
// type: 'error' | 'success' | 'info'

export function showToast(message, type) {
  var existing = document.getElementById('fw-toast-el');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'fw-toast-el';
  toast.className = 'fw-toast' +
    (type === 'error'   ? ' fw-toast-error'   :
     type === 'success' ? ' fw-toast-success'  :
     type === 'info'    ? ' fw-toast-info'     : '');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      toast.classList.add('fw-toast-visible');
    });
  });

  setTimeout(function () {
    toast.classList.remove('fw-toast-visible');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 6000);
}
