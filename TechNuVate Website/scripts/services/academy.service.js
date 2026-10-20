// scripts/services/academy.service.js
// Handles enrollment and partner code verification
// on enroll.html.
// Replaces: initiatePayment() and verifyPartnerCode()
//           in enroll.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitEnrollment(event) {
  // Implementation added when enroll.html is wired.
}

export async function verifyPartnerCode(event) {
  // Implementation added when enroll.html is wired.
}
