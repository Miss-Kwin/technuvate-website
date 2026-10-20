// Resolve the client page to show after a successful payment confirmation.
export function resolveClientRedirect(txRef) {
  if (txRef.startsWith('TNV-DONATION-')) return '/donate';
  if (txRef.startsWith('TNV-ACADEMY-')) return '/academy';
  if (txRef.startsWith('TNV-LABS_PRO-')) return '/labs-apply-pro';
  if (txRef.startsWith('TNV-LABS_IT-')) return '/labs-apply-it';
  return null;
}
