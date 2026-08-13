// netlify/functions/verify-labs-it.js
// Called by frontend after Flutterwave payment callback
// Verifies payment via Flutterwave API (skipped in test mode)
// Receives Cloudinary file URLs that were uploaded client-side
// Inserts into lab_it_applications table
// Inserts into payments table
// Sends admin and applicant confirmation emails
// Returns { success: true } to frontend

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
  } catch (parseError) {
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

  // ── Extract all application fields ──────────────────
  var fullName = (data.full_name || "").trim();
  var email = (data.email || "").trim();
  var phone = (data.phone || "").trim();
  var gender = (data.gender || "").trim();
  var ageRange = (data.age_range || "").trim();
  var stateOfResidence = (data.state_of_residence || "").trim();
  var city = (data.city || "").trim();
  var schoolName = (data.school_name || "").trim();
  var institutionType = (data.institution_type || "").trim();
  var courseOfStudy = (data.course_of_study || "").trim();
  var currentLevel = (data.current_level || "").trim();
  var itStartDate = (data.it_start_date || "").trim();
  var itDuration = (data.it_duration || "").trim();
  var supervisorName = (data.supervisor_name || "").trim() || null;
  var supervisorEmail = (data.supervisor_email || "").trim() || null;
  var naturalStrength = (data.natural_strength || "").trim();
  var peopleComfort = (data.people_comfort || "").trim();
  var toolsFamiliar = (data.tools_familiar || "").trim();
  var whyTechnuvate = (data.why_technuvate || "").trim();
  var itLetterUrl = (data.it_letter_url || "").trim();
  var schoolIdUrl = (data.school_id_url || "").trim();
  var passportUrl = (data.passport_url || "").trim();
  var commitment = data.commitment_confirmed === true;
  var amount = parseFloat(data.amount) || 0;
  var currency = (data.currency || "NGN").toUpperCase();

  var ipAddress =
    event.headers["x-forwarded-for"] || event.headers["client-ip"] || null;

  var SB_URL = process.env.SUPABASE_URL;
  var SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── TEST MODE ────────────────────────────────────────
  var isTestMode = process.env.DONATION_TEST_MODE === "true";
  console.log("isTestMode:", isTestMode, "| flwTxRef:", flwTxRef);

  // ── STEP 1: Verify payment with Flutterwave ──────────
  if (!isTestMode) {
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
    } catch (networkError) {
      console.error("Flutterwave verify network error:", networkError);
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
    } catch (parseError) {
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

    var verified = verifyData.data;
    amount = verified.amount;
    currency = verified.currency;
  }

  // ── STEP 2A: Idempotency check ───────────────────────
  try {
    var duplicateCheck = await fetch(
      SB_URL +
        "/rest/v1/labs_it_applications?flw_tx_ref=eq." +
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
    var duplicateData = await duplicateCheck.json();
    if (Array.isArray(duplicateData) && duplicateData.length > 0) {
      console.log("Duplicate labs IT application:", flwTxRef);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, duplicate: true }),
      };
    }
  } catch (duplicateError) {
    console.error("Duplicate check error:", duplicateError);
  }

  // ── STEP 2B: Insert into lab_it_applications ─────────
  var applicationPayload = {
    flw_tx_ref: flwTxRef,
    full_name: fullName,
    email: email,
    phone: phone,
    gender: gender,
    age_range: ageRange,
    state_of_residence: stateOfResidence,
    city: city,
    school_name: schoolName,
    institution_type: institutionType,
    course_of_study: courseOfStudy,
    current_level: currentLevel,
    it_start_date: itStartDate,
    it_duration: itDuration,
    supervisor_name: supervisorName,
    supervisor_email: supervisorEmail,
    natural_strength: naturalStrength,
    people_comfort: peopleComfort,
    tools_familiar: toolsFamiliar,
    why_technuvate: whyTechnuvate,
    it_letter_url: itLetterUrl,
    school_id_url: schoolIdUrl,
    passport_url: passportUrl,
    commitment_confirmed: commitment,
    status: "applied",
  };

  console.log("Inserting labs IT application for:", email);

  var insertResponse;
  try {
    insertResponse = await fetch(SB_URL + "/rest/v1/labs_it_applications", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(applicationPayload),
    });
  } catch (insertNetworkError) {
    console.error("Labs IT insert network error:", insertNetworkError);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          "Failed to save application. Payment successful — contact support with ref: " +
          flwTxRef,
      }),
    };
  }

  if (!insertResponse.ok) {
    var insertErrorText = await insertResponse.text();
    console.error(
      "Labs IT insert failed:",
      insertResponse.status,
      insertErrorText,
    );
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error:
          "Failed to save application. Payment successful — contact support with ref: " +
          flwTxRef,
      }),
    };
  }

  var insertRows;
  try {
    insertRows = await insertResponse.json();
  } catch (parseError) {
    insertRows = [];
  }

  var applicationId = insertRows && insertRows[0] ? insertRows[0].id : null;
  console.log("Labs IT application saved. id:", applicationId);

  // ── STEP 2C: Insert into payments table ─────────────
  var paymentPayload = {
    amount: amount,
    currency: currency,
    flw_tx_ref: flwTxRef,
    flw_tx_id: flwTxId,
    payment_status: "successful",
    payment_purpose: "labs_it",
    payment_purpose_id: applicationId,
    payer_name: fullName,
    payer_email: email,
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
      var paymentErrorText = await paymentInsertResponse.text();
      console.error(
        "Payments insert failed:",
        paymentInsertResponse.status,
        paymentErrorText,
      );
    } else {
      console.log("Payment record saved.");
    }
  } catch (paymentError) {
    console.error("Payments insert network error:", paymentError);
  }

  // ── STEP 3A: Admin notification email ────────────────
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
        subject: "New Labs IT Application — " + schoolName + ": " + fullName,
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">New Labs IT Application</h2>' +
          "<p><strong>Name:</strong> " +
          fullName +
          "</p>" +
          "<p><strong>Email:</strong> " +
          email +
          "</p>" +
          "<p><strong>Phone:</strong> " +
          phone +
          "</p>" +
          "<p><strong>School:</strong> " +
          schoolName +
          "</p>" +
          "<p><strong>Institution Type:</strong> " +
          institutionType +
          "</p>" +
          "<p><strong>Course:</strong> " +
          courseOfStudy +
          "</p>" +
          "<p><strong>Level:</strong> " +
          currentLevel +
          "</p>" +
          "<p><strong>IT Start Date:</strong> " +
          itStartDate +
          "</p>" +
          "<p><strong>IT Duration:</strong> " +
          itDuration +
          "</p>" +
          "<p><strong>State:</strong> " +
          stateOfResidence +
          ", " +
          city +
          "</p>" +
          (supervisorName
            ? "<p><strong>Supervisor:</strong> " +
              supervisorName +
              " — " +
              (supervisorEmail || "no email") +
              "</p>"
            : "") +
          "<p><strong>Amount Paid:</strong> " +
          currency +
          " " +
          amount +
          "</p>" +
          "<p><strong>Transaction Ref:</strong> " +
          flwTxRef +
          "</p>" +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          "<p><strong>Natural Strength:</strong> " +
          naturalStrength +
          "</p>" +
          "<p><strong>People Comfort:</strong> " +
          peopleComfort +
          "</p>" +
          "<p><strong>Tools Familiar:</strong></p>" +
          '<p style="color:#6B7280">' +
          toolsFamiliar +
          "</p>" +
          "<p><strong>Why TechNuVate:</strong></p>" +
          '<p style="color:#6B7280">' +
          whyTechnuvate +
          "</p>" +
          '<hr style="margin:16px 0;border:none;border-top:1px solid #E4E8F0">' +
          "<p><strong>Documents:</strong></p>" +
          '<p><a href="' +
          itLetterUrl +
          '">IT Request Letter</a></p>' +
          '<p><a href="' +
          schoolIdUrl +
          '">School ID / Admission Letter</a></p>' +
          '<p><a href="' +
          passportUrl +
          '">Passport Photograph</a></p>' +
          "</div>",
      }),
    });
  } catch (adminEmailError) {
    console.error("Admin labs IT email failed:", adminEmailError);
  }

  // ── STEP 3B: Applicant confirmation email ────────────
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
        subject: "Your Labs IT application — TechNuVate",
        html:
          '<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto">' +
          '<h2 style="color:#1B3A7A">Application Received, ' +
          fullName.split(" ")[0] +
          "!</h2>" +
          "<p>Your payment for the <strong>TechNuVate Labs Industrial Training</strong> programme has been received and your application is confirmed.</p>" +
          "<p><strong>School:</strong> " +
          schoolName +
          "</p>" +
          "<p><strong>IT Start Date:</strong> " +
          itStartDate +
          "</p>" +
          "<p><strong>IT Duration:</strong> " +
          itDuration +
          "</p>" +
          "<p><strong>Amount paid:</strong> " +
          currency +
          " " +
          amount +
          "</p>" +
          "<p>Our team will review your application and reach out within 5 working days. Watch your inbox.</p>" +
          '<p style="color:#6B7280;font-size:12px">Transaction reference: ' +
          flwTxRef +
          "</p>" +
          '<p style="color:#6B7280;font-size:12px">Questions? Reply to this email or contact us at hello@technuvate.com</p>' +
          "</div>",
      }),
    });
  } catch (applicantEmailError) {
    console.error("Applicant labs IT email failed:", applicantEmailError);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      flw_tx_ref: flwTxRef,
      application_id: applicationId,
      amount: amount,
      currency: currency,
    }),
  };
};
