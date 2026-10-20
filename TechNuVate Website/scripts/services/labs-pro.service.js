// scripts/services/labs-pro.service.js
// Handles Labs Pro application form on labs-apply-pro.html.
// Replaces: submitForm() in labs-apply-pro.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitLabsProApplication(event) {
  if (event && event.preventDefault) event.preventDefault();

  var submitButton = document.getElementById('submitBtn');
  var spinnerElement = document.getElementById('spinner');
  var buttonTextElement = document.getElementById('btnText');

  var fullName = getFieldValue('fullname');
  var email = getFieldValue('email');
  var phone = getFieldValue('phone');
  var gender = getFieldValue('gender');
  var ageRange = getFieldValue('age');
  var country = getFieldValue('country');
  var stateRegion = getFieldValue('nigeria-state') ||
    getFieldValue('other-country-state') ||
    getFieldValue('intl-state') || undefined;
  var skillTrack = getFieldValue('track');
  var background = getFieldValue('background');
  var experience = getFieldValue('experience');
  var goal = getFieldValue('goal');
  var linkedin = getFieldValue('linkedin');
  var currency = window.lbpSelectedCurrency || 'NGN';
  var commitmentCheckbox = document.getElementById('commitCheck');
  var commitmentConfirmed = Boolean(commitmentCheckbox && commitmentCheckbox.checked);
  var commitError = document.getElementById('commitErr');

  if (!commitmentConfirmed) {
    if (commitError) commitError.style.display = 'block';
    showToast('Please confirm the terms and commitment.', 'error');
    return;
  }
  if (commitError) commitError.style.display = 'none';

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
  if (!gender) {
    showToast('Please select your gender.', 'error');
    return;
  }
  if (!ageRange) {
    showToast('Please select your age range.', 'error');
    return;
  }
  if (!country) {
    showToast('Please select your country.', 'error');
    return;
  }
  if (!skillTrack) {
    showToast('Please select your digital skill track.', 'error');
    return;
  }
  if (!background) {
    showToast('Please select where you learned your skill.', 'error');
    return;
  }
  if (!experience) {
    showToast('Please describe your current skill level.', 'error');
    return;
  }
  if (!goal) {
    showToast('Please tell us what you want to walk away with.', 'error');
    return;
  }
  if (!linkedin) {
    showToast('Please enter your LinkedIn profile URL.', 'error');
    return;
  }

  function restoreForm() {
    enableAllFields('formCard');
    if (submitButton) submitButton.disabled = false;
    if (spinnerElement) spinnerElement.style.display = 'none';
    if (buttonTextElement) buttonTextElement.textContent = 'Confirm and Pay';
  }

  disableAllFields('formCard');
  if (spinnerElement) spinnerElement.style.display = 'inline-block';
  if (buttonTextElement) buttonTextElement.textContent = 'Processing...';

  try {
    var result = await apiRequest(ENDPOINTS.LABS_PRO_APPLY, {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName,
        email: email,
        phone: phone,
        gender: gender,
        ageRange: ageRange,
        country: country,
        stateRegion: stateRegion,
        skillTrack: skillTrack,
        background: background,
        experience: experience,
        goal: goal,
        linkedin: linkedin,
        currency: currency,
        commitmentConfirmed: commitmentConfirmed,
      }),
    });

    var paymentLink = result.body && result.body.data && result.body.data.flwLink;
    if (result.ok && paymentLink) {
      var formCard = document.getElementById('formCard');
      if (formCard) {
        formCard.querySelectorAll('input, select, textarea').forEach(function (el) {
          if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
          } else {
            el.value = '';
          }
        });
      }
      restoreForm();
      window.location.href = paymentLink;
    } else {
      restoreForm();
      showToast(
        extractServerMessage(result.body) || 'Something went wrong. Please try again.',
        'error'
      );
    }
  } catch (err) {
    console.error('Labs Pro submit error:', err);
    restoreForm();
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
