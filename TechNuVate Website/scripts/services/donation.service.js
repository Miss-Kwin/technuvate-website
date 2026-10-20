// scripts/services/donation.service.js
// Handles donation form submission on index.html
// and donate.html. Both pages import from here.
// Replaces: openDonation() in index.html
//           wDonate() in donate.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue } from '../utils/field.js';

export async function initializeDonation(event) {
  if (event && event.type === 'submit') event.preventDefault();

  var donationData = event && typeof event.preventDefault !== 'function'
    ? event
    : {};
  var readValue = function (key, fieldId) {
    return Object.prototype.hasOwnProperty.call(donationData, key)
      ? donationData[key]
      : getFieldValue(fieldId);
  };

  var wBtn = event && event.currentTarget
    ? event.currentTarget
    : document.getElementById('w-btn') || document.getElementById('don-btn');
  var donorName = readValue('donorName', 'w-name');
  var donorEmail = readValue('donorEmail', 'w-email');
  var occasion = readValue('occasion', 'w-occasion');
  var honoreeName = readValue('honoreeName', 'w-honour-name');
  var birthdayDay = readValue('birthDay', 'w-bday-day');
  var birthdayMonth = readValue('birthMonth', 'w-bday-month');
  var note = readValue('note', 'w-note');
  var shoutOutEl = document.getElementById('w-shoutout');
  var shoutOut = Object.prototype.hasOwnProperty.call(donationData, 'shoutOut')
    ? donationData.shoutOut
    : shoutOutEl ? shoutOutEl.checked : false;
  var currency = Object.prototype.hasOwnProperty.call(donationData, 'currency')
    ? donationData.currency
    : window.wCurrency !== undefined ? window.wCurrency : window.donCurrency;
  var amount = Object.prototype.hasOwnProperty.call(donationData, 'amount')
    ? donationData.amount
    : window.wAmt !== undefined ? window.wAmt : window.donAmount;

  if (!donorName) {
    showToast('Please enter your name before donating.', 'error');
    return;
  }
  if (!donorEmail || donorEmail.indexOf('@') < 0) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please select or enter a donation amount.', 'error');
    return;
  }

  if (wBtn) {
    wBtn.disabled = true;
    wBtn.innerHTML = '<span>Processing...</span>';
  }

  try {
    var result = await apiRequest(ENDPOINTS.DONATION_INITIALIZE, {
      method: 'POST',
      body: JSON.stringify({
        donorName: donorName || 'Anonymous Donor',
        donorEmail: donorEmail,
        honoreeName: honoreeName || undefined,
        occasion: occasion || undefined,
        birthDay: birthdayDay || undefined,
        birthMonth: birthdayMonth || undefined,
        note: note || undefined,
        shoutOut: shoutOut,
        amount: amount,
        currency: currency,
      }),
    });

    if (result.ok && result.body.data && result.body.data.flwLink) {
      window.location.href = result.body.data.flwLink;
    } else {
      var errMsg = extractServerMessage(result.body) ||
        'Something went wrong. Please try again.';
      if (wBtn) {
        wBtn.disabled = false;
        wBtn.innerHTML = '<span>Donate Now &#10084;</span>';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Donation init error:', err);
    if (wBtn) {
      wBtn.disabled = false;
      wBtn.innerHTML = '<span>Donate Now &#10084;</span>';
    }
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
