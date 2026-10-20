// scripts/services/labs-it.service.js
// Handles Labs IT application form on labs-apply-it.html.
// Uses apiUpload() because this form sends files.
// Replaces: submitForm() in labs-apply-it.html

import { apiUpload }  from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitLabsItApplication(event) {
  // Implementation added when labs-apply-it.html is wired.
}
