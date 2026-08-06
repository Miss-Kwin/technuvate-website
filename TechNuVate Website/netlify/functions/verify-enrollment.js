// netlify/functions/verify-enrollment.js
// Called by frontend after Flutterwave payment callback
// Verifies payment via Flutterwave API (skipped in test mode)
// Inserts into enrollments table → gets enrollment id
// Inserts into payments table using enrollment id
// Sends admin and student confirmation emails
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
  var flwTxId  = String(data.flw_tx_id  || '').trim();

  if (!flwTxRef || !flwTxId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'flw_tx_ref and flw_tx_id are required.' })
    };
  }

  // ── Extract enrollment fields ──────────────────────
  var fullName     = (data.full_name     || '').trim();
  var email        = (data.email         || '').trim();
  var phone        = (data.phone         || '').trim();
  var gender       = (data.gender        || '').trim();
  var ageRange     = (data.age_range     || '').trim();
  var country      = (data.country       || '').trim();
  var state        = (data.state         || '').trim() || null;
  var course       = (data.course        || '').trim();
  var pricingTier  = (data.pricing_tier  || '').trim();
  var partnerCode  = (data.partner_code  || '').trim() || null;
  var cohort       = (data.cohort        || '').trim() || null;
  var commitment   = data.commitment_confirmed === true;
  var amount       = parseFloat(data.amount)   || 0;
  var currency     = (data.currency      || 'NGN').toUpperCase();

  var ipAddress = (
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    null
  );

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── TEST MODE ─────────────────────────────────────
  var isTestMode = process.env.DONATION_TEST_MODE === 'true';
  console.log('isTestMode:', isTestMode, '| flwTxRef:', flwTxRef, '| flwTxId:', flwTxId);

  // ── STEP 1: Verify payment with Flutterwave ───────
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

  // ── STEP 2A: Idempotency check ────────────────────
  try {
    var dupCheck = await fetch(
      SB_URL + '/rest/v1/enrollments?flw_tx_ref=eq.' + encodeURIComponent(flwTxRef) + '&select=id',
      {
        method: 'GET',
        headers: {
          apikey: SB_KEY,
          Authorization: 'Bearer ' + SB_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    var dupData = await dupCheck.json();
    if (Array.isArray(dupData) && dupData.length > 0) {
      console.log('Duplicate enrollment detected for flw_tx_ref:', flwTxRef);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, duplicate: true })
      };
    }
  } catch (dupErr) {
    console.error('Duplicate check error:', dupErr);
  }

  // ── STEP 2B: Insert into enrollments table ────────
  var enrollmentPayload = {
    flw_tx_ref:           flwTxRef,
    full_name:            fullName,
    email:                email,
    phone:                phone,
    gender:               gender,
    age_range:            ageRange,
    country:              country,
    state:                state,
    course:               course,
    pricing_tier:         pricingTier,
    partner_code:         partnerCode,
    cohort:               cohort,
    commitment_confirmed: commitment,
    status:               'enrolled'
  };

  console.log('Inserting enrollment payload:', JSON.stringify(enrollmentPayload));

  var enrollmentInsertResponse;
  try {
    enrollmentInsertResponse = await fetch(
      SB_URL + '/rest/v1/enrollments',
      {
        method: 'POST',
        headers: {
          apikey:         SB_KEY,
          Authorization:  'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=representation'
        },
        body: JSON.stringify(enrollmentPayload)
      }
    );
  } catch (enrollErr) {
    console.error('Enrollments insert network error:', enrollErr);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save enrollment. Payment was successful — contact support with ref: ' + flwTxRef
      })
    };
  }

  if (!enrollmentInsertResponse.ok) {
    var enrollErrText = await enrollmentInsertResponse.text();
    console.error('Enrollments insert failed:', enrollmentInsertResponse.status, enrollErrText);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Failed to save enrollment. Payment was successful — contact support with ref: ' + flwTxRef
      })
    };
  }

  var enrollmentRows;
  try {
    enrollmentRows = await enrollmentInsertResponse.json();
  } catch (e) {
    enrollmentRows = [];
  }

  var enrollmentId = enrollmentRows && enrollmentRows[0] ? enrollmentRows[0].id : null;
  console.log('Enrollment saved. id:', enrollmentId);

  // ── STEP 2C: Insert into payments table ──────────
  var paymentPayload = {
    amount:             amount,
    currency:           currency,
    flw_tx_ref:         flwTxRef,
    flw_tx_id:          flwTxId,
    payment_status:     'successful',
    payment_purpose:    'enrollment',
    payment_purpose_id: enrollmentId,
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

  // ── STEP 3A: Admin notification email ────────────
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
        subject:  'New Enrollment — ' + course + ' (' + pricingTier + '): ' + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Academy Enrollment</h2>' +
          '<p><strong>Name:</strong> ' + fullName + '</p>' +
          '<p><strong>Email:</strong> ' + email + '</p>' +
          '<p><strong>Phone:</strong> ' + phone + '</p>' +
          '<p><strong>Course:</strong> ' + course + '</p>' +
          '<p><strong>Pricing Tier:</strong> ' + pricingTier + '</p>' +
          '<p><strong>Amount:</strong> ' + currency + ' ' + amount + '</p>' +
          '<p><strong>Country:</strong> ' + country + (state ? ', ' + state : '') + '</p>' +
          (partnerCode ? '<p><strong>Partner Code:</strong> ' + partnerCode + '</p>' : '') +
          '<p><strong>Transaction Ref:</strong> ' + flwTxRef + '</p>' +
          '</div>'
      })
    });
  } catch (adminEmailErr) {
    console.error('Admin enrollment email failed:', adminEmailErr);
  }

  // ── STEP 3B: Student confirmation email ──────────
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
        subject: 'You are enrolled in ' + course + ' — TechNuVate Academy',
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Welcome to TechNuVate Academy, ' + fullName.split(' ')[0] + '!</h2>' +
          '<p>Your enrollment in <strong>' + course + '</strong> is confirmed.</p>' +
          '<p><strong>Pricing:</strong> ' + pricingTier.charAt(0).toUpperCase() + pricingTier.slice(1) + '</p>' +
          '<p><strong>Amount paid:</strong> ' + currency + ' ' + amount + '</p>' +
          '<p>You will receive your onboarding details and cohort schedule within 48 hours. Watch your inbox.</p>' +
          '<p style="color:#6B7280;font-size:12px">Transaction reference: ' + flwTxRef + '</p>' +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or contact us at hello@technuvate.com</p>' +
          '</div>'
      })
    });
  } catch (studentEmailErr) {
    console.error('Student enrollment email failed:', studentEmailErr);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:       true,
      flw_tx_ref:    flwTxRef,
      enrollment_id: enrollmentId,
      course:        course,
      amount:        amount,
      currency:      currency
    })
  };
};