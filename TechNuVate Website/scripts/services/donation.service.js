// scripts/services/donation.service.js
// Handles donation form submission on index.html
// and donate.html. Both pages import from here.
// Replaces: openDonation() in index.html
//           wDonate() in donate.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';

export async function initializeDonation(donationData) {
  // Implementation added when donate.html / index.html is wired.
}
