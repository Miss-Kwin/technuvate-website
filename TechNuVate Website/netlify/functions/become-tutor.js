// netlify/functions/become-tutor.js
// Receives tutor application form data from frontend
// Validates server-side
// Checks for duplicate email
// Inserts into tutor_members table in Supabase
// Sends admin notification email via Resend
// Sends applicant confirmation email via Resend
// Returns { success: true } to frontend
// No payment involved — this is a free application

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const VALID_SUBJECTS = [
  'Digital Marketing',
  'Product Design (UI/UX)',
  'Product Management',
  'Data Analytics',
  'Graphics Design',
  'Video Editing and Content Production',
  'Social Media Marketing',
  'Community Building and Management',
  'Other'
];

const VALID_EXPERIENCE = [
  '1 to 2 years',
  '3 to 5 years',
  '6 to 10 years',
  'Over 10 years'
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
  var country           = (data.country            || '').trim();
  var stateRegion       = (data.state_region       || '').trim() || null;
  var linkedin          = (data.linkedin           || '').trim();
  var subjectTrack      = (data.subject_track      || '').trim();
  var teachingExp       = (data.teaching_experience|| '').trim();
  var currentOccupation = (data.current_occupation || '').trim();
  var skillLevel        = (data.skill_level        || '').trim();
  var whyTutor          = (data.why_tutor          || '').trim();
  var availability      = (data.availability       || '').trim();
  var toolComfort       = (data.tool_comfort       || '').trim();
  var portfolioUrl   = (data.portfolio_url   || '').trim() || null;
  var biography      = (data.biography       || '').trim();
  var weeklyHours    = (data.weekly_hours    || '').trim() || null;
  var mobileNetwork  = (data.mobile_network  || '').trim() || null;
  var dataTopupPhone = (data.data_topup_phone|| '').trim() || null;

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
  if (!country)
    errors.push('Country is required.');
  if (!linkedin)
    errors.push('LinkedIn profile URL is required.');
  if (!subjectTrack || !VALID_SUBJECTS.includes(subjectTrack))
    errors.push('A valid subject track is required.');
  if (!teachingExp || !VALID_EXPERIENCE.includes(teachingExp))
    errors.push('Teaching experience is required.');
  if (!biography)
    errors.push('Please tell us about yourself.');

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
      SB_URL + '/rest/v1/tutor_members?email=eq.' + encodeURIComponent(email) + '&select=id,status',
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
      console.log('Duplicate tutor application for email:', email);
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'An application from this email already exists. To update your application contact us at hello@technuvate.com'
        })
      };
    }
  } catch (dupErr) {
    console.error('Duplicate check error:', dupErr);
  }

  // ── STEP 2: Insert into tutor_members table ──────────
  var tutorPayload = {
    full_name:           fullName,
    email:               email,
    phone:               phone,
    gender:              gender,
    age_range:           ageRange,
    country:             country,
    state_region:        stateRegion,
    linkedin:            linkedin,
    subject_track:       subjectTrack,
    portfolio_url:       portfolioUrl,
    teaching_experience: teachingExp,
    biography:           biography,
    weekly_hours:        weeklyHours,
    mobile_network:      mobileNetwork,
    data_topup_phone:    dataTopupPhone,
    status:              'applied'
  };

  console.log('Inserting tutor application for:', email, '| subject:', subjectTrack);

  var insertResponse;
  try {
    insertResponse = await fetch(
      SB_URL + '/rest/v1/tutor_members',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=representation'
        },
        body: JSON.stringify(tutorPayload)
      }
    );
  } catch (insertErr) {
    console.error('Tutor members insert network error:', insertErr);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save your application. Please try again or contact us at hello@technuvate.com'
      })
    };
  }

  if (!insertResponse.ok) {
    var insertErrText = await insertResponse.text();
    console.error('Tutor members insert failed:', insertResponse.status, insertErrText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save your application. Please try again or contact us at hello@technuvate.com'
      })
    };
  }

  var insertRows;
  try {
    insertRows = await insertResponse.json();
  } catch (e) {
    insertRows = [];
  }

  var tutorId = insertRows && insertRows[0] ? insertRows[0].id : null;
  console.log('Tutor application saved. id:', tutorId);

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
        subject:  'New Tutor Application — ' + subjectTrack + ': ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Tutor Application</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          '<p><strong>Phone:</strong> ' + phone + '</p>' +
          '<p><strong>Subject Track:</strong> ' + subjectTrack + '</p>' +
          '<p><strong>Teaching Experience:</strong> ' + teachingExp + '</p>' +
          '<p><strong>Weekly Hours:</strong> ' + (weeklyHours || 'Not specified') + '</p>' +
          (portfolioUrl ? '<p><strong>Portfolio:</strong> <a href="' + portfolioUrl + '">' + portfolioUrl + '</a></p>' : '') +
          '<p><strong>Country:</strong> ' + country + (stateRegion ? ', ' + stateRegion : '') + '</p>' +
          '<p><strong>LinkedIn:</strong> <a href="' + linkedin + '">' + linkedin + '</a></p>' +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>About this applicant:</strong></p>' +
          '<p style="color:#6B7280">' + biography + '</p>' +
          '</div>'
      })
    });
  } catch (adminEmailErr) {
    console.error('Admin tutor application email failed:', adminEmailErr);
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
        subject: 'Your tutor application — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Application Received, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>Thank you for applying to become a tutor at TechNuVate for <strong>' + subjectTrack + '</strong>.</p>' +
          '<p>We have received your application and our team will review it carefully. If your profile is a good match we will reach out within 7 working days.</p>' +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or reach us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (appEmailErr) {
    console.error('Applicant tutor email failed:', appEmailErr);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:  true,
      tutor_id: tutorId,
      subject:  subjectTrack
    })
  };
};
