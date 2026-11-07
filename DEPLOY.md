# Steam & Fold - Production Deployment Guide

This guide covers everything needed to deploy the **Steam & Fold** 3D Momo Ordering Application to production with maximum security, persistence, and real-time updates.

---

## 1. Quick Overview & Architecture

- **Frontend:** React 19 + Three.js / React Three Fiber + Tailwind CSS (bundled with Vite).
- **Backend:** Express API with Helmet, strict CORS, rate limiting, and Server-Sent Events (SSE).
- **Database:** SQLite with Write-Ahead Logging (WAL) mode (`server/data/momo.db`).
- **Auth:** Argon2/Bcrypt hashed password authentication with cryptographic HMAC-SHA256 session tokens.
- **Payments:** Hosted Razorpay with cryptographic HMAC webhook verification + QR/UPI with owner manual verification.

---

## 2. Environment Variables (.env)

Create a `.env` file in the project root:

```bash
# Server Environment
NODE_ENV=production
PORT=3001
ALLOWED_ORIGIN=https://yourdomain.com

# Admin Authentication (Mandatory in production - server will fail to start if missing)
# Generate with: node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"
ADMIN_PASSWORD_HASH=$2b$12$...

# Session Secret (Minimum 32 characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_SESSION_SECRET=a8f4c2e6b9101214161820222426283032343638404244464850525456586062

# Payment Webhook Secret (From Razorpay Webhook settings)
WEBHOOK_SECRET=whsec_your_razorpay_secret_key
```

> **Security Note:** In `production` mode, the server will intentionally **refuse to boot** if `ADMIN_PASSWORD_HASH` or `ADMIN_SESSION_SECRET` is missing or below 32 characters.

---

## 3. Database Persistence

The application uses SQLite (`better-sqlite3`) with WAL mode enabled.

- Database location: `server/data/momo.db`
- **Container / Docker Deployments:** Mount a persistent volume to `server/data/` or `/app/server/data/`.
  - Example Docker volume: `-v /host/momo-data:/app/server/data`
  - Example Render: Add a Persistent Disk mounted at `/opt/render/project/src/server/data`
  - Example Railway: Add a Volume attached to `/app/server/data`

---

## 4. Build & Run Steps

### Option A: Single-Server Deployment (Recommended for VPS / Render / Railway)

Express automatically serves the static Vite frontend from `dist/` in production:

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Build frontend assets
npm run build

# 3. Start production server
npm run server
```

The application will now be live on `http://localhost:3001` with both static assets and API routes served together.

---

### Option B: Decoupled (Vercel / Netlify Frontend + Backend API)

1. **Deploy Frontend:**
   - Push to GitHub and import into Vercel or Netlify.
   - Build command: `npm run build`
   - Output directory: `dist`
   - In `vite.config.ts`, configure the proxy or set the API base URL to your backend domain.
2. **Deploy Backend:**
   - Deploy Node.js server to VPS, Render, or Railway using `npm run server`.
   - Set `ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app` in backend environment variables.

---

## 5. Reverse Proxy Configuration (Nginx / Caddy)

For SSL termination and real-time SSE support:

### Caddy (Easiest - Automatic SSL):
```caddy
yourdomain.com {
    reverse_proxy localhost:3001
}
```

### Nginx:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for Server-Sent Events (SSE) live updates
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

---

## 6. Payment Webhook Setup (Razorpay)

1. Log into your **Razorpay Dashboard** (`https://dashboard.razorpay.com/`).
2. Go to **Settings** -> **Webhooks** -> **Add New Webhook**.
3. **Webhook URL:** `https://yourdomain.com/api/payment/webhook`
4. **Secret:** Paste your `WEBHOOK_SECRET` string.
5. **Active Events:** Check `payment.captured` and `order.paid`.
6. Save the webhook. Incoming webhooks are verified with HMAC-SHA256 signatures and are fully idempotent.

---

## 7. Production Verification Checklist

- [ ] `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` configured in `.env`.
- [ ] Navigating to `/admin` opens the password-protected kitchen dashboard.
- [ ] Sound autoplay unmuted by clicking "Enable Sound" in the admin dashboard.
- [ ] UPI orders show "Payment Pending" until owner taps "Mark Payment Received".
- [ ] Order links (`/?order=<id>&token=<token>`) reload with real-time SSE updates.
- [ ] SQLite database file `server/data/momo.db` backed up or placed on persistent volume.

