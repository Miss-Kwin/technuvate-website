const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  var flwTxRef = (data.flw_tx_ref || "").trim();
  var flwTxId = String(data.flw_tx_id || "").trim();

  if (!flwTxRef || !flwTxId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "flw_tx_ref and flw_tx_id are required." }),
    };
  }

  // ── STEP 1: Verify payment with Flutterwave API ────────────
  var verifyResponse;
  try {
    verifyResponse = await fetch(
      "https://api.flutterwave.com/v3/transactions/" + flwTxId + "/verify",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (networkErr) {
    console.error("Flutterwave verify network error:", networkErr);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Payment verification network error. Please contact support.",
      }),
    };
  }

  var verifyData;
  try {
    verifyData = await verifyResponse.json();
  } catch (parseErr) {
    console.error("Flutterwave verify parse error:", parseErr);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Payment verification response error." }),
    };
  }

  if (
    !verifyData ||
    verifyData.status !== "success" ||
    !verifyData.data ||
    verifyData.data.status !== "successful"
  ) {
    console.error("Payment not verified:", JSON.stringify(verifyData));
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Payment could not be verified. No records created.",
      }),
    };
  }

  // ── Extract verified payment data ──────────────────────────
  var verified = verifyData.data;
  var amount = verified.amount;
  var currency = verified.currency;
  var payerName = verified.customer
    ? verified.customer.name
    : data.donor_name || "Anonymous Donor";
  var payerEmail = verified.customer
    ? verified.customer.email
    : data.email || "";

  // ── Pull donor detail fields passed from frontend ──────────
  var donorName = (data.donor_name || payerName || "Anonymous Donor").trim();
  var email = (data.email || payerEmail || "").trim();
  var occasion = (data.occasion || "").trim() || null;
  var honourName = (data.honour_name || "").trim() || null;
  var birthdayDay = (data.birthday_day || "").trim() || null;
  var birthdayMonth = (data.birthday_month || "").trim() || null;
  var note = (data.note || "").trim() || null;
  var shoutout = data.shoutout === true;

  var ipAddress =
    event.headers["x-forwarded-for"] || event.headers["client-ip"] || null;

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── STEP 2A: Check for duplicate (idempotency) ─────────────
  try {
    var dupCheck = await fetch(
      SB_URL +
        "/rest/v1/payments?flw_tx_ref=eq." +
        encodeURIComponent(flwTxRef) +
        "&select=id",
      {
        method: "GET",
        headers: {
          apikey: SB_KEY,
          Authorization: "Bearer " + SB_KEY,
          "Content-Type": "application/json",
        },
      },
    );
    var dupData = await dupCheck.json();
    if (Array.isArray(dupData) && dupData.length > 0) {
      console.log("Duplicate payment record detected for tx_ref:", flwTxRef);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, duplicate: true }),
      };
    }
  } catch (dupErr) {
    console.error("Duplicate check error:", dupErr);
  }

  // ── STEP 2B: Insert into donations table ───────────────────
  var donationPayload = {
    flw_tx_ref: flwTxRef,
    donor_name: donorName,
    email: email,
    occasion: occasion,
    honoree_name: honourName,
    birthday_day: birthdayDay,
    birthday_month: birthdayMonth,
    note: note,
    shoutout: shoutout,
  };

  var donationInsertResponse;
  try {
    donationInsertResponse = await fetch(SB_URL + "/rest/v1/donations", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(donationPayload),
    });
  } catch (donErr) {
    console.error("Donations insert network error:", donErr);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          "Failed to save donation record. Payment was successful — contact support with ref: " +
          flwTxRef,
      }),
    };
  }

  if (!donationInsertResponse.ok) {
    var donErrText = await donationInsertResponse.text();
    console.error(
      "Donations insert failed:",
      donationInsertResponse.status,
      donErrText,
    );
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          "Failed to save donation record. Payment was successful — contact support with ref: " +
          flwTxRef,
      }),
    };
  }

  var donationRows;
  try {
    donationRows = await donationInsertResponse.json();
  } catch (e) {
    donationRows = [];
  }

  var donationId = donationRows && donationRows[0] ? donationRows[0].id : null;

  // ── STEP 2C: Insert into payments table ────────────────────
  var paymentPayload = {
    amount: amount,
    currency: currency,
    flw_tx_ref: flwTxRef,
    flw_tx_id: flwTxId,
    payment_status: "successful",
    payment_purpose: "donation",
    payment_purpose_id: donationId,
    payer_name: payerName,
    payer_email: payerEmail,
    ip_address: ipAddress,
  };

  try {
    var paymentInsertResponse = await fetch(SB_URL + "/rest/v1/payments", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!paymentInsertResponse.ok) {
      var payErrText = await paymentInsertResponse.text();
      console.error(
        "Payments insert failed:",
        paymentInsertResponse.status,
        payErrText,
      );
      // Donation is already saved — log but do not fail the request
      // Support can reconcile using flw_tx_ref
    }
  } catch (payErr) {
    console.error("Payments insert network error:", payErr);
    // Same as above — do not fail the request
  }

  // ── STEP 3A: Admin notification email ─────────────────────
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_SENDER_EMAIL,
        to: [process.env.CONTACT_RECEIVER_EMAIL],
        reply_to: email,
        subject:
          "New Donation Received — " +
          currency +
          " " +
          amount +
          " from " +
          donorName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Donation Received</h2>' +
          "<p><strong>Name:</strong> " +
          donorName +
          "</p>" +
          "<p><strong>Email:</strong> " +
          email +
          "</p>" +
          "<p><strong>Amount:</strong> " +
          currency +
          " " +
          amount +
          "</p>" +
          "<p><strong>Occasion:</strong> " +
          (occasion || "Not specified") +
          "</p>" +
          (honourName
            ? "<p><strong>In honour of:</strong> " + honourName + "</p>"
            : "") +
          (birthdayMonth && birthdayDay
            ? "<p><strong>Birthday:</strong> " +
              birthdayMonth +
              " " +
              birthdayDay +
              "</p>"
            : "") +
          (note ? "<p><strong>Note:</strong> " + note + "</p>" : "") +
          "<p><strong>Shoutout consent:</strong> " +
          (shoutout ? "Yes" : "No") +
          "</p>" +
          "<p><strong>Transaction Ref:</strong> " +
          flwTxRef +
          "</p>" +
          "<p><strong>Flutterwave ID:</strong> " +
          flwTxId +
          "</p>" +
          "</div>",
      }),
    });
  } catch (adminEmailErr) {
    console.error("Admin notification email failed:", adminEmailErr);
    // Non-blocking — donation already saved
  }

  // ── STEP 3B: Donor confirmation email ─────────────────────
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_SENDER_EMAIL,
        to: [email],
        subject: "Thank you for your donation — TechNuVate",
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Thank you, ' +
          donorName.split(" ")[0] +
          "</h2>" +
          "<p>Your donation of <strong>" +
          currency +
          " " +
          amount +
          "</strong> has been received successfully.</p>" +
          (occasion
            ? "<p><strong>Occasion:</strong> " + occasion + "</p>"
            : "") +
          (honourName
            ? "<p>This donation is given in honour of <strong>" +
              honourName +
              "</strong>.</p>"
            : "") +
          "<p>Your generosity directly supports young people in Africa building skills in tech. We are grateful.</p>" +
          '<p style="color:#6B7280;font-size:12px">Transaction reference: ' +
          flwTxRef +
          "</p>" +
          '<p style="color:#6B7280;font-size:12px">If you have any questions, reply to this email or reach us at hello@technuvate.com</p>' +
          "</div>",
      }),
    });
  } catch (donorEmailErr) {
    console.error("Donor confirmation email failed:", donorEmailErr);
    // Non-blocking — donation already saved
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      flw_tx_ref: flwTxRef,
      amount: amount,
      currency: currency,
    }),
  };
};
