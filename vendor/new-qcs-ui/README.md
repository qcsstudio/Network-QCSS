# vixan next js

- jamilrayhan100@gmail.com

<details>
<summary> vixan  </summary>

-   [** vixan **](https://www.facebook.com/jamil.rayhan100)

    -   vixan Next js
    -   vixan HTML
    -   vixan Wordpress
    -   vixan PSD
    -   vixan Figma
    
</details>

## Razorpay payment configuration

The `/payment` page creates server-side Razorpay Orders and supports both QCS-managed coupon discounts and Razorpay Dashboard offers. For testing, built-in coupon `QCS100` gives a 100% discount for the LinkedIn rewrite service and skips Razorpay checkout.

Required environment variables:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: public Checkout key id. This is the Razorpay **Key Id** and is safe for browser Checkout.
- `RAZORPAY_KEY_ID`: server-side key id used for Razorpay API calls. Use the same Razorpay **Key Id** value as `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- `RAZORPAY_KEY_SECRET`: server-side key secret used for order creation, payment fetch, and signature verification. Never commit this value or expose it in client code.

Copy `.env.example` to `.env.local` for local testing and replace the placeholder values. Add the real values in Vercel/hosting environment variables for deployment. If a live `RAZORPAY_KEY_SECRET` is shared in chat, email, tickets, or any non-secret-manager location, rotate/regenerate it in Razorpay before relying on it for production.

Optional environment variables:

- `PAYMENT_SERVICE_CATALOG_JSON`: overrides or extends service pricing. Example: `{"profile-rewrite-100-score":{"label":"LinkedIn Profile Rewrite to 100% QCS Score","amountInPaise":4900}}`.
- `RAZORPAY_DEFAULT_OFFER_IDS`: comma-separated Razorpay Dashboard offer ids to show by default at Checkout, for example `offer_abc123,offer_def456`.
- `RAZORPAY_COUPONS_JSON`: coupon and offer configuration. Example:

```json
{
  "QCS10": {
    "active": true,
    "label": "10% launch discount",
    "type": "percentage",
    "value": 10,
    "maxDiscountPaise": 1000,
    "startsAt": "2026-05-01T00:00:00+05:30",
    "expiresAt": "2026-06-01T00:00:00+05:30",
    "serviceKeys": ["profile-rewrite-100-score"]
  },
  "BANKOFFER": {
    "active": true,
    "label": "Eligible Razorpay bank offer",
    "type": "razorpay_offer",
    "value": 0,
    "razorpayOfferId": "offer_REPLACE_WITH_DASHBOARD_ID",
    "forceOffer": false,
    "serviceKeys": ["profile-rewrite-100-score"]
  }
}
```

Use `percentage`, `fixed` (rupees), or `fixed_paise` for QCS-managed coupons. Use `razorpay_offer` when the discount/cashback rules live in the Razorpay Dashboard; set `forceOffer` only when Checkout must require that single offer. Set `allowFreeCheckout: true` only for intentional 100% internal/testing coupons because the app marks the rewrite as paid without opening Razorpay when the payable amount is ₹0.

### Paid AI rewrite layer

The paid `/suggestions` workspace calls `/api/analyze/rewrite` only after payment. `OPENAI_API_KEY` is required for paid AI-enhanced profile rewrites; if it is missing or the OpenAI request fails, the page shows an AI rewrite error instead of exposing a rule-based rewrite as the paid output.

Required for paid rewrite:

- `OPENAI_API_KEY`: server-only OpenAI API key for AI-enhanced profile rewrites.
- `OPENAI_REWRITE_MODEL`: model used by the rewrite endpoint. Defaults to `gpt-4.1-mini`.

The AI prompt is instructed to use only scraped profile facts and bracketed placeholders for unverified claims, so the rewrite does not invent metrics, employers, clients, certifications, or outcomes. The rewrite endpoint sends a scoring-engine brief with scraped About text, detected niche, keyword bank, weak section scores, priority suggestions, proof signals, current role/company, activity themes, and the exact QCS scoring rules to satisfy. The server enforces LinkedIn section limits before returning the rewrite: headline 220 characters, About 2,600 characters, each experience bullet 600 characters, and each role description 2,000 characters. The paid workspace displays a projected 100% QCS rewrite score when the user implements the rewritten copy and action fixes.
