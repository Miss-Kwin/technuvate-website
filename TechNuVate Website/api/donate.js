const { randomUUID } = require("node:crypto");

const MIN_AMOUNTS = {
  NGN: 2000,
  USD: 2,
};

const SUPPORTED_CURRENCIES = ["NGN", "USD"];

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

  // ── Extract and trim all fields ────────────────────────────
  var donorName = (data.donor_name || "").trim() || "Anonymous Donor";
  var email = (data.email || "").trim();
  var occasion = (data.occasion || "").trim();
  var honourName = (data.honour_name || "").trim();
  var birthdayDay = (data.birthday_day || "").trim();
  var birthdayMonth = (data.birthday_month || "").trim();
  var note = (data.note || "").trim();
  var shoutout = data.shoutout === true;
  var amount = parseFloat(data.amount);
  var currency = (data.currency || "").toUpperCase().trim();

  // ── Server-side validation ─────────────────────────────────
  var errors = [];

  if (!email || email.indexOf("@") < 0 || email.indexOf(".") < 0) {
    errors.push("A valid email address is required.");
  }

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    errors.push("Currency must be NGN or USD.");
  }

  if (isNaN(amount) || amount <= 0) {
    errors.push("A valid donation amount is required.");
  } else if (MIN_AMOUNTS[currency] && amount < MIN_AMOUNTS[currency]) {
    errors.push(
      "Minimum donation is " +
        (currency === "NGN" ? "₦" : "$") +
        MIN_AMOUNTS[currency] +
        " " +
        currency +
        ".",
    );
  }

  if (occasion === "honour" && !honourName) {
    errors.push("Honouree name is required when giving in someone's honour.");
  }

  if (errors.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: errors.join(" ") });
  }

  // ── Generate secure tx_ref ─────────────────────────────────
  var txRef = "TNVDON-" + randomUUID();

  // ── Build Flutterwave config ───────────────────────────────
  var flutterwaveConfig = {
    tx_ref: txRef,
    amount: amount,
    currency: currency,
    payment_options: "card,banktransfer,ussd,mobilemoney",
    customer: {
      email: email,
      name: donorName,
    },
    meta: {
      type: "donation",
      donor_name: donorName,
      honour_name: honourName || null,
      occasion: occasion || null,
      birthday_month: birthdayMonth || null,
      birthday_day: birthdayDay || null,
      email_contact: email,
      note: note || null,
      shoutout: shoutout,
    },
    customizations: {
      title: "TechNuVate — Sponsor a Youth",
      description: "Empowering a young person to learn a tech skill in Africa",
      logo: "https://technuvate.com/technuvate-logo-dark.png",
    },
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    success: true,
    flutterwaveConfig: flutterwaveConfig,
  });
};