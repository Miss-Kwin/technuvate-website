// netlify/functions/submit-labs-it.js
// Single-trip handler for Labs IT application
// Receives multipart/FormData containing all form fields
// and three file uploads (it_letter, school_id, passport)
// Uploads files to Netlify Blobs
// Inserts application into lab_it_applications table
// Inserts payment record into payments table
// Sends admin and applicant confirmation emails
// No separate verify step needed — payment handled separately

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PRICES = { NGN: 5000, USD: 3 };
const VALID_CURRENCIES = ['NGN', 'USD'];

// ── Cloudinary upload helper (server-side, signed) ───
// Files are uploaded from the Netlify function server
// directly to Cloudinary. Credentials stay server-side.
// Returns the permanent secure_url from Cloudinary.
async function uploadFileToCloudinary(fileBuffer, fileName, mimeType) {
  var cloudName    = process.env.CLOUDINARY_CLOUD_NAME;
  var uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables are not set.');
  }

  var uploadFormData = new FormData();
  uploadFormData.append(
    'file',
    new Blob([fileBuffer], { type: mimeType }),
    fileName
  );
  uploadFormData.append('upload_preset', uploadPreset);
  uploadFormData.append('folder', 'lab-it-documents');

  var cloudinaryResponse = await fetch(
    'https://api.cloudinary.com/v1_1/' + cloudName + '/auto/upload',
    {
      method: 'POST',
      body:   uploadFormData
    }
  );

  if (!cloudinaryResponse.ok) {
    var cloudinaryError = await cloudinaryResponse.text();
    throw new Error('Cloudinary upload failed: ' + cloudinaryError);
  }

  var cloudinaryData = await cloudinaryResponse.json();
  return cloudinaryData.secure_url;
}

