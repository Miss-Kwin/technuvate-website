// scripts/services/contact.service.js
// Handles the contact form submission on index.html.
// Wired via addEventListener in index.html module script.
// Replaces: handleContactSubmit() in index.html

import { apiRequest } from '../api/client.js';
import { ENDPOINTS }  from '../api/endpoints.js';
import { extractServerMessage } from '../utils/server-message.js';
import { getFieldValue, disableAllFields, enableAllFields } from '../utils/field.js';

export async function submitContact(event) {
  event.preventDefault();

  function showFieldErr(id) {
    var err = document.getElementById('contact-' + id + '-err');
    if (err) err.style.display = 'block';
  }

  function clearFieldErr(id) {
    var err = document.getElementById('contact-' + id + '-err');
    if (err) err.style.display = 'none';
  }

  var firstName = getFieldValue('contact-firstname');
  var lastName = getFieldValue('contact-lastname');
  var email = getFieldValue('contact-email');
  var subject = getFieldValue('contact-subject');
  var message = getFieldValue('contact-message');

  var ok = true;
  if (!firstName) {
    showFieldErr('firstname');
    ok = false;
  } else clearFieldErr('firstname');
  if (!lastName) {
    showFieldErr('lastname');
    ok = false;
  } else clearFieldErr('lastname');
  if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0) {
    showFieldErr('email');
    ok = false;
  } else clearFieldErr('email');
  if (!message) {
    showFieldErr('message');
    ok = false;
  } else clearFieldErr('message');

  var statusMsg = document.getElementById('contact-status-msg');
  statusMsg.style.display = 'none';
  if (!ok) return;

  var btn = document.getElementById('contact-submit-btn');
  var btnText = document.getElementById('contact-submit-text');
  disableAllFields('contactForm');
  btnText.textContent = 'Sending...';

  try {
    var result = await apiRequest(ENDPOINTS.CONTACT, {
      method: 'POST',
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        subject: subject,
        message: message,
      }),
    });

    if (result.ok && result.body.success) {
      var successMessage = result.body.message
        ? result.body.message
        : 'Message sent! We will get back to you within 24 hours.';

      statusMsg.textContent = successMessage;
      statusMsg.style.color = '#1B3A7A';
      statusMsg.style.display = 'block';
      document.getElementById('contactForm').reset();
      enableAllFields('contactForm');
      btnText.innerHTML = 'Send Message &rarr;';
    } else {
      var errorMessage = extractServerMessage(result.body) ||
        'Something went wrong. Please try again or email us directly.';

      statusMsg.textContent = errorMessage;
      statusMsg.style.color = '#E53E3E';
      statusMsg.style.display = 'block';
      enableAllFields('contactForm');
      btnText.innerHTML = 'Send Message &rarr;';
    }
  } catch (err) {
    console.error('Contact form error:', err);
    statusMsg.textContent =
      'Something went wrong. Please try again or email us directly.';
    statusMsg.style.color = '#E53E3E';
    statusMsg.style.display = 'block';
    enableAllFields('contactForm');
    btnText.innerHTML = 'Send Message &rarr;';
  }
}
