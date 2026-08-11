// netlify/functions/join-team.js
// Receives team member application from frontend
// Validates server-side
// Inserts into team_members table in Supabase
// Sends admin notification email via Resend
// Sends applicant confirmation email via Resend
// Returns { success: true } to frontend
// No payment involved — this is a free application

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const VALID_ROLES = [
  'Communications and Content Associate',
  'Operations and Coordination Associate',
  'Community and Growth Associate',
  'Partnerships and Outreach Associate',
  'Product and Graphics Designer',
  'Data Analytics Associate'
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
  } catch (e) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // ── Extract and trim all fields ──────────────────────
  var fullName          = (data.full_name          || '').trim();
  var email             = (data.email              || '').trim();
  var phone             = (data.phone              || '').trim();
  var gender            = (data.gender             || '').trim();
  var ageRange          = (data.age_range          || '').trim();
  var linkedin          = (data.linkedin           || '').trim();
  var roleApplied       = (data.role_applied       || '').trim();
  var currentOccupation = (data.current_occupation || '').trim();
  var experienceLevel   = (data.experience_level   || '').trim();
  var whyJoin           = (data.why_join           || '').trim();
  var relevantSkills    = (data.relevant_skills    || '').trim();
  var weeklyHours       = (data.weekly_hours       || '').trim();
  var mobileNetwork     = (data.mobile_network     || '').trim() || null;
  var dataTopupPhone    = (data.data_topup_phone   || '').trim() || null;

  // ── Server-side validation ───────────────────────────
  var errors = [];

  if (!fullName)
    errors.push('Full name is required.');
  if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0)
    errors.push('A valid email address is required.');
  if (!phone)
    errors.push('Phone number is required.');
  if (!gender)
    errors.push('Gender is required.');
  if (!ageRange)
    errors.push('Age range is required.');
  if (!linkedin)
    errors.push('LinkedIn profile URL is required.');
  if (!roleApplied || !VALID_ROLES.includes(roleApplied))
    errors.push('A valid role selection is required.');
  if (!currentOccupation)
    errors.push('Current occupation is required.');
  if (!experienceLevel)
    errors.push('Experience level is required.');
  if (!whyJoin)
    errors.push('Please tell us why you want to join.');
  if (!relevantSkills)
    errors.push('Please tell us about your relevant skills.');
  if (!weeklyHours)
    errors.push('Weekly commitment is required.');

  if (errors.length > 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: errors.join(' ') })
    };
  }

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── STEP 1: Check for duplicate email ───────────────
  try {
    var dupCheck = await fetch(
      SB_URL + '/rest/v1/team_members?email=eq.' + encodeURIComponent(email) + '&select=id,status',
      {
        method: 'GET',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    var dupData = await dupCheck.json();
    if (Array.isArray(dupData) && dupData.length > 0) {
      console.log('Duplicate application detected for email:', email);
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'An application from this email address already exists. If you need to update your application, please contact us at hello@technuvate.com'
        })
      };
    }
  } catch (dupErr) {
    console.error('Duplicate check error:', dupErr);
  }

  // ── STEP 2: Insert into team_members table ───────────
  var memberPayload = {
    full_name:          fullName,
    email:              email,
    phone:              phone,
    gender:             gender,
    age_range:          ageRange,
    linkedin:           linkedin,
    role_applied:       roleApplied,
    current_occupation: currentOccupation,
    experience_level:   experienceLevel,
    why_join:           whyJoin,
    relevant_skills:    relevantSkills,
    weekly_hours:       weeklyHours,
    mobile_network:     mobileNetwork,
    data_topup_phone:   dataTopupPhone,
    status:             'applied'
  };

  console.log('Inserting team member application for:', email, '| role:', roleApplied);

  var insertResponse;
  try {
    insertResponse = await fetch(
      SB_URL + '/rest/v1/team_members',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=representation'
        },
        body: JSON.stringify(memberPayload)
      }
    );
  } catch (insertErr) {
    console.error('Team members insert network error:', insertErr);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to save your application. Please try again or contact us at hello@technuvate.com' })
    };
  }

  if (!insertResponse.ok) {
    var insertErrText = await insertResponse.text();
    console.error('Team members insert failed:', insertResponse.status, insertErrText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to save your application. Please try again or contact us at hello@technuvate.com' })
    };
  }

  var insertRows;
  try {
    insertRows = await insertResponse.json();
  } catch (e) {
    insertRows = [];
  }

  var memberId = insertRows && insertRows[0] ? insertRows[0].id : null;
  console.log('Team member application saved. id:', memberId);

  // ── STEP 3A: Admin notification email ────────────────
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
        subject:  'New Team Application — ' + roleApplied + ': ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Team Member Application</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          '<p><strong>Phone:</strong> ' + phone + '</p>' +
          '<p><strong>Role Applied:</strong> ' + roleApplied + '</p>' +
          '<p><strong>Current Occupation:</strong> ' + currentOccupation + '</p>' +
          '<p><strong>Experience Level:</strong> ' + experienceLevel + '</p>' +
          '<p><strong>Weekly Commitment:</strong> ' + weeklyHours + '</p>' +
          '<p><strong>LinkedIn:</strong> <a href="' + linkedin + '">' + linkedin + '</a></p>' +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>Why they want to join:</strong></p>' +
          '<p style="color:#6B7280">' + whyJoin + '</p>' +
          '<p><strong>Relevant skills:</strong></p>' +
          '<p style="color:#6B7280">' + relevantSkills + '</p>' +
          '</div>'
      })
    });
  } catch (adminEmailErr) {
    console.error('Admin team application email failed:', adminEmailErr);
  }

  // ── STEP 3B: Applicant confirmation email ────────────
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
        subject: 'We received your application — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Application Received, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>Thank you for applying to join the TechNuVate team as a <strong>' + roleApplied + '</strong>.</p>' +
          '<p>We have received your application and our team will review it shortly. If your profile is a good match we will be in touch within 7 working days.</p>' +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or reach us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (appEmailErr) {
    console.error('Applicant team email failed:', appEmailErr);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:   true,
      member_id: memberId,
      role:      roleApplied
    })
  };
};