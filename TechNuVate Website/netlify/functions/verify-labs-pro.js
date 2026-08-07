// netlify/functions/verify-labs-pro.js
// Called by frontend after Flutterwave payment callback
// Verifies payment via Flutterwave API (skipped in test mode)
// Inserts into labs_pro_applications table
// Inserts into payments table using application id
// Sends admin and applicant confirmation emails
// Returns { success: true } to frontend

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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

  var flwTxRef = (data.flw_tx_ref || '').trim();
  var flwTxId  = String(data.flw_tx_id || '').trim();

  if (!flwTxRef || !flwTxId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'flw_tx_ref and flw_tx_id are required.' })
    };
  }

  // ── Extract application fields ───────────────────────
  var fullName      = (data.full_name      || '').trim();
  var email         = (data.email          || '').trim();
  var phone         = (data.phone          || '').trim();
  var gender        = (data.gender         || '').trim();
  var ageRange      = (data.age_range      || '').trim();
  var country       = (data.country        || '').trim();
  var stateRegion   = (data.state_region   || '').trim() || null;
  var skillTrack    = (data.skill_track    || '').trim();
  var background    = (data.background     || '').trim();
  var academyCohort = (data.academy_cohort || '').trim() || null;
  var experience    = (data.experience     || '').trim();
  var goal          = (data.goal           || '').trim();
  var linkedin      = (data.linkedin       || '').trim();
  var commitment    = data.commitment_confirmed === true;
  var amount        = parseFloat(data.amount)   || 0;
  var currency      = (data.currency       || 'NGN').toUpperCase();

  var ipAddress = (
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    null
  );

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── TEST MODE ────────────────────────────────────────
  var isTestMode = process.env.DONATION_TEST_MODE === 'true';
  console.log('isTestMode:', isTestMode, '| flwTxRef:', flwTxRef);

  // ── STEP 1: Verify payment with Flutterwave ──────────
  if (!isTestMode) {
    var verifyResponse;
    try {
      verifyResponse = await fetch(
        'https://api.flutterwave.com/v3/transactions/' + flwTxId + '/verify',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + process.env.FLW_SECRET_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (networkErr) {
      console.error('Flutterwave verify network error:', networkErr);
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Payment verification network error. Please contact support.' })
      };
    }

    var verifyData;
    try {
      verifyData = await verifyResponse.json();
    } catch (parseErr) {
      console.error('Flutterwave verify parse error:', parseErr);
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Payment verification response error.' })
      };
    }

    if (
      !verifyData ||
      verifyData.status !== 'success' ||
      !verifyData.data ||
      verifyData.data.status !== 'successful'
    ) {
      console.error('Payment not verified:', JSON.stringify(verifyData));
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Payment could not be verified. No records created.' })
      };
    }

    var verified = verifyData.data;
    amount   = verified.amount;
    currency = verified.currency;
  }

  // ── STEP 2A: Idempotency check ───────────────────────
  try {
    var dupCheck = await fetch(
      SB_URL + '/rest/v1/labs_pro_applications?flw_tx_ref=eq.' + encodeURIComponent(flwTxRef) + '&select=id',
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
      console.log('Duplicate labs pro application detected:', flwTxRef);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, duplicate: true })
      };
    }
  } catch (dupErr) {
    console.error('Duplicate check error:', dupErr);
  }

  // ── STEP 2B: Insert into labs_pro_applications ───────
  var applicationPayload = {
    flw_tx_ref:           flwTxRef,
    full_name:            fullName,
    email:                email,
    phone:                phone,
    gender:               gender,
    age_range:            ageRange,
    country:              country,
    state_region:         stateRegion,
    skill_track:          skillTrack,
    background:           background,
    academy_cohort:       academyCohort,
    experience:           experience,
    goal:                 goal,
    linkedin:             linkedin,
    commitment_confirmed: commitment,
    status:               'applied'
  };

  console.log('Inserting labs pro payload:', JSON.stringify(applicationPayload));

  var appInsertResponse;
  try {
    appInsertResponse = await fetch(
      SB_URL + '/rest/v1/labs_pro_applications',
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
  } catch (appErr) {
    console.error('Labs pro insert network error:', appErr);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save application. Payment was successful — contact support with ref: ' + flwTxRef
      })
    };
  }

  if (!appInsertResponse.ok) {
    var appErrText = await appInsertResponse.text();
    console.error('Labs pro insert failed:', appInsertResponse.status, appErrText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save application. Payment was successful — contact support with ref: ' + flwTxRef
      })
    };
  }

  var appRows;
  try {
    appRows = await appInsertResponse.json();
  } catch (e) {
    appRows = [];
  }

  var applicationId = appRows && appRows[0] ? appRows[0].id : null;
  console.log('Labs pro application saved. id:', applicationId);

  // ── STEP 2C: Insert into payments table ─────────────
  var paymentPayload = {
    amount:             amount,
    currency:           currency,
    flw_tx_ref:         flwTxRef,
    flw_tx_id:          flwTxId,
    payment_status:     'successful',
    payment_purpose:    'labs_pro',
    payment_purpose_id: applicationId,
    payer_name:         fullName,
    payer_email:        email,
    ip_address:         ipAddress
  };

  try {
    var paymentInsertResponse = await fetch(
      SB_URL + '/rest/v1/payments',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal'
        },
        body: JSON.stringify(paymentPayload)
      }
    );
    if (!paymentInsertResponse.ok) {
      var payErrText = await paymentInsertResponse.text();
      console.error('Payments insert failed:', paymentInsertResponse.status, payErrText);
    } else {
      console.log('Payment record saved.');
    }
  } catch (payErr) {
    console.error('Payments insert network error:', payErr);
  }

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
        subject:  'New Labs Pro Application — ' + skillTrack + ': ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Labs Professional Track Application</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          '<p><strong>Phone:</strong> ' + phone + '</p>' +
          '<p><strong>Skill Track:</strong> ' + skillTrack + '</p>' +
          '<p><strong>Background:</strong> ' + background + '</p>' +
          '<p><strong>Country:</strong> ' + country + (stateRegion ? ', ' + stateRegion : '') + '</p>' +
          '<p><strong>LinkedIn:</strong> ' + linkedin + '</p>' +
          '<p><strong>Amount:</strong> ' + currency + ' ' + amount + '</p>' +
          '<p><strong>Transaction Ref:</strong> ' + flwTxRef + '</p>' +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          '<p><strong>Skill Level:</strong></p>' +
          '<p style="color:#6B7280">' + experience + '</p>' +
          '<p><strong>Goal:</strong></p>' +
          '<p style="color:#6B7280">' + goal + '</p>' +
          '</div>'
      })
    });
  } catch (adminEmailErr) {
    console.error('Admin labs pro email failed:', adminEmailErr);
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
        subject: 'Your Labs Professional Track application — TechNuVate',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Application Received, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>Your payment for the <strong>TechNuVate Labs Professional Track</strong> has been received and your spot is secured.</p>' +
          '<p><strong>Skill Track:</strong> ' + skillTrack + '</p>' +
          '<p><strong>Amount paid:</strong> ' + currency + ' ' + amount + '</p>' +
          '<p>Your mentor will be assigned and your first project brief will arrive within 48 hours. Watch your inbox.</p>' +
          '<p style="color:#6B7280;font-size:12px">Transaction reference: ' + flwTxRef + '</p>' +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or contact us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (appEmailErr) {
    console.error('Applicant labs pro email failed:', appEmailErr);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:        true,
      flw_tx_ref:     flwTxRef,
      application_id: applicationId,
      skill_track:    skillTrack,
      amount:         amount,
      currency:       currency
    })
  };
};