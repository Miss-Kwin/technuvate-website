// netlify/functions/enroll.js
// Receives enrollment form data from frontend
// Validates server-side
// Generates secure flw_tx_ref
// Returns Flutterwave checkout config to frontend

const { randomUUID } = require("node:crypto");

const PRICES = {
  partner: { NGN: 40000, USD: 30 },
  earlybird: { NGN: 60000, USD: 45 },
  standard: { NGN: 80000, USD: 60 },
};

const VALID_TIERS = ["partner", "earlybird", "standard"];
const VALID_CURRENCIES = ["NGN", "USD"];

// Partner code validation — pattern: TNV- followed by digits only
// e.g. TNV-123456
function isValidPartnerCode(code) {
  return /^TNV-[A-Z0-9]+$/.test(code);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: "Method not allowed" });
  }

  var data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: "Invalid request body" });
    }
  }
  if (!data) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: "Invalid request body" });
  }

  // ── Extract and trim all fields ──────────────────────
  var fullName = (data.full_name || "").trim();
  var email = (data.email || "").trim();
  var phone = (data.phone || "").trim();
  var gender = (data.gender || "").trim();
  var ageRange = (data.age_range || "").trim();
  var country = (data.country || "").trim();
  var state = (data.state || "").trim() || null;
  var course = (data.course || "").trim();
  var pricingTier = (data.pricing_tier || "").trim().toLowerCase();
  var partnerCode = (data.partner_code || "").trim().toUpperCase() || null;
  var cohort = (data.cohort || "").trim() || null;
  var currency = (data.currency || "NGN").toUpperCase().trim();
  var commitment = data.commitment_confirmed === true;

  // ── Server-side validation ───────────────────────────
  var errors = [];

  if (!fullName) errors.push("Full name is required.");
  if (!email || email.indexOf("@") < 0 || email.indexOf(".") < 0)
    errors.push("A valid email address is required.");
  if (!phone) errors.push("Phone number is required.");
  if (!gender) errors.push("Gender is required.");
  if (!ageRange) errors.push("Age range is required.");
  if (!country) errors.push("Country is required.");
  if (!course) errors.push("Course selection is required.");
  if (!commitment) errors.push("You must confirm the commitment policy.");

  if (!VALID_TIERS.includes(pricingTier))
    errors.push("Invalid pricing tier selected.");

  if (!VALID_CURRENCIES.includes(currency))
    errors.push("Currency must be NGN or USD.");

  if (pricingTier === "partner") {
    if (!partnerCode) {
      errors.push("Partner code is required for partner pricing.");
    } else if (!isValidPartnerCode(partnerCode)) {
      errors.push(
        "Invalid partner code format. Expected pattern: TNV-followed by numbers (e.g. TNV-123456).",
      );
    }
  }

  if (errors.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: errors.join(" ") });
  }

  // ── Derive amount from tier and currency ─────────────
  var amount = PRICES[pricingTier][currency];

  // ── Generate secure flw_tx_ref ───────────────────────
  var flwTxRef = "TNVENR-" + randomUUID();

  // ── Build Flutterwave config ─────────────────────────
  var flutterwaveConfig = {
    public_key: process.env.FW_PUBLIC_KEY,
    tx_ref: flwTxRef,
    amount: amount,
    currency: currency,
    payment_options: "card,banktransfer,ussd,mobilemoney",
    customer: {
      email: email,
      name: fullName,
      phone_number: phone,
    },
    meta: {
      type: "enrollment",
      full_name: fullName,
      course: course,
      pricing_tier: pricingTier,
      partner_code: partnerCode || null,
      cohort: cohort || null,
    },
    customizations: {
      title: "TechNuVate Academy",
      description:
        course +
        " — " +
        pricingTier.charAt(0).toUpperCase() +
        pricingTier.slice(1) +
        " Pricing",
      logo: "https://technuvate.com/technuvate-logo-dark.png",
    },
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    success: true,
    flwTxRef: flwTxRef,
    amount: amount,
    currency: currency,
    flutterwaveConfig: flutterwaveConfig,
  });
};