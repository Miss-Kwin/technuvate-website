// scripts/services/tutors.service.js
// Handles tutor application form on tutors.html.
// Replaces: submitTutor() in tutors.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitTutorApplication(event) {
  // Implementation added when tutors.html is wired.
}
