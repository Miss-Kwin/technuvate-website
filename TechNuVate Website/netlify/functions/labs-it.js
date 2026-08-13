// netlify/functions/labs-it.js
// Receives Labs IT application form data from frontend
// Validates server-side
// Generates secure flw_tx_ref using crypto
// Returns Flutterwave checkout config to frontend
// File uploads are handled client-side via Cloudinary
// before this function is called — URLs arrive as strings

const { randomUUID } = require('node:crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PRICES = {
  NGN: 5000,
  USD: 3
};

const VALID_CURRENCIES = ['NGN', 'USD'];

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
  var fullName         = (data.full_name          || '').trim();
  var email            = (data.email              || '').trim();
  var phone            = (data.phone              || '').trim();
  var gender           = (data.gender             || '').trim();
  var ageRange         = (data.age_range          || '').trim();
  var stateOfResidence = (data.state_of_residence || '').trim();
  var city             = (data.city               || '').trim();
  var schoolName       = (data.school_name        || '').trim();
  var institutionType  = (data.institution_type   || '').trim();
  var courseOfStudy    = (data.course_of_study    || '').trim();
  var currentLevel     = (data.current_level      || '').trim();
  var itStartDate      = (data.it_start_date      || '').trim();
  var itDuration       = (data.it_duration        || '').trim();
  var supervisorName   = (data.supervisor_name    || '').trim() || null;
  var supervisorEmail  = (data.supervisor_email   || '').trim() || null;
  var naturalStrength  = (data.natural_strength   || '').trim();
  var peopleComfort    = (data.people_comfort     || '').trim();
  var toolsFamiliar    = (data.tools_familiar     || '').trim();
  var whyTechnuvate    = (data.why_technuvate     || '').trim();
  var itLetterUrl      = (data.it_letter_url      || '').trim();
  var schoolIdUrl      = (data.school_id_url      || '').trim();
  var passportUrl      = (data.passport_url       || '').trim();
  var commitment       = data.commitment_confirmed === true;
  var currency         = (data.currency           || 'NGN').toUpperCase().trim();

  // ── Server-side validation ───────────────────────────
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
  if (!itLetterUrl)      validationErrors.push('IT request letter upload is required.');
  if (!schoolIdUrl)      validationErrors.push('School ID or admission letter upload is required.');
  if (!passportUrl)      validationErrors.push('Passport photograph upload is required.');
  if (!commitment)       validationErrors.push('You must confirm the commitment acknowledgment.');
  if (!VALID_CURRENCIES.includes(currency))
    validationErrors.push('Currency must be NGN or USD.');

  if (validationErrors.length > 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: validationErrors.join(' ') })
    };
  }

  // ── Derive amount from currency ──────────────────────
  var amount = PRICES[currency];

  // ── Generate secure flw_tx_ref ───────────────────────
  var flwTxRef = 'TNVIT-' + randomUUID();

  // ── Build Flutterwave config ─────────────────────────
  var flutterwaveConfig = {
    public_key:      process.env.FW_PUBLIC_KEY,
    tx_ref:          flwTxRef,
    amount:          amount,
    currency:        currency,
    payment_options: 'card,banktransfer,ussd,mobilemoney',
    customer: {
      email:        email,
      name:         fullName,
      phone_number: phone
    },
    meta: {
      type:          'labs_it',
      full_name:     fullName,
      school_name:   schoolName,
      course:        courseOfStudy,
      it_start_date: itStartDate,
      it_duration:   itDuration
    },
    customizations: {
      title:       'TechNuVate Labs IT',
      description: 'Industrial Training Application — ' + schoolName,
      logo:        'https://technuvate.com/technuvate-logo-dark.png'
    }
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success:           true,
      flwTxRef:          flwTxRef,
      amount:            amount,
      currency:          currency,
      flutterwaveConfig: flutterwaveConfig
    })
  };
};