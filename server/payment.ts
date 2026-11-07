import crypto from 'crypto';
import { markOrderPaidViaWebhook, findOrderById } from './orderStore';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_momo_signature_key_secret_2026';

/**
 * Verifies HMAC-SHA256 signature of incoming payment gateway webhooks.
 * Uses timingSafeEqual to avoid timing side-channel attacks.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !rawBody) return false;

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signatureHeader.trim());
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Creates hosted payment session/order metadata.
 */
export function createHostedPaymentSession(orderId: string, amount: number) {
  const order = findOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Generates gateway order ID
  const gatewayOrderId = `order_${crypto.randomBytes(12).toString('hex')}`;

  return {
    gatewayOrderId,
    orderId,
    amount,
    currency: 'INR',
    // Publishable key safe for client-side checkout SDK
    publishableKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id',
  };
}

/**
 * Handles verified webhook events idempotently.
 */
export function processVerifiedWebhookEvent(event: {
  id: string; // Event ID e.g. "evt_123"
  type: string; // e.g. "payment.captured" or "checkout.session.completed"
  data: {
    orderId: string;
    gatewayOrderId?: string;
  };
}) {
  if (event.type === 'payment.captured' || event.type === 'checkout.session.completed' || event.type === 'order.paid') {
    return markOrderPaidViaWebhook(event.data.orderId, event.id, event.data.gatewayOrderId);
  }
  return { success: false, alreadyProcessed: false };
}

