// netlify/functions/labs-pro.js
// Receives Labs Pro application form data from frontend
// Validates server-side
// Generates secure flw_tx_ref
// Returns Flutterwave checkout config to frontend

const { randomUUID } = require('node:crypto');

const PRICES = {
  NGN: 7000,
  USD: 5
};

const VALID_CURRENCIES = ['NGN', 'USD'];

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

  // ── Extract and trim all fields ──────────────────────
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
  var currency      = (data.currency       || 'NGN').toUpperCase().trim();

  // ── Server-side validation ───────────────────────────
  var errors = [];

  if (!fullName)   errors.push('Full name is required.');
  if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0)
    errors.push('A valid email address is required.');
  if (!phone)      errors.push('Phone number is required.');
  if (!gender)     errors.push('Gender is required.');
  if (!ageRange)   errors.push('Age range is required.');
  if (!country)    errors.push('Country is required.');
  if (!skillTrack) errors.push('Skill track is required.');
  if (!background) errors.push('Background information is required.');
  if (!experience) errors.push('Skill level description is required.');
  if (!goal)       errors.push('Goal is required.');
  if (!linkedin)   errors.push('LinkedIn profile URL is required.');
  if (!commitment) errors.push('You must confirm the commitment policy.');

  if (!VALID_CURRENCIES.includes(currency))
    errors.push('Currency must be NGN or USD.');

  if (errors.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: errors.join(' ') });
  }

  // ── Derive amount from currency ──────────────────────
  var amount = PRICES[currency];

  // ── Generate secure flw_tx_ref ───────────────────────
  var flwTxRef = 'TNVLBP-' + randomUUID();

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
      type:          'labs_pro',
      full_name:     fullName,
      skill_track:   skillTrack,
      background:    background,
      country:       country,
      state_region:  stateRegion || null,
      linkedin:      linkedin
    },
    customizations: {
      title:       'TechNuVate Labs',
      description: 'Professional Track — ' + skillTrack,
      logo:        'https://technuvate.com/technuvate-logo-dark.png'
    }
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    success:           true,
    flwTxRef:          flwTxRef,
    amount:            amount,
    currency:          currency,
    flutterwaveConfig: flutterwaveConfig
  });
};