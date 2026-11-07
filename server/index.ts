import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { calculateServerOrder, SERVER_MENU_CATALOG } from './menuData';
import {
  createServerOrder,
  getAllOrders,
  findOrderById,
  checkOrderAccess,
  updateOrderStatusOnServer,
  markPaymentReceivedOnServer,
  addItemsToExistingOrder,
  toPublicOrder,
  type ServerOrderStatus,
} from './orderStore';
import {
  validateAuthConfig,
  verifyAdminPassword,
  createAdminSessionToken,
  requireAdminAuth,
} from './auth';
import {
  verifyWebhookSignature,
  createHostedPaymentSession,
  processVerifiedWebhookEvent,
} from './payment';
import { checkoutRequestSchema, adminLoginSchema, addItemsRequestSchema } from '../src/lib/schemas';

// STEP 6: Fail startup immediately if production credentials/secrets are missing
validateAuthConfig();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

// ─── Real-Time SSE (Server-Sent Events) Hub ─────────────────────────────────────
const sseClients = new Map<string, Set<express.Response>>();

function broadcastOrderUpdate(order: any) {
  if (!order || !order.id) return;
  const clients = sseClients.get(order.id);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify(toPublicOrder(order))}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  }
}

// ─── 1. Security Headers (Helmet) ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://checkout.razorpay.com',
          'https://js.stripe.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.razorpay.com',
          'https://api.stripe.com',
          'http://localhost:*',
          'ws://localhost:*',
        ],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://js.stripe.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'sameorigin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ─── 2. CORS Restriction ───────────────────────────────────────────────────────
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature'],
  })
);

// ─── 3. Body Parser with Size Limiting & Raw Buffer for Webhook ─────────────────
app.use(
  express.json({
    limit: '10kb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString('utf-8');
    },
  })
);
app.use(cookieParser());

// ─── 4. Rate Limiters (Abuse Prevention) ────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const checkoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Order submission rate limit exceeded. Please wait a minute.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
});

app.use('/api', generalLimiter);

// ─── 5. API Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/menu
 * Returns authoritative server menu catalog.
 */
app.get('/api/menu', (_req, res) => {
  res.json({ menu: Object.values(SERVER_MENU_CATALOG) });
});

/**
 * POST /api/checkout
 */
app.post('/api/checkout', checkoutLimiter, (req, res) => {
  try {
    const parseResult = checkoutRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join(', ');
      return res.status(400).json({ error: errorMsg });
    }

    const { customerName, contactNumber, items, paymentMethod, hp_bot_check } = parseResult.data;

    // Honeypot check for bots
    if (hp_bot_check && hp_bot_check.length > 0) {
      return res.status(400).json({ error: 'Automated submission rejected' });
    }

    // Server-side price calculation
    const calculated = calculateServerOrder(items);

    // Save order in SQLite database
    const order = createServerOrder({
      customerName,
      contactNumber,
      items: calculated.items,
      totalPrice: calculated.total,
      paymentMethod,
    });

    const maskedPhone = contactNumber.slice(0, 3) + '****' + contactNumber.slice(-3);
    console.log(`[ORDER CREATED] ${order.id} (#${order.orderNumber}) for ${maskedPhone} - ₹${order.totalPrice}`);

    return res.status(201).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        accessToken: order.accessToken,
        customerName: order.customerName,
        contactNumber: order.contactNumber,
        items: order.items,
        totalPrice: order.totalPrice,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
        estimatedMinutes: order.estimatedMinutes,
      },
    });
  } catch (err: any) {
    console.error('[CHECKOUT ERROR]', err.message);
    return res.status(400).json({ error: err.message || 'Invalid order request' });
  }
});

/**
 * GET /api/orders/:id
 * IDOR Protected order status lookup
 */
app.get('/api/orders/:id', (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = req.query.token as string | undefined;
  const phone = req.query.phone as string | undefined;

  const order = findOrderById(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const adminCookie = req.cookies?.momo_admin_token;
  const authHeader = req.headers.authorization;
  const adminBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const isAdmin = (adminCookie && requireAdminAuth) || (adminBearer && requireAdminAuth);

  const hasAccess = checkOrderAccess(order, token, phone, Boolean(isAdmin));
  if (!hasAccess) {
    return res.status(403).json({ error: 'Forbidden: Valid order access token or phone verification required' });
  }

  return res.json({ order: toPublicOrder(order) });
});

/**
 * GET /api/orders/:id/events (Server-Sent Events for Live Customer Tracking)
 */
app.get('/api/orders/:id/events', (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = req.query.token as string | undefined;

  const order = findOrderById(id);
  if (!order || (token && order.accessToken !== token)) {
    return res.status(403).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state
  res.write(`data: ${JSON.stringify(toPublicOrder(order))}\n\n`);

  if (!sseClients.has(id)) {
    sseClients.set(id, new Set());
  }
  sseClients.get(id)!.add(res);

  req.on('close', () => {
    const clients = sseClients.get(id);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(id);
      }
    }
  });
});

