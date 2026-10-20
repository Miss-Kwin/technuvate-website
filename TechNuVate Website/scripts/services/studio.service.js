// scripts/services/studio.service.js
// Handles studio inquiry modal on studio.html.
// Replaces: submitConsult() in studio.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { showToast }  from '../utils/toast.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue } from '../utils/field.js';

export async function submitStudioInquiry(event) {
  if (event && event.preventDefault) event.preventDefault();

  var btn = document.querySelector('.m-submit');
  var fullName = getFieldValue('c-name');
  var email = getFieldValue('c-email');
  var phone = getFieldValue('c-phone');
  var organization = getFieldValue('c-org') || undefined;
  var serviceType = getFieldValue('c-service');
  var projectBrief = getFieldValue('c-extra') || undefined;

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
  if (!serviceType) {
    showToast('Please select a service.', 'error');
    return;
  }
  if (!projectBrief) {
    showToast('Please tell us anything else we should know.', 'error');
    return;
  }

  var serviceDetails = [];

  function collectPills(prompt, radioGroupSelector) {
    var selected = [];
    var group = document.querySelector(radioGroupSelector);
    if (group) {
      group.querySelectorAll('.radio-opt.selected').forEach(function (el) {
        selected.push(el.textContent.trim());
      });
    }
    if (selected.length) {
      serviceDetails.push({ prompt: prompt, answer: selected.join(', ') });
    }
  }

  function collectSingle(prompt, groupName) {
    var selector = '.radio-opt.selected[onclick*="' + groupName + '"]';
    var selected = document.querySelector(selector);
    if (selected && selected.textContent.trim()) {
      serviceDetails.push({ prompt: prompt, answer: selected.textContent.trim() });
    }
  }

  function collectText(prompt, inputId) {
    var value = getFieldValue(inputId);
    if (value) serviceDetails.push({ prompt: prompt, answer: value });
  }

  var visibleBox = document.querySelector('.cond-box.visible');
  if (visibleBox) {
    var boxId = visibleBox.id;

    if (boxId === 'cond-digital-marketing') {
      collectPills(
        'Which platforms do you want to focus on?',
        '#cond-digital-marketing .m-fg:nth-child(1) .radio-group'
      );
      collectSingle('Do you already have active social media pages?', 'has-social');
      collectSingle('What is your monthly budget range?', 'mkt-budget');
    }

    if (boxId === 'cond-brand-design') {
      collectPills('What do you need designed?', '#cond-brand-design .m-fg:nth-child(1) .radio-group');
      collectSingle('Do you have existing brand guidelines or a logo?', 'has-brand');
    }

    if (boxId === 'cond-website') {
      collectSingle('What kind of website do you need?', 'web-type');
      collectSingle('Do you already have a UI design for the website?', 'web-design');
      collectSingle('Do you have a domain name already?', 'web-domain');
      collectSingle('Do you need a CMS so you can update content yourself?', 'web-cms');
    }

    if (boxId === 'cond-product-management') {
      collectSingle('Where is your product right now?', 'prod-stage');
      collectPills('What kind of support do you need?', '#cond-product-management .m-fg:nth-child(2) .radio-group');
      collectSingle('Do you have a tech team building this product?', 'prod-team');
    }

    if (boxId === 'cond-content') {
      collectPills('What content do you need?', '#cond-content .m-fg:nth-child(1) .radio-group');
      collectSingle('How often do you need content?', 'content-freq');
    }

    if (boxId === 'cond-community') {
      collectSingle('What stage is your community at?', 'comm-stage');
      collectPills('Which platform is your community on?', '#cond-community .m-fg:nth-child(2) .radio-group');
    }

    if (boxId === 'cond-strategy') {
      collectPills('What is the main challenge you are trying to solve?', '#cond-strategy .m-fg:nth-child(1) .radio-group');
    }

    if (boxId === 'cond-data') {
      collectText('What data tools do you currently use, if any?', 'c-data-tools');
      collectPills('What do you want to measure or understand better?', '#cond-data .m-fg:nth-child(2) .radio-group');
    }

    if (boxId === 'cond-other') {
      collectText('What are you trying to achieve?', 'c-other-detail');
    }
  }

  function setFormDisabled(disabled) {
    if (disabled) {
      disableAllFields('consultForm');
    } else {
      enableAllFields('consultForm');
    }
    document.querySelectorAll('#consultForm .radio-opt').forEach(function (el) {
      el.style.pointerEvents = disabled ? 'none' : '';
    });
    if (btn) {
      btn.disabled = disabled;
      if (!disabled) btn.textContent = 'Send Brief →';
    }
  }

  setFormDisabled(true);
  if (btn) btn.textContent = 'Sending...';

  try {
    var result = await apiRequest(ENDPOINTS.STUDIO_INQUIRY, {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName,
        email: email,
        phone: phone,
        organization: organization,
        serviceType: serviceType,
        projectBrief: projectBrief,
        serviceDetails: serviceDetails.length ? serviceDetails : undefined,
      }),
    });

    if (result.ok && result.body.success) {
      if (typeof window.resetForm === 'function') window.resetForm();
      setFormDisabled(false);
      document.getElementById('consultForm').style.display = 'none';
      document.getElementById('consultSuccess').style.display = 'block';
    } else {
      setFormDisabled(false);
      showToast(
        extractServerMessage(result.body) ||
          'Something went wrong. Please try again or email us at hello@technuvate.com',
        'error'
      );
    }
  } catch (err) {
    console.error('Studio inquiry error:', err);
    setFormDisabled(false);
    showToast(
      'Something went wrong. Please check your connection and try again.',
      'error'
    );
  }
}
