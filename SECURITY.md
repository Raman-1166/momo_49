# Security Policy & Implementation Guide

## 1. Security Architecture Summary

Steam & Fold uses a multi-layered, zero-trust security architecture:

```
[Browser Client]
       │
       ▼ (HTTPS, CSP, Strict Origin CORS)
[Security Middleware Layer]
       ├─ Helmet (CSP, HSTS, Frameguard, Referrer-Policy, nosniff)
       ├─ Rate Limiters (Checkout: 10/min, Admin Login: 5/15min, Webhook: 60/min)
       ├─ Body Size Limiter (10kb max)
       └─ Honeypot Bot Filter (hp_bot_check)
       │
       ▼ (Zod Schema Validation & XSS Sanitization)
[Business Logic & Pricing Engine]
       ├─ Server-Authoritative Price Calculation (Client prices discarded)
       ├─ Variant & Quantity Integrity Verification (1 <= qty <= 20)
       └─ Cryptographic ID Generation (Unguessable UUID + 48-char Access Token)
       │
       ▼
[Payment & Webhook Security]
       ├─ Hosted Checkout Only (No raw card data stored or handled)
       ├─ Webhook HMAC-SHA256 Timing-Safe Signature Verification
       └─ Idempotent Webhook Processing (Duplicate event protection)
       │
       ▼
[Admin Dashboard Protection]
       ├─ Bcrypt Password Verification against Server .env Hash
       ├─ HttpOnly, Secure, SameSite=Strict Session Cookies
       └─ Session Expiration (8 hours)
```

---

## 2. Security Checklist

- [x] **Never Trust the Client:** Prices, discounts, tax, and totals calculated exclusively on the server.
- [x] **Input Validation:** Both client and server validate against strict Zod schemas (`customerName`, `contactNumber`, `items`).
- [x] **XSS Mitigation:** HTML tags and non-printable control characters are stripped. No usage of `innerHTML` or `dangerouslySetInnerHTML`.
- [x] **IDOR Prevention:** Order IDs are unguessable UUIDs (`ord_...`). Customers can only access an order with their cryptographic `accessToken` or matching phone number.
- [x] **Payment Security:** Orders are marked `paid` ONLY via HMAC-verified gateway webhooks.
- [x] **Idempotency:** Webhook event IDs are tracked to prevent duplicate orders or double-crediting.
- [x] **Secrets Management:** Zero secrets in client-side code. `.env` added to `.gitignore`. `.env.example` provided.
- [x] **HTTP Security Headers:** Complete Helmet CSP, HSTS, frame protection, and CORS restriction.
- [x] **Abuse Prevention:** Rate limiting on checkout, admin login, and webhooks. Honeypot bot detection.
- [x] **Data Privacy:** Customer phone numbers are masked in server logs. Cart in `localStorage` contains only minimal item IDs and quantities.
- [x] **Admin Authentication:** Bcrypt password hashing, session tokens, and brute-force rate limiting.
- [x] **Vulnerability Audit:** 0 known vulnerabilities (`npm audit`).

---

## 3. Environment Variables Reference

| Variable | Description | Exposure |
|---|---|---|
| `PORT` | API server port (default: 3001) | Server only |
| `NODE_ENV` | `development` or `production` | Server only |
| `ALLOWED_ORIGIN` | Allowed client origin (e.g. `http://localhost:5173`) | Server only |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password | Server only |
| `ADMIN_SESSION_SECRET` | 32+ byte cryptographic secret for admin sessions | Server only |
| `WEBHOOK_SECRET` | HMAC secret for verifying payment gateway webhooks | Server only |
| `RAZORPAY_KEY_ID` | Hosted checkout publishable/key ID | Safe for frontend |
| `RAZORPAY_KEY_SECRET`| Gateway secret for API calls | Server only |

---

## 4. Testing Attack Scenarios

Run the automated attack test suite:
```bash
npx tsx server/test-security.ts
```

This verifies:
1. Client price tampering rejection
2. Negative or excessive quantity rejection
3. Stored/reflected XSS script stripping
4. Forged webhook signature rejection
5. Rapid API call rate limiting (HTTP 429)
6. IDOR unauthorized order inspection denial (HTTP 403)

