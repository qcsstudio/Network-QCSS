'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const DEFAULT_BASE_AMOUNT = 49;

export default function PaymentPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Apply a coupon or continue to secure Razorpay Checkout.");
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [pricing, setPricing] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  async function startPayment() {
    if (isStarting) return;

    try {
      setIsStarting(true);
      setError("");
      setStatus("Creating a secure Razorpay order...");

      const service = localStorage.getItem("linkedin_paid_service") || "profile-rewrite-100-score";
      const auditScore = localStorage.getItem("linkedin_audit_score");
      const linkedinUrl = localStorage.getItem("linkedin_audit_url");
      const role = localStorage.getItem("linkedin_audit_role");
      const auditReport = parseStoredJson(localStorage.getItem("linkedin_audit_report"));

      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          couponCode: couponCode.trim(),
          auditScore,
          linkedinUrl,
          role,
          auditReport,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Order create failed");
      }

      const order = data?.order;

      if (data?.freeCheckout || data?.pricing?.finalAmount === 0 || order?.amount === 0) {
        setPricing(data?.pricing || null);
        completeFreeCheckout(data?.pricing);
        return;
      }

      if (!order?.id) {
        throw new Error(data?.message || "Order create failed: Razorpay order was not returned.");
      }

      setPricing(data?.pricing || null);
      setStatus(getCheckoutStatus(data?.pricing));
      await ensureRazorpayLoaded();
      openRazorpay(order, data?.pricing);
    } catch (err) {
      setError(err.message || "Payment could not be started.");
      setStatus("Payment setup failed.");
      setIsStarting(false);
    }
  }

  function parseStoredJson(value) {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function ensureRazorpayLoaded() {
    if (window.Razorpay) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Razorpay SDK failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay SDK failed to load."));
      document.body.appendChild(script);
    });
  }

  function completeFreeCheckout(orderPricing) {
    const coupon = orderPricing?.coupon?.code || couponCode.trim().toUpperCase();
    localStorage.setItem("linkedin_rewrite_paid", "true");
    localStorage.setItem("linkedin_payment_id", `free_checkout_${coupon || "coupon"}_${Date.now()}`);
    localStorage.setItem("linkedin_payment_coupon", coupon);
    setStatus("100% coupon applied. Unlocking your AI rewrite workspace...");
    router.push("/suggestions");
  }

  function getCheckoutStatus(orderPricing) {
    if (orderPricing?.coupon && orderPricing.discountAmount > 0) {
      if (orderPricing.finalAmount === 0) return `Coupon ${orderPricing.coupon.code} applied. No Razorpay payment is required.`;
      return `Coupon ${orderPricing.coupon.code} applied. Loading Razorpay Checkout...`;
    }

    if (orderPricing?.coupon?.razorpayOfferId) {
      return `Offer ${orderPricing.coupon.code} linked. Select the eligible payment method in Razorpay Checkout.`;
    }

    if (orderPricing?.offerIds?.length) {
      return "Eligible Razorpay offers linked. Loading secure checkout...";
    }

    return "Loading secure Razorpay Checkout...";
  }

  function openRazorpay(order, orderPricing) {
    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_LIVE_RAZORPAY_KEY_ID;

    if (!razorpayKey) {
      setError("Razorpay key is missing. Please configure NEXT_PUBLIC_RAZORPAY_KEY_ID.");
      setStatus("Payment setup failed.");
      setIsStarting(false);
      return;
    }

    if (!window.Razorpay) {
      setError("Razorpay SDK is not available. Please refresh and try again.");
      setStatus("Payment setup failed.");
      setIsStarting(false);
      return;
    }

    setStatus("Opening Razorpay Checkout...");

    const options = {
      key: razorpayKey,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "QCS LinkedIn AI Scanner",
      description: getDescription(orderPricing),
      order_id: order.id,
      prefill: getPrefill(),
      notes: {
        service: orderPricing?.service?.key || "profile-rewrite-100-score",
        couponCode: orderPricing?.coupon?.code || "",
      },

      handler: async function (response) {
        await verifyPayment(response);
      },

      modal: {
        ondismiss: () => {
          setStatus("Payment cancelled.");
          setIsStarting(false);
        },
      },

      theme: {
        color: "#0A66C2",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  function getDescription(orderPricing) {
    const amount = `₹${formatPaise(orderPricing?.finalAmount || DEFAULT_BASE_AMOUNT * 100)}`;

    if (orderPricing?.coupon && orderPricing.discountAmount > 0) {
      return `${amount} LinkedIn Profile Rewrite (${orderPricing.coupon.code} coupon applied)`;
    }

    if (orderPricing?.coupon?.razorpayOfferId) {
      return `${amount} LinkedIn Profile Rewrite (${orderPricing.coupon.code} Razorpay offer eligible)`;
    }

    return `${amount} LinkedIn Profile Rewrite to 100% QCS Score`;
  }

  function getPrefill() {
    return {
      name: localStorage.getItem("qcs_customer_name") || "",
      email: localStorage.getItem("qcs_customer_email") || "",
      contact: localStorage.getItem("qcs_customer_phone") || "",
    };
  }

  async function verifyPayment(response) {
    try {
      setStatus("Verifying captured payment with Razorpay...");

      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Payment verification failed.");
      }

      localStorage.setItem("linkedin_rewrite_paid", "true");
      localStorage.setItem("linkedin_payment_id", response.razorpay_payment_id);
      setStatus("Payment verified. Redirecting...");
      router.push("/suggestions");
    } catch (err) {
      setError(err.message || "Payment verification failed.");
      setStatus("Payment verification failed.");
      setIsStarting(false);
    }
  }

  const formatPaise = (value) => (Number(value || 0) / 100).toFixed(2).replace(/\.00$/, "");
  const displayBaseAmount = formatPaise(pricing?.baseAmount || DEFAULT_BASE_AMOUNT * 100);
  const displayTotal = formatPaise(pricing?.finalAmount || DEFAULT_BASE_AMOUNT * 100);

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4">
      <div className="bg-white rounded-4 shadow-sm p-4 p-lg-5" style={{ maxWidth: 600, width: "100%" }}>
        <p className="text-primary fw-semibold mb-2">QCS Secure Payment</p>
        <h1 className="mb-3">Unlock your LinkedIn rewrite</h1>
        <p className="text-muted mb-4">
          Pay securely with Razorpay. Coupon discounts are calculated on the server, and eligible Razorpay offers are linked to Checkout.
        </p>

        <div className="border rounded-3 p-3 mb-3">
          <div className="d-flex justify-content-between mb-2">
            <span>LinkedIn Profile Rewrite</span>
            <strong>₹{displayBaseAmount}</strong>
          </div>
          {pricing?.discountAmount > 0 && (
            <div className="d-flex justify-content-between text-success mb-2">
              <span>Coupon discount {pricing.coupon?.code ? `(${pricing.coupon.code})` : ""}</span>
              <strong>-₹{formatPaise(pricing.discountAmount)}</strong>
            </div>
          )}
          {pricing?.coupon?.razorpayOfferId && pricing?.discountAmount === 0 && (
            <p className="text-success small mb-2">
              Offer {pricing.coupon.code} will appear in Razorpay Checkout for eligible payment methods.
            </p>
          )}
          <div className="d-flex justify-content-between border-top pt-2">
            <span>{pricing?.finalAmount === 0 ? "Total after coupon" : "Total before any Razorpay bank offer"}</span>
            <strong>₹{displayTotal}</strong>
          </div>
        </div>

        <label className="form-label fw-semibold" htmlFor="coupon-code">Coupon or offer code</label>
        <input
          id="coupon-code"
          className="form-control mb-3"
          value={couponCode}
          onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
          placeholder="Enter coupon code"
          autoComplete="off"
          disabled={isStarting}
        />

        <button className="cs_btn cs_style_1 w-100 justify-content-center" onClick={startPayment} disabled={isStarting}>
          <span>{isStarting ? "Please wait..." : "Continue to Razorpay"}</span>
        </button>

        <p className="mt-3 mb-0 text-muted small">{status}</p>
        {error && <p className="text-danger mt-2 mb-0 small">{error}</p>}
      </div>
    </main>
  );
}
