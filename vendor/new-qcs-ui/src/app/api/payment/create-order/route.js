const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const MIN_ORDER_AMOUNT_PAISE = 100;
const FREE_CHECKOUT_AMOUNT_PAISE = 0;
const DEFAULT_CURRENCY = "INR";
const DEFAULT_SERVICE_KEY = "profile-rewrite-100-score";

const SERVICE_CATALOG = {
  [DEFAULT_SERVICE_KEY]: {
    label: "LinkedIn Profile Rewrite to 100% QCS Score",
    amountInPaise: 4900,
  },
};

const BUILT_IN_COUPONS = {
  QCS100: {
    active: true,
    label: "100% testing discount",
    type: "percentage",
    value: 100,
    allowFreeCheckout: true,
    serviceKeys: [DEFAULT_SERVICE_KEY],
  },
};

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

const parseJsonEnv = (name, fallback) => {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch {
    throw new Error(`${name} is not valid JSON.`);
  }
};

const getServiceCatalog = () => ({
  ...SERVICE_CATALOG,
  ...parseJsonEnv("PAYMENT_SERVICE_CATALOG_JSON", {}),
});

const normalizeCouponCatalog = (catalog = {}) => {
  return Object.fromEntries(
    Object.entries(catalog).map(([code, coupon]) => [normalizeCouponCode(code), coupon])
  );
};

const getCouponCatalog = () => ({
  ...normalizeCouponCatalog(parseJsonEnv("RAZORPAY_COUPONS_JSON", {})),
  ...BUILT_IN_COUPONS,
});

const getDefaultOfferIds = () => {
  return String(process.env.RAZORPAY_DEFAULT_OFFER_IDS || "")
    .split(",")
    .map((offerId) => offerId.trim())
    .filter(Boolean);
};

const normalizeCouponCode = (value) => String(value || "").trim().toUpperCase();

const isValidOfferId = (offerId) => /^offer_[A-Za-z0-9]+$/.test(String(offerId || ""));

const sanitizeNoteValue = (value) => String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, 256);

const buildNotes = (entries) => {
  return Object.fromEntries(
    Object.entries(entries)
      .slice(0, 15)
      .map(([key, value]) => [key, sanitizeNoteValue(value)])
  );
};

const getService = (serviceKey) => {
  const requestedKey = String(serviceKey || DEFAULT_SERVICE_KEY).trim();
  const catalog = getServiceCatalog();
  const service = catalog[requestedKey];

  if (!service) {
    throw new Error("Selected service is not available for payment.");
  }

  const amountInPaise = Number(service.amountInPaise);

  if (!Number.isInteger(amountInPaise) || amountInPaise < MIN_ORDER_AMOUNT_PAISE) {
    throw new Error("Selected service amount is not configured correctly.");
  }

  return {
    key: requestedKey,
    label: String(service.label || requestedKey),
    amountInPaise,
  };
};

const getNumber = (value, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
};

const isCouponWithinValidityWindow = (coupon, now) => {
  const startsAt = coupon.startsAt ? Date.parse(coupon.startsAt) : null;
  const expiresAt = coupon.expiresAt ? Date.parse(coupon.expiresAt) : null;

  if (startsAt && now < startsAt) return false;
  if (expiresAt && now > expiresAt) return false;
  return true;
};

const getCouponDiscountAmount = (coupon, baseAmount) => {
  if (coupon.type === "percentage") {
    const percentage = Math.max(0, Math.min(getNumber(coupon.value), 100));
    const discount = Math.floor((baseAmount * percentage) / 100);
    return coupon.maxDiscountPaise ? Math.min(discount, getNumber(coupon.maxDiscountPaise)) : discount;
  }

  if (coupon.type === "fixed") {
    return Math.round(getNumber(coupon.value) * 100);
  }

  if (coupon.type === "fixed_paise") {
    return Math.round(getNumber(coupon.value));
  }

  if (coupon.type === "razorpay_offer") {
    return 0;
  }

  throw new Error("Coupon configuration is invalid.");
};

