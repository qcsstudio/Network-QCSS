import crypto from "crypto";

const RAZORPAY_PAYMENTS_URL = "https://api.razorpay.com/v1/payments";

const getRazorpayCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_LIVE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured. Set RAZORPAY_KEY_ID (or NEXT_PUBLIC_RAZORPAY_KEY_ID) and RAZORPAY_KEY_SECRET in your deployment environment.");
  }

  return { keyId, keySecret };
};

const getBasicAuthHeader = (keyId, keySecret) => {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
};

const isValidRazorpayId = (prefix, value) => {
  return new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(String(value || ""));
};

const timingSafeSignatureMatch = (expectedSignature, providedSignature) => {
  const expected = Buffer.from(expectedSignature, "hex");
  const provided = Buffer.from(String(providedSignature || ""), "hex");

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      !isValidRazorpayId("order", razorpay_order_id) ||
      !isValidRazorpayId("pay", razorpay_payment_id) ||
      typeof razorpay_signature !== "string"
    ) {
      return Response.json(
        { success: false, message: "Missing or invalid Razorpay verification parameters." },
        { status: 400 }
      );
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeSignatureMatch(expectedSignature, razorpay_signature)) {
      return Response.json(
        { success: false, message: "Invalid Razorpay signature." },
        { status: 400 }
      );
    }

    const paymentResponse = await fetch(`${RAZORPAY_PAYMENTS_URL}/${razorpay_payment_id}`, {
      method: "GET",
      headers: {
        Authorization: getBasicAuthHeader(keyId, keySecret),
      },
    });
    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return Response.json(
        { success: false, message: payment?.error?.description || "Unable to confirm payment with Razorpay." },
        { status: paymentResponse.status }
      );
    }

    if (payment.order_id !== razorpay_order_id) {
      return Response.json(
        { success: false, message: "Payment does not belong to this Razorpay order." },
        { status: 400 }
      );
    }

    if (payment.status !== "captured") {
      return Response.json(
        { success: false, message: "Payment is not captured yet. Please contact support if money was debited." },
        { status: 409 }
      );
    }

    return Response.json({
      success: true,
      payment: {
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        captured: payment.captured,
        method: payment.method,
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