// ── Minimal multipart/form-data parser ───────────────────
function parseMultipart(body, boundary) {
  var parts = [];
  var boundaryBuffer = '--' + boundary;
  var segments = body.split(boundaryBuffer);
  for (var i = 1; i < segments.length - 1; i++) {
    var segment = segments[i];
    var headerBodySplit = segment.indexOf('\r\n\r\n');
    if (headerBodySplit === -1) continue;
    var headerSection = segment.substring(0, headerBodySplit);
    var bodySection   = segment.substring(headerBodySplit + 4);
    if (bodySection.endsWith('\r\n')) {
      bodySection = bodySection.slice(0, -2);
    }
    var nameMatch = headerSection.match(/name="([^"]+)"/);
    var fileMatch = headerSection.match(/filename="([^"]+)"/);
    var typeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
    if (!nameMatch) continue;
    parts.push({
      name:        nameMatch[1],
      filename:    fileMatch  ? fileMatch[1]  : null,
      contentType: typeMatch  ? typeMatch[1].trim() : 'application/octet-stream',
      data:        bodySection
    });
  }
  return parts;
}

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

  // ── Parse multipart body ─────────────────────────────
  var contentType = event.headers['content-type'] || '';
  var boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing multipart boundary' })
    };
  }

  var rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('binary')
    : event.body;

  var parts = parseMultipart(rawBody, boundaryMatch[1]);

  // ── Extract text fields and files ────────────────────
  var fields = {};
  var files  = {};

  parts.forEach(function (part) {
    if (part.filename) {
      files[part.name] = part;
    } else {
      fields[part.name] = part.data.trim();
    }
  });

  // ── Extract and trim all text fields ─────────────────
  var fullName         = (fields.full_name          || '').trim();
  var email            = (fields.email              || '').trim();
  var phone            = (fields.phone              || '').trim();
  var gender           = (fields.gender             || '').trim();
  var ageRange         = (fields.age_range          || '').trim();
  var stateOfResidence = (fields.state_of_residence || '').trim();
  var city             = (fields.city               || '').trim();
  var schoolName       = (fields.school_name        || '').trim();
  var institutionType  = (fields.institution_type   || '').trim();
  var courseOfStudy    = (fields.course_of_study    || '').trim();
  var currentLevel     = (fields.current_level      || '').trim();
  var itStartDate      = (fields.it_start_date      || '').trim();
  var itDuration       = (fields.it_duration        || '').trim();
  var supervisorName   = (fields.supervisor_name    || '').trim() || null;
  var supervisorEmail  = (fields.supervisor_email   || '').trim() || null;
  var naturalStrength  = (fields.natural_strength   || '').trim();
  var peopleComfort    = (fields.people_comfort     || '').trim();
  var toolsFamiliar    = (fields.tools_familiar     || '').trim();
  var whyTechnuvate    = (fields.why_technuvate     || '').trim();
  var commitment       = fields.commitment_confirmed === 'true';
  var currency         = (fields.currency           || 'NGN').toUpperCase().trim();
  var flwTxRef         = (fields.flw_tx_ref         || '').trim();
  var flwTxId          = (fields.flw_tx_id          || '').trim();

  // ── Server-side validation ────────────────────────────
  var validationErrors = [];
  if (!fullName)         validationErrors.push('Full name is required.');
  if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0)
    validationErrors.push('A valid email address is required.');
  if (!phone)            validationErrors.push('Phone number is required.');
  if (!gender)           validationErrors.push('Gender is required.');
  if (!ageRange)         validationErrors.push('Age range is required.');
  if (!stateOfResidence) validationErrors.push('State of residence is required.');
  if (!city)             validationErrors.push('City is required.');
  if (!schoolName)       validationErrors.push('School name is required.');
  if (!institutionType)  validationErrors.push('Institution type is required.');
  if (!courseOfStudy)    validationErrors.push('Course of study is required.');
  if (!currentLevel)     validationErrors.push('Current level is required.');
  if (!itStartDate)      validationErrors.push('Expected IT start date is required.');
  if (!itDuration)       validationErrors.push('IT duration is required.');
  if (!naturalStrength)  validationErrors.push('Natural strength selection is required.');
  if (!peopleComfort)    validationErrors.push('People comfort level is required.');
  if (!toolsFamiliar)    validationErrors.push('Tools familiarity is required.');
  if (!whyTechnuvate)    validationErrors.push('Motivation for applying is required.');
  if (!commitment)       validationErrors.push('You must confirm the commitment acknowledgment.');
  if (!flwTxRef)         validationErrors.push('Payment reference is required.');
  if (!flwTxId)          validationErrors.push('Payment transaction ID is required.');
  if (!VALID_CURRENCIES.includes(currency))
    validationErrors.push('Currency must be NGN or USD.');
  if (!files.it_letter)  validationErrors.push('IT request letter is required.');
  if (!files.school_id)  validationErrors.push('School ID or admission letter is required.');
  if (!files.passport)   validationErrors.push('Passport photograph is required.');

  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: validationErrors.join(' ') })
    };
  }

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── STEP 1: Idempotency check ─────────────────────────
  try {
    var dupCheck = await fetch(
      SB_URL + '/rest/v1/lab_it_applications?flw_tx_ref=eq.' +
        encodeURIComponent(flwTxRef) + '&select=id',
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
      console.log('Duplicate labs IT application:', flwTxRef);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, duplicate: true })
      };
    }
  } catch (dupError) {
    console.error('Duplicate check error:', dupError);
  }

  // ── STEP 2: Upload files to Cloudinary ───────────────
  // Files arrive as binary string data from the multipart 
  // parser. Convert to Buffer then upload to Cloudinary.
  // Cloudinary returns a permanent secure_url for each file.
  var itLetterUrl = null;
  var schoolIdUrl = null;
  var passportUrl = null;

  try {
    console.log('Uploading documents to Cloudinary...');

    var itLetterBuffer = Buffer.from(files.it_letter.data, 'binary');
    var schoolIdBuffer = Buffer.from(files.school_id.data, 'binary');
    var passportBuffer = Buffer.from(files.passport.data,  'binary');

    var uploadResults = await Promise.all([
      uploadFileToCloudinary(
        itLetterBuffer,
        files.it_letter.filename || 'it_letter',
        files.it_letter.contentType
      ),
      uploadFileToCloudinary(
        schoolIdBuffer,
        files.school_id.filename || 'school_id',
        files.school_id.contentType
      ),
      uploadFileToCloudinary(
        passportBuffer,
        files.passport.filename  || 'passport',
        files.passport.contentType
      )
    ]);

    itLetterUrl = uploadResults[0];
    schoolIdUrl = uploadResults[1];
    passportUrl = uploadResults[2];

    console.log('All documents uploaded to Cloudinary successfully.');
  } catch (cloudinaryError) {
    console.error('Cloudinary upload error:', cloudinaryError);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to upload your documents. Please try again or contact support.'
      })
    };
  }

  // ── STEP 3: Insert into lab_it_applications ───────────
  var amount = PRICES[currency];

  var applicationPayload = {
    flw_tx_ref:           flwTxRef,
    full_name:            fullName,
    email:                email,
    phone:                phone,
    gender:               gender,
    age_range:            ageRange,
    state_of_residence:   stateOfResidence,
    city:                 city,
    school_name:          schoolName,
    institution_type:     institutionType,
    course_of_study:      courseOfStudy,
    current_level:        currentLevel,
    it_start_date:        itStartDate,
    it_duration:          itDuration,
    supervisor_name:      supervisorName,
    supervisor_email:     supervisorEmail,
    natural_strength:     naturalStrength,
    people_comfort:       peopleComfort,
    tools_familiar:       toolsFamiliar,
    why_technuvate:       whyTechnuvate,
    it_letter_url:        itLetterUrl,
    school_id_url:        schoolIdUrl,
    passport_url:         passportUrl,
    commitment_confirmed: commitment,
    status:               'applied'
  };

  console.log('Inserting labs IT application for:', email);

  var insertResponse;
  try {
    insertResponse = await fetch(
      SB_URL + '/rest/v1/lab_it_applications',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=representation'
        },
        body: JSON.stringify(applicationPayload)
      }
    );
  } catch (insertNetworkError) {
    console.error('Labs IT insert network error:', insertNetworkError);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save application. Payment was received — contact support with ref: ' + flwTxRef
      })
    };
  }

  if (!insertResponse.ok) {
    var insertErrorText = await insertResponse.text();
    console.error('Labs IT insert failed:', insertResponse.status, insertErrorText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save application. Payment was received — contact support with ref: ' + flwTxRef
      })
    };
  }

  var insertRows;
  try { insertRows = await insertResponse.json(); }
  catch (e) { insertRows = []; }

  var applicationId = insertRows && insertRows[0] ? insertRows[0].id : null;
  console.log('Labs IT application saved. id:', applicationId);

  // ── STEP 4: Insert into payments table ───────────────
  var ipAddress = (
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] || null
  );

  try {
    var paymentInsert = await fetch(SB_URL + '/rest/v1/payments', {
      method: 'POST',
      headers: {
        apikey:         SB_KEY,
        Authorization:  'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal'
      },
      body: JSON.stringify({
        amount:             amount,
        currency:           currency,
        flw_tx_ref:         flwTxRef,
        flw_tx_id:          flwTxId,
        payment_status:     'successful',
        payment_purpose:    'labs_it',
        payment_purpose_id: applicationId,
        payer_name:         fullName,
        payer_email:        email,
        ip_address:         ipAddress
      })
    });
    if (!paymentInsert.ok) {
      console.error('Payments insert failed:', await paymentInsert.text());
    } else {
      console.log('Payment record saved.');
    }
  } catch (paymentError) {
    console.error('Payments insert network error:', paymentError);
  }

  // ── STEP 5A: Admin notification email ────────────────
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
        subject:  'New Labs IT Application — ' + schoolName + ': ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Labs IT Application</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          '<p><strong>Phone:</strong> ' + phone + '</p>' +
          '<p><strong>School:</strong> ' + schoolName + '</p>' +
          '<p><strong>Institution Type:</strong> ' + institutionType + '</p>' +
          '<p><strong>Course:</strong> ' + courseOfStudy + '</p>' +
          '<p><strong>Level:</strong> ' + currentLevel + '</p>' +
          '<p><strong>IT Start Date:</strong> ' + itStartDate + '</p>' +
          '<p><strong>IT Duration:</strong> ' + itDuration + '</p>' +
          '<p><strong>State:</strong> ' + stateOfResidence + ', ' + city + '</p>' +
          (supervisorName ? '<p><strong>Supervisor:</strong> ' + supervisorName +
            (supervisorEmail ? ' — ' + supervisorEmail : '') + '</p>' : '') +
          '<p><strong>Amount Paid:</strong> ' + currency + ' ' + amount + '</p>' +
          '<p><strong>Transaction Ref:</strong> ' + flwTxRef + '</p>' +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>Natural Strength:</strong> ' + naturalStrength + '</p>' +
          '<p><strong>People Comfort:</strong> ' + peopleComfort + '</p>' +
          '<p><strong>Tools Familiar:</strong></p><p style="color:#6B7280">' + toolsFamiliar + '</p>' +
          '<p><strong>Why TechNuVate:</strong></p><p style="color:#6B7280">' + whyTechnuvate + '</p>' +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>Documents:</strong></p>' +
          '<p><a href="' + itLetterUrl + '">IT Request Letter</a></p>' +
          '<p><a href="' + schoolIdUrl + '">School ID / Admission Letter</a></p>' +
          '<p><a href="' + passportUrl + '">Passport Photograph</a></p>' +
          '</div>'
      })
    });
  } catch (adminEmailError) {
    console.error('Admin labs IT email failed:', adminEmailError);
  }

  // ── STEP 5B: Applicant confirmation email ─────────────
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
        subject: 'Your Labs IT application — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Application Received, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>Your application for the <strong>TechNuVate Labs Industrial Training</strong> programme is confirmed.</p>' +
          '<p><strong>School:</strong> ' + schoolName + '</p>' +
          '<p><strong>IT Start Date:</strong> ' + itStartDate + '</p>' +
          '<p><strong>IT Duration:</strong> ' + itDuration + '</p>' +
          '<p>Our team will review your application and reach out within 5 working days.</p>' +
          '<p style="color:#6B7280;font-size:12px">Transaction reference: ' + flwTxRef + '</p>' +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or contact us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (applicantEmailError) {
    console.error('Applicant labs IT email failed:', applicantEmailError);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:        true,
      application_id: applicationId,
      flw_tx_ref:     flwTxRef
    })
  };
};