/**
 * POST /api/orders/:id/add-items
 * Customer adds extra items to active order
 */
app.post('/api/orders/:id/add-items', checkoutLimiter, (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parseResult = addItemsRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join(', ');
    return res.status(400).json({ error: errorMsg });
  }

  const { accessToken, items } = parseResult.data;
  const order = findOrderById(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.accessToken !== accessToken) {
    return res.status(403).json({ error: 'Forbidden: Invalid order access token' });
  }

  if (order.status === 'completed' || order.status === 'cancelled') {
    return res.status(400).json({ error: 'Cannot add items to completed or cancelled orders' });
  }

  try {
    const calculated = calculateServerOrder(items);
    const additionalMinutes = Math.max(2, Math.floor(calculated.items.reduce((acc, i) => acc + i.qty, 0) * 1.2));
    const updated = addItemsToExistingOrder(id, accessToken, calculated.items, calculated.total, additionalMinutes);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update order' });
    }

    broadcastOrderUpdate(updated);
    console.log(`[ORDER UPDATED] Order #${updated.orderNumber} added ${calculated.items.length} item(s) (+₹${calculated.total}). New total: ₹${updated.totalPrice}`);
    return res.json({ success: true, order: toPublicOrder(updated) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to add items' });
  }
});

/**
 * POST /api/payment/create-session
 */
app.post('/api/payment/create-session', checkoutLimiter, (req, res) => {
  const { orderId, token } = req.body;
  if (!orderId || !token) {
    return res.status(400).json({ error: 'Missing orderId or token' });
  }

  const order = findOrderById(orderId);
  if (!order || order.accessToken !== token) {
    return res.status(403).json({ error: 'Unauthorized order access' });
  }

  const session = createHostedPaymentSession(order.id, order.totalPrice);
  return res.json(session);
});

/**
 * POST /api/payment/webhook
 */
app.post('/api/payment/webhook', webhookLimiter, (req, res) => {
  const signature = (req.headers['x-webhook-signature'] || req.headers['x-razorpay-signature']) as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.warn('[WEBHOOK WARNING] Rejected webhook due to invalid signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const event = req.body;
    if (!event || !event.id || !event.type || !event.data?.orderId) {
      return res.status(400).json({ error: 'Malformed webhook event payload' });
    }

    const result = processVerifiedWebhookEvent(event);
    if (result.alreadyProcessed) {
      return res.status(200).json({ received: true, note: 'Duplicate event ignored' });
    }

    if (result.success && result.order) {
      broadcastOrderUpdate(result.order);
      console.log(`[PAYMENT VERIFIED] Order ${event.data.orderId} marked paid via webhook ${event.id}`);
      return res.status(200).json({ received: true, status: 'order_marked_paid' });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[WEBHOOK ERROR]', err.message);
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});

// ─── 6. Admin Authentication & Management Routes ───────────────────────────────

/**
 * POST /api/admin/login
 */
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const parseResult = adminLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Password required' });
    }

    const { password } = parseResult.data;
    const isCorrect = await verifyAdminPassword(password);
    if (!isCorrect) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const sessionToken = createAdminSessionToken();

    res.cookie('momo_admin_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.json({ success: true, token: sessionToken });
  } catch (err: any) {
    console.error('[ADMIN LOGIN ERROR]', err.message);
    return res.status(500).json({ error: 'Authentication service error' });
  }
});

/**
 * GET /api/admin/check
 */
app.get('/api/admin/check', requireAdminAuth, (_req, res) => {
  res.json({ authenticated: true });
});

/**
 * POST /api/admin/logout
 */
app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('momo_admin_token');
  res.json({ success: true });
});

/**
 * GET /api/admin/orders
 */
app.get('/api/admin/orders', requireAdminAuth, (_req, res) => {
  const orders = getAllOrders().map(toPublicOrder);
  res.json({ orders });
});

/**
 * POST /api/admin/orders/:id/payment-received (Owner confirms UPI/Cash payment)
 */
app.post('/api/admin/orders/:id/payment-received', requireAdminAuth, (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = markPaymentReceivedOnServer(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  broadcastOrderUpdate(order);
  console.log(`[PAYMENT CONFIRMED BY OWNER] Order #${order.orderNumber} payment marked received`);
  return res.json({ success: true, order: toPublicOrder(order) });
});

/**
 * PATCH /api/admin/orders/:id/status
 */
app.patch('/api/admin/orders/:id/status', requireAdminAuth, (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status: ServerOrderStatus };

  const validStatuses: ServerOrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const updated = updateOrderStatusOnServer(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Order not found' });
  }

  broadcastOrderUpdate(updated);
  console.log(`[STATUS UPDATED] Order #${updated.orderNumber} is now '${status}'`);
  return res.json({ success: true, order: toPublicOrder(updated) });
});

// ─── 6b. Production Static Asset Serving ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// ─── 7. Global Error Handler ───────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED SERVER ERROR]', err.stack || err.message);
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`🛡️  Steam & Fold SQLite-backed API Server running on http://localhost:${PORT}`);
});
