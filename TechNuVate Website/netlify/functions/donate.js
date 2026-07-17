const { randomUUID } = require("node:crypto");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_AMOUNTS = {
  NGN: 2000,
  USD: 2,
};

const SUPPORTED_CURRENCIES = ["NGN", "USD"];

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  var data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
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
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: errors.join(" ") }),
    };
  }

  if (!process.env.FW_PUBLIC_KEY) {
    console.error('FW_PUBLIC_KEY environment variable is not set for this deploy context.');
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Payment configuration error. Please contact support.' })
    };
  }

  // ── Generate secure tx_ref ─────────────────────────────────
  var txRef = "TNVDON-" + randomUUID();

  // ── Build Flutterwave config ───────────────────────────────
  var flutterwaveConfig = {
    public_key: process.env.FW_PUBLIC_KEY,
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

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      flutterwaveConfig: flutterwaveConfig,
    }),
  };
};
