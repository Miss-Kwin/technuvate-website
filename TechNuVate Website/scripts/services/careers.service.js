// scripts/services/careers.service.js
// Handles career application form on join-team.html.
// Replaces: submitMember() in join-team.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitCareerApplication(event) {
  if (event && event.type === 'submit') event.preventDefault();

  var submitButton = document.getElementById('memberBtn');
  var spinnerElement = document.getElementById('memberSpinner');
  var buttonTextElement = document.getElementById('memberBtnText');

  var fullName = getFieldValue('m-name');
  var email = getFieldValue('m-email');
  var phone = getFieldValue('m-phone');
  var gender = getFieldValue('m-gender');
  var ageRange = getFieldValue('m-age');
  var linkedin = getFieldValue('m-linkedin');
  var roleApplied = getFieldValue('m-role');
  var currentOccupation = getFieldValue('m-current');
  var experienceLevel = getFieldValue('m-exp');
  var whyJoin = getFieldValue('m-why');
  var relevantSkills = getFieldValue('m-skills');
  var weeklyHours = getFieldValue('m-hours');
  var networkRaw = getFieldValue('m-network');
  var mobileNetwork = networkRaw === 'Other'
    ? getFieldValue('m-network-other') || undefined
    : networkRaw || undefined;
  var dataTopupPhone = getFieldValue('m-data-phone') || undefined;

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
  if (!linkedin) {
    showToast('Please enter your LinkedIn profile URL.', 'error');
    return;
  }
  if (!roleApplied) {
    showToast('Please select the role you are applying for.', 'error');
    return;
  }
  if (!currentOccupation) {
    showToast('Please tell us what you currently do.', 'error');
    return;
  }
  if (!experienceLevel) {
    showToast('Please select your experience level.', 'error');
    return;
  }
  if (!whyJoin) {
    showToast('Please tell us why you want to join.', 'error');
    return;
  }
  if (!relevantSkills) {
    showToast('Please tell us about your relevant experience.', 'error');
    return;
  }
  if (!weeklyHours) {
    showToast('Please select your weekly commitment.', 'error');
    return;
  }

  disableAllFields('formCard');
  if (spinnerElement) spinnerElement.style.display = 'inline-block';
  if (buttonTextElement) buttonTextElement.textContent = 'Submitting...';

  try {
    var result = await apiRequest(ENDPOINTS.CAREERS_APPLY, {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName,
        email: email,
        phone: phone,
        gender: gender,
        ageRange: ageRange,
        linkedin: linkedin,
        roleApplied: roleApplied,
        currentOccupation: currentOccupation,
        experienceLevel: experienceLevel,
        whyJoin: whyJoin,
        relevantSkills: relevantSkills,
        weeklyHours: weeklyHours,
        mobileNetwork: mobileNetwork,
        dataTopupPhone: dataTopupPhone,
      }),
    });

    if (result.ok && result.body.success) {
      var serverMsg = extractServerMessage(result.body);
      var successMsgEl = document.getElementById('successCardMsg');
      if (serverMsg && successMsgEl) successMsgEl.textContent = serverMsg;

      var formCard = document.getElementById('formCard');
      if (formCard) {
        formCard.querySelectorAll('input, select, textarea').forEach(function (el) {
          if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio') {
            el.value = '';
          }
          if (el.tagName === 'SELECT') el.selectedIndex = 0;
          if (el.tagName === 'TEXTAREA') el.value = '';
          if (el.type === 'checkbox') el.checked = false;
        });
      }
      enableAllFields('formCard');

      var successCard = document.getElementById('successCard');
      if (formCard) formCard.style.display = 'none';
      if (successCard) successCard.style.display = 'block';
      if (submitButton) submitButton.disabled = false;
      if (spinnerElement) spinnerElement.style.display = 'none';
      if (buttonTextElement) buttonTextElement.textContent = 'Submit Application';

      setTimeout(function () {
        if (successCard) successCard.style.display = 'none';
        if (formCard) formCard.style.display = 'block';
      }, 7000);
    } else {
      enableAllFields('formCard');
      if (submitButton) submitButton.disabled = false;
      if (spinnerElement) spinnerElement.style.display = 'none';
      if (buttonTextElement) buttonTextElement.textContent = 'Submit Application';

      var errMsg = extractServerMessage(result.body) ||
        'Something went wrong. Please try again.';
      if (result.body && result.body.statusCode === 409) {
        errMsg = 'An application from this email already exists. ' +
          'Contact us at hello@technuvate.com to update it.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Career apply error:', err);
    enableAllFields('formCard');
    if (submitButton) submitButton.disabled = false;
    if (spinnerElement) spinnerElement.style.display = 'none';
    if (buttonTextElement) buttonTextElement.textContent = 'Submit Application';
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
