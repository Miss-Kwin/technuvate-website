// scripts/services/careers.service.js
// Handles career application form on join-team.html.
// Replaces: submitMember() in join-team.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitCareerApplication(event) {
  // Implementation added when join-team.html is wired.
}
