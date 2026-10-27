// scripts/services/academy.service.js
// Handles enrollment and partner code verification
// on enroll.html.
// Replaces: initiatePayment() and verifyPartnerCode()
//           in enroll.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import {
  getFieldValue,
  disableAllFields,
  enableAllFields,
} from '../utils/field.js';

export async function submitEnrollment(event) {
  if (event && event.type === 'submit') event.preventDefault();

  var btn = event && event.currentTarget
    ? event.currentTarget
    : document.getElementById('payBtn');
  var btnTextSpan = btn ? btn.querySelector('span') : null;

  var fullName = getFieldValue('fullname');
  var email = getFieldValue('email');
  var phone = getFieldValue('phone');
  var gender = getFieldValue('gender');
  var ageRange = getFieldValue('age-range');
  var country = getFieldValue('country');
  var state = getFieldValue('stateInput') || getFieldValue('otherStateInput') || undefined;
  var course = getFieldValue('course');
  var partnerCode = getFieldValue('partnerCode') || undefined;

  var pricingTier = window.currentTile.toUpperCase();
  var currency = window.activeCurrency;
  var commitEl = document.getElementById('commitCheck');
  var commitmentConfirmed = commitEl ? commitEl.checked : false;

  if (!commitmentConfirmed) {
    showToast('Please confirm the refund policy before proceeding.', 'error');
    return;
  }
  if (!fullName) {
    showToast('Please enter your full name.', 'error');
    return;
  }
  if (!email || email.indexOf('@') < 0) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  if (!phone) {
    showToast('Please enter your phone number.', 'error');
    return;
  }
  if (!country) {
    showToast('Please select your country.', 'error');
    return;
  }
  if (!course) {
    showToast('Please select your course.', 'error');
    return;
  }
  if (pricingTier === 'PARTNER' && !partnerCode) {
    showToast('Please enter and verify your partner code.', 'error');
    return;
  }

  if (btnTextSpan) btnTextSpan.textContent = 'Processing...';
  disableAllFields('formContent');

  try {
    var result = await apiRequest(ENDPOINTS.ACADEMY_ENROLL, {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName,
        email: email,
        phone: phone,
        gender: gender,
        ageRange: ageRange,
        country: country,
        state: state,
        course: course,
        pricingTier: pricingTier,
        partnerCode: pricingTier === 'PARTNER' ? partnerCode : undefined,
        currency: currency,
        commitmentConfirmed: commitmentConfirmed,
      }),
    });

    if (result.ok && result.body.data && result.body.data.flwLink) {
      enableAllFields('formContent');
      var formContent = document.getElementById('formContent');
      if (formContent) {
        formContent.querySelectorAll('input, select, textarea').forEach(function (field) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = false;
          } else {
            field.value = '';
          }
        });
      }
      window.location.href = result.body.data.flwLink;
    } else {
      var errMsg = extractServerMessage(result.body) ||
        'Something went wrong. Please try again.';
      enableAllFields('formContent');
      if (btnTextSpan) btnTextSpan.textContent = 'Pay Now and Secure Your Spot';
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Academy enroll error:', err);
    enableAllFields('formContent');
    if (btnTextSpan) btnTextSpan.textContent = 'Pay Now and Secure Your Spot';
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}

export async function verifyPartnerCode(event) {
  if (event && event.type === 'submit') event.preventDefault();

  var resultEl = document.getElementById('codeValid');
  var code = getFieldValue('partnerCode').toUpperCase();

  if (!code) {
    if (resultEl) {
      resultEl.textContent = 'Please enter a partner code.';
      resultEl.style.color = '#E53E3E';
      resultEl.style.display = 'block';
    }
    return;
  }

  try {
    var result = await apiRequest(ENDPOINTS.ACADEMY_VERIFY_PARTNER_CODE, {
      method: 'POST',
      body: JSON.stringify({ partnerCode: code }),
    });

    if (!resultEl) return;
    var serverMsg = result.body && result.body.data
      ? result.body.data.message
      : null;

    if (result.ok && result.body.data && result.body.data.valid) {
      resultEl.textContent = serverMsg || 'Partner code verified.';
      resultEl.style.color = '#15803D';
      resultEl.style.display = 'block';
    } else {
      resultEl.textContent = serverMsg || 'Invalid partner code.';
      resultEl.style.color = '#E53E3E';
      resultEl.style.display = 'block';
    }
  } catch (err) {
    if (resultEl) {
      resultEl.textContent = 'Could not verify code. Please try again.';
      resultEl.style.color = '#E53E3E';
      resultEl.style.display = 'block';
    }
  }
}
