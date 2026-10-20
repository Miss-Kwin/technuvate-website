// scripts/services/contact.service.js
// Handles the contact form submission on index.html.
// Wired via addEventListener in index.html module script.
// Replaces: handleContactSubmit() in index.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitContact(event) {
  event.preventDefault();
  // Implementation added when index.html is wired.
}
