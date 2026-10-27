// scripts/services/tutors.service.js
// Handles tutor application form on tutors.html.
// Replaces: submitTutor() in tutors.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitTutorApplication(event) {
  if (event && event.preventDefault) event.preventDefault();

  var submitButton = document.getElementById('tutorBtn');
  var spinnerElement = document.getElementById('tutorSpinner');
  var buttonTextElement = document.getElementById('tutorBtnText');

  var fullName = getFieldValue('t-name');
  var email = getFieldValue('t-email');
  var phone = getFieldValue('t-phone');
  var gender = getFieldValue('t-gender');
  var ageRange = getFieldValue('t-age');
  var country = getFieldValue('t-country');
  var stateRegion = getFieldValue('t-state') || undefined;
  var linkedin = getFieldValue('t-linkedin');
  var subjectTrack = getFieldValue('t-track');
  var teachingExperience = getFieldValue('t-exp');
  var biography = getFieldValue('t-bio');
  var portfolioUrl = getFieldValue('t-portfolio') || undefined;
  var weeklyHours = getFieldValue('t-hours') || undefined;
  var networkRaw = getFieldValue('t-network');
  var mobileNetwork = networkRaw === 'Other'
    ? getFieldValue('t-network-other') || undefined
    : networkRaw || undefined;
  var dataTopupPhone = getFieldValue('t-data-phone') || undefined;

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
  if (!linkedin) {
    showToast('Please enter your LinkedIn profile URL.', 'error');
    return;
  }
  if (!subjectTrack) {
    showToast('Please select a subject track.', 'error');
    return;
  }
  if (!teachingExperience) {
    showToast('Please select your years of experience.', 'error');
    return;
  }
  if (!biography) {
    showToast('Please tell us about yourself.', 'error');
    return;
  }

  disableAllFields('formCard');
  document.querySelectorAll('#formCard .radio-opt').forEach(function (el) {
    el.style.pointerEvents = 'none';
  });
  if (spinnerElement) spinnerElement.style.display = 'inline-block';
  if (buttonTextElement) buttonTextElement.textContent = 'Submitting...';

  function restoreForm() {
    enableAllFields('formCard');
    document.querySelectorAll('#formCard .radio-opt').forEach(function (el) {
      el.style.pointerEvents = '';
    });
    if (submitButton) submitButton.disabled = false;
    if (spinnerElement) spinnerElement.style.display = 'none';
    if (buttonTextElement) buttonTextElement.textContent = 'Submit Application';
  }

  try {
    var result = await apiRequest(ENDPOINTS.TUTORS_APPLY, {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName,
        email: email,
        phone: phone,
        gender: gender,
        ageRange: ageRange,
        country: country,
        stateRegion: stateRegion,
        linkedin: linkedin,
        subjectTrack: subjectTrack,
        teachingExperience: teachingExperience,
        biography: biography,
        portfolioUrl: portfolioUrl,
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
          if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
          } else {
            el.value = '';
          }
        });
      }
      enableAllFields('formCard');

      var successCard = document.getElementById('successCard');
      if (formCard) formCard.style.display = 'none';
      if (successCard) successCard.style.display = 'block';
      restoreForm();

      setTimeout(function () {
        if (successCard) successCard.style.display = 'none';
        if (formCard) formCard.style.display = 'block';
      }, 7000);
    } else {
      restoreForm();
      var errMsg = extractServerMessage(result.body) ||
        'Something went wrong. Please try again.';
      if (result.body && result.body.statusCode === 409) {
        errMsg = 'An application from this email already exists. ' +
          'Contact us at hello@technuvate.com to update it.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Tutor apply error:', err);
    restoreForm();
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
