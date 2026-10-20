// Confirms Flutterwave redirects for donations, Academy, and Labs.

import { apiRequest } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

function resolveEndpoint(txRef) {
  if (txRef.indexOf('TNV-DONATION-') === 0) return ENDPOINTS.DONATION_CONFIRM;
  if (txRef.indexOf('TNV-ACADEMY-') === 0) return ENDPOINTS.ACADEMY_ENROLL_CONFIRM;
  if (txRef.indexOf('TNV-LABS_PRO-') === 0) return ENDPOINTS.LABS_PRO_APPLY_CONFIRM;
  if (txRef.indexOf('TNV-LABS_IT-') === 0) return ENDPOINTS.LABS_IT_APPLY_CONFIRM;
  return null;
}

export function confirmPayment(txRef, transactionId) {
  var endpoint = resolveEndpoint(txRef);
  if (!endpoint) return Promise.resolve(null);

  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      flwTxRef: txRef,
      flwTxId: transactionId || '',
    }),
  });
}
