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
  var submitButton = document.getElementById('submitBtn');
  var spinnerElement = document.getElementById('spinner');
  var buttonTextElement = document.getElementById('btnText');

  var fullName = getFieldValue('fullname');
  var email = getFieldValue('email');
  var phone = getFieldValue('phone');
  var gender = getFieldValue('gender');
  var ageRange = getFieldValue('age');
  var stateOfResidence = getFieldValue('state');
  var city = getFieldValue('city');
  var schoolName = getFieldValue('institution');
  var institutionType = getFieldValue('institution-type');
  var courseOfStudy = getFieldValue('course');
  var currentLevel = getFieldValue('level');
  var itStartDate = getFieldValue('it-start');
  var itDuration = getFieldValue('it-duration');
  var supervisorName = getFieldValue('supervisor');
  var supervisorEmail = getFieldValue('supervisor-email');
  var naturalStrength = getFieldValue('strength');
  var peopleComfort = getFieldValue('people-comfort');
  var toolsFamiliar = getFieldValue('digital-skill');
  var whyTechnuvate = getFieldValue('motivation');

  var itLetterInput = document.getElementById('doc-it-letter');
  var schoolIdInput = document.getElementById('doc-id');
  var passportInput = document.getElementById('doc-passport');
  var itLetterFile = itLetterInput && itLetterInput.files[0];
  var schoolIdFile = schoolIdInput && schoolIdInput.files[0];
  var passportFile = passportInput && passportInput.files[0];
  var commitmentConfirmed = Boolean(
    document.getElementById('commitCheck')?.checked
  );

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
  if (!stateOfResidence) {
    showToast('Please select your state of residence.', 'error');
    return;
  }
  if (!city) {
    showToast('Please enter your city.', 'error');
    return;
  }
  if (!schoolName) {
    showToast('Please enter your school name.', 'error');
    return;
  }
  if (!institutionType) {
    showToast('Please select your institution type.', 'error');
    return;
  }
  if (!courseOfStudy) {
    showToast('Please select your course of study.', 'error');
    return;
  }
  if (!currentLevel) {
    showToast('Please select your current level.', 'error');
    return;
  }
  if (!itStartDate) {
    showToast('Please select your expected IT start date.', 'error');
    return;
  }
  if (!itDuration) {
    showToast('Please select your IT duration.', 'error');
    return;
  }
  if (!naturalStrength) {
    showToast('Please select your natural strength.', 'error');
    return;
  }
  if (!peopleComfort) {
    showToast('Please select your people comfort level.', 'error');
    return;
  }
  if (!toolsFamiliar) {
    showToast('Please describe the tools you are familiar with.', 'error');
    return;
  }
  if (!whyTechnuvate) {
    showToast('Please tell us why you want to do your IT at TechNuVate.', 'error');
    return;
  }

  var fileRequirements = [
    { file: itLetterFile, label: 'IT Request Letter' },
    { file: schoolIdFile, label: 'School ID or Admission Letter' },
    { file: passportFile, label: 'Passport Photograph' },
  ];
  var allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  var maxFileSize = 5 * 1024 * 1024;
  for (var i = 0; i < fileRequirements.length; i += 1) {
    var requirement = fileRequirements[i];
    if (!requirement.file) {
      showToast(requirement.label + ' is required.', 'error');
      return;
    }
    if (!allowedTypes.includes(requirement.file.type)) {
      showToast(requirement.label + ': only JPG, PNG, or PDF files are accepted.', 'error');
      return;
    }
    if (requirement.file.size > maxFileSize) {
      showToast(requirement.label + ' must be under 5MB.', 'error');
      return;
    }
  }

  disableAllFields('formCard');
  if (spinnerElement) spinnerElement.style.display = 'inline-block';
  if (buttonTextElement) buttonTextElement.textContent = 'Submitting...';

  var formData = new FormData();
  formData.append('fullName', fullName);
  formData.append('email', email);
  formData.append('phone', phone);
  formData.append('gender', gender);
  formData.append('ageRange', ageRange);
  formData.append('stateOfResidence', stateOfResidence);
  formData.append('city', city);
  formData.append('schoolName', schoolName);
  formData.append('institutionType', institutionType);
  formData.append('courseOfStudy', courseOfStudy);
  formData.append('currentLevel', currentLevel);
  formData.append('itStartDate', itStartDate);
  formData.append('itDuration', itDuration);
  formData.append('naturalStrength', naturalStrength);
  formData.append('peopleComfort', peopleComfort);
  formData.append('toolsFamiliar', toolsFamiliar);
  formData.append('whyTechnuvate', whyTechnuvate);
  formData.append('commitmentConfirmed', 'true');
  if (supervisorName) formData.append('supervisorName', supervisorName);
  if (supervisorEmail) formData.append('supervisorEmail', supervisorEmail);
  formData.append('itLetter', itLetterFile, itLetterFile.name);
  formData.append('schoolId', schoolIdFile, schoolIdFile.name);
  formData.append('passport', passportFile, passportFile.name);

  function restoreForm() {
    enableAllFields('formCard');
    if (submitButton) submitButton.disabled = false;
    if (spinnerElement) spinnerElement.style.display = 'none';
    if (buttonTextElement) buttonTextElement.textContent = 'Submit Application';
  }

  try {
    var result = await apiUpload(ENDPOINTS.LABS_IT_APPLY, formData);
    if (result.ok && result.body.success) {
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
      var serverMessage = extractServerMessage(result.body);
      if (serverMessage && successCard) {
        var successDesc = successCard.querySelector('.success-s');
        if (successDesc) successDesc.textContent = serverMessage;
      }
      if (successCard) successCard.style.display = 'block';
      if (formCard) formCard.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      restoreForm();
    } else {
      restoreForm();
      var errMsg = extractServerMessage(result.body) ||
        'Something went wrong. Please try again.';
      if (result.body && result.body.statusCode === 409) {
        errMsg = 'An application from this email already exists. ' +
          'Contact us at hello@technuvate.com.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error('Labs IT apply error:', err);
    restoreForm();
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