const calculatePricing = ({ serviceKey, couponCode }) => {
  const service = getService(serviceKey);
  const coupons = getCouponCatalog();
  const normalizedCouponCode = normalizeCouponCode(couponCode);
  const coupon = normalizedCouponCode ? coupons[normalizedCouponCode] : null;
  const baseAmount = service.amountInPaise;
  let discountAmount = 0;
  let forceOffer = false;
  const offerIds = new Set(getDefaultOfferIds().filter(isValidOfferId));

  if (normalizedCouponCode && !coupon) {
    throw new Error("Invalid coupon code.");
  }

  if (coupon) {
    if (coupon.active === false) {
      throw new Error("This coupon is not active.");
    }

    if (!isCouponWithinValidityWindow(coupon, Date.now())) {
      throw new Error("This coupon is not valid right now.");
    }

    if (coupon.serviceKeys?.length && !coupon.serviceKeys.includes(service.key)) {
      throw new Error("This coupon is not valid for the selected service.");
    }

    if (coupon.razorpayOfferId) {
      if (!isValidOfferId(coupon.razorpayOfferId)) {
        throw new Error("Coupon offer id is not configured correctly.");
      }

      offerIds.add(coupon.razorpayOfferId);
      forceOffer = coupon.forceOffer === true;
    }

    discountAmount = getCouponDiscountAmount(coupon, baseAmount);
  }

  const allowFreeCheckout = coupon?.allowFreeCheckout === true;
  const minimumPayable = allowFreeCheckout ? FREE_CHECKOUT_AMOUNT_PAISE : MIN_ORDER_AMOUNT_PAISE;
  discountAmount = Math.max(0, Math.min(discountAmount, baseAmount - minimumPayable));
  const finalAmount = Math.max(minimumPayable, baseAmount - discountAmount);

  return {
    service,
    baseAmount,
    discountAmount,
    finalAmount,
    coupon: coupon
      ? {
          code: normalizedCouponCode,
          label: coupon.label || normalizedCouponCode,
          type: coupon.type,
          value: coupon.value,
          razorpayOfferId: coupon.razorpayOfferId || null,
          allowFreeCheckout,
        }
      : null,
    offerIds: Array.from(offerIds),
    forceOffer,
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const pricing = calculatePricing({
      serviceKey: body.service,
      couponCode: body.couponCode,
    });
    const receipt = `qcs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 40);

    if (pricing.finalAmount === FREE_CHECKOUT_AMOUNT_PAISE) {
      return Response.json({
        success: true,
        freeCheckout: true,
        order: {
          id: `free_${receipt}`,
          amount: 0,
          currency: DEFAULT_CURRENCY,
          receipt,
        },
        pricing: {
          service: pricing.service,
          baseAmount: pricing.baseAmount,
          discountAmount: pricing.discountAmount,
          finalAmount: pricing.finalAmount,
          coupon: pricing.coupon,
          offerIds: pricing.offerIds,
          forceOffer: pricing.forceOffer,
        },
      });
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    const orderPayload = {
      amount: pricing.finalAmount,
      currency: DEFAULT_CURRENCY,
      receipt,
      notes: buildNotes({
        service: pricing.service.key,
        serviceLabel: pricing.service.label,
        auditScore: body.auditScore,
        linkedinUrl: body.linkedinUrl,
        role: body.role,
        couponCode: pricing.coupon?.code || "",
        baseAmountPaise: pricing.baseAmount,
        discountAmountPaise: pricing.discountAmount,
        finalAmountPaise: pricing.finalAmount,
      }),
    };

    if (pricing.offerIds.length > 0) {
      orderPayload.offers = pricing.offerIds;
    }

    if (pricing.forceOffer) {
      orderPayload.force_offer = true;
    }

    const response = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getBasicAuthHeader(keyId, keySecret),
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { success: false, message: data?.error?.description || "Unable to create Razorpay order" },
        { status: response.status }
      );
    }

    return Response.json({
      success: true,
      order: data,
      pricing: {
        service: pricing.service,
        baseAmount: pricing.baseAmount,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalAmount,
        coupon: pricing.coupon,
        offerIds: pricing.offerIds,
        forceOffer: pricing.forceOffer,
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || "Unable to create payment order" },
      { status: 500 }
    );
  }
}
