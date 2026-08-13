// netlify/functions/studio-inquiry.js
// Receives studio project inquiry from the modal form
// Validates server-side
// Inserts into studio_inquiries table in Supabase
// Sends admin notification email via Resend
// Sends client confirmation email via Resend
// Returns { success: true } to frontend
// No payment involved

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const VALID_SERVICE_TYPES = [
  'Digital Marketing',
  'Product and Brand Design',
  'Website Creation',
  'Product Management Support',
  'Content Production',
  'Community Building and Management',
  'Digital Strategy and Consulting',
  'Data and Analytics Support',
  'Team Training & Business Structure',
  'Branding & Merchandise Production',
  'Something Else'
];

const VALID_BUDGET_RANGES = [
  'Under ₦100,000',
  '₦100,000 – ₦500,000',
  '₦500,000 – ₦1,000,000',
  'Above ₦1,000,000',
  'To be discussed'
];

const VALID_TIMELINES = [
  'Less than 1 week',
  '1 – 2 weeks',
  '2 – 4 weeks',
  '1 – 3 months',
  'Flexible'
];

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  var data;
  try {
    data = JSON.parse(event.body);
  } catch (parseError) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // ── Extract and trim all fields ──────────────────────
  var fullName       = (data.full_name       || '').trim();
  var email          = (data.email           || '').trim();
  var phone          = (data.phone           || '').trim() || null;
  var organization   = (data.organization    || '').trim() || null;
  var serviceType    = (data.service_type    || '').trim();
  var projectScope   = (data.project_scope   || '').trim();
  var budgetRange    = (data.budget_range    || '').trim() || null;
  var timeline       = (data.timeline        || '').trim() || null;
  var additionalInfo = (data.additional_info || '').trim() || null;

  // ── Server-side validation ───────────────────────────
  var validationErrors = [];

  if (!fullName)
    validationErrors.push('Full name is required.');
  if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0)
    validationErrors.push('A valid email address is required.');
  if (!serviceType || !VALID_SERVICE_TYPES.includes(serviceType))
    validationErrors.push('A valid service type is required.');
  if (budgetRange && !VALID_BUDGET_RANGES.includes(budgetRange))
    validationErrors.push('Invalid budget range selected.');
  if (timeline && !VALID_TIMELINES.includes(timeline))
    validationErrors.push('Invalid timeline selected.');

  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: validationErrors.join(' ') })
    };
  }

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── STEP 1: Insert into studio_inquiries table ───────
  var inquiryPayload = {
    full_name:       fullName,
    email:           email,
    phone:           phone,
    organization:    organization,
    service_type:    serviceType,
    project_scope:   projectScope || null,
    budget_range:    budgetRange,
    timeline:        timeline,
    additional_info: additionalInfo,
    status:          'new'
  };

  console.log('Inserting studio inquiry for:', email, '| service:', serviceType);

  var insertResponse;
  try {
    insertResponse = await fetch(
      SB_URL + '/rest/v1/studio_inquiries',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=representation'
        },
        body: JSON.stringify(inquiryPayload)
      }
    );
  } catch (networkError) {
    console.error('Studio inquiry insert network error:', networkError);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save your inquiry. Please try again or contact us at hello@technuvate.com'
      })
    };
  }

  if (!insertResponse.ok) {
    var insertErrorText = await insertResponse.text();
    console.error('Studio inquiry insert failed:', insertResponse.status, insertErrorText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save your inquiry. Please try again or contact us at hello@technuvate.com'
      })
    };
  }

  var insertRows;
  try {
    insertRows = await insertResponse.json();
  } catch (parseError) {
    insertRows = [];
  }

  var inquiryId = insertRows && insertRows[0] ? insertRows[0].id : null;
  console.log('Studio inquiry saved. id:', inquiryId);

  // ── STEP 2A: Admin notification email ────────────────
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:     process.env.RESEND_SENDER_EMAIL,
        to:       [process.env.CONTACT_RECEIVER_EMAIL],
        reply_to: email,
        subject:  'New Studio Inquiry — ' + serviceType + ': ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Studio Project Inquiry</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          (phone        ? '<p><strong>Phone:</strong> '        + phone        + '</p>' : '') +
          (organization ? '<p><strong>Organisation:</strong> ' + organization + '</p>' : '') +
          '<p><strong>Service Type:</strong> '  + serviceType  + '</p>' +
          (budgetRange  ? '<p><strong>Budget:</strong> '       + budgetRange  + '</p>' : '') +
          (timeline     ? '<p><strong>Timeline:</strong> '     + timeline     + '</p>' : '') +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>Project Scope:</strong></p>' +
          '<p style="color:#6B7280;white-space:pre-wrap">' + projectScope + '</p>' +
          (additionalInfo
            ? '<p><strong>Additional Information:</strong></p>' +
              '<p style="color:#6B7280;white-space:pre-wrap">' + additionalInfo + '</p>'
            : '') +
          '</div>'
      })
    });
  } catch (adminEmailError) {
    console.error('Admin studio inquiry email failed:', adminEmailError);
  }

  // ── STEP 2B: Client confirmation email ───────────────
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    process.env.RESEND_SENDER_EMAIL,
        to:      [email],
        subject: 'We received your studio project inquiry — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Thanks for reaching out, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>We have received your inquiry for <strong>' + serviceType + '</strong> and our studio team will review it shortly.</p>' +
          '<p>We typically respond within 24 – 48 hours. In the meantime, feel free to browse our previous work on the studio page.</p>' +
          (budgetRange ? '<p><strong>Budget range noted:</strong> ' + budgetRange + '</p>' : '') +
          (timeline    ? '<p><strong>Timeline noted:</strong> '     + timeline    + '</p>' : '') +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or reach us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (clientEmailError) {
    console.error('Client studio inquiry email failed:', clientEmailError);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:    true,
      inquiry_id: inquiryId,
      service:    serviceType
    })
  };
};