// netlify/functions/contact-form.js
// Handles TechNuVate contact form submissions:
//   1. Saves the submission to Supabase (contact_submissions table)
//   2. Sends an admin notification email via Resend
//   3. Sends a confirmation email to the submitter via Resend

const SB_URL = 'https://xnynghnhbeyeowcibuvz.supabase.co';
const SB_KEY = 'sb_publishable_zdVAJtVvBg5LlhTfsT3RoA_V0O3uuoY';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Invalid request body' });
    }
  }
  if (!data) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Invalid request body' });
  }

  var firstName = (data.firstName || '').trim();
  var lastName = (data.lastName || '').trim();
  var email = (data.email || '').trim();
  var subject = (data.subject || '').trim();
  var message = (data.message || '').trim();

  if (!firstName || !lastName || !email || !message) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  var fullName = firstName + ' ' + lastName;

  // ── STEP 1: Save to Supabase ──────────────────────────────────
  try {
    var sbResponse = await fetch(SB_URL + '/rest/v1/contact_submissions', {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        full_name: fullName,
        email: email,
        subject: subject,
        message: message
      })
    });

    if (!sbResponse.ok) {
      var sbErrText = await sbResponse.text();
      console.error('Supabase insert failed:', sbResponse.status, sbErrText);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ error: 'Failed to save submission' });
    }
  } catch (sbErr) {
    console.error('Supabase insert error:', sbErr);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Failed to save submission' });
  }

  // ── STEP 2: Admin notification email ────────────────────────
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_SENDER_EMAIL,
        to: [process.env.CONTACT_RECEIVER_EMAIL],
        reply_to: email,
        subject: 'New Contact Form Submission from ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A;font-size:18px;margin-bottom:16px">New Contact Form Submission</h2>' +
          '<p style="margin:6px 0"><strong>Name:</strong> ' + fullName + '</p>' +
          '<p style="margin:6px 0"><strong>Email:</strong> ' + email + '</p>' +
          '<p style="margin:6px 0"><strong>Subject:</strong> ' + subject + '</p>' +
          '<p style="margin:16px 0 6px"><strong>Message:</strong></p>' +
          '<p style="margin:0;white-space:pre-wrap;line-height:1.6">' + message + '</p>' +
          '</div>'
      })
    });
  } catch (adminEmailErr) {
    console.error('Admin notification email failed:', adminEmailErr);
    // Do not fail the request — the submission is already saved.
  }

  // ── STEP 3: Confirmation email to submitter ─────────────────
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_SENDER_EMAIL,
        to: [email],
        subject: 'We received your message — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<p>Hi ' + firstName + ',</p>' +
          '<p>we received your message and will get back to you within 24 hours. Thank you for reaching out to TechNuVate.</p>' +
          '</div>'
      })
    });
  } catch (confirmEmailErr) {
    console.error('Confirmation email failed:', confirmEmailErr);
    // Do not fail the request — the submission is already saved.
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ success: true });
